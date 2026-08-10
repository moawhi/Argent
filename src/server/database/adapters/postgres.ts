import pg from "pg";
import { mapCatalogRelations } from "@/lib/database/schema-types";
import { bindSql } from "../sql";
import { applySqlRowLimits } from "../sql-limits";
import type {
  DbAdapter,
  DbConfig,
  DbQueryResult,
  DbSchema,
  DbSecrets,
  DbTable,
} from "../types";

const { Pool } = pg;

function pool(config: DbConfig, secrets: DbSecrets) {
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: secrets.password ?? "",
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    max: 3,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });
}

export const postgresAdapter: DbAdapter = {
  engine: "postgres",

  async testConnection(config, secrets) {
    const client = pool(config, secrets);
    try {
      await client.query("SELECT 1 AS ok");
    } finally {
      await client.end();
    }
  },

  async introspect(config, secrets) {
    const client = pool(config, secrets);
    try {
      const { rows } = await client.query<{
        schema_name: string;
        table_name: string;
        table_type: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        is_pk: boolean;
      }>(`
        SELECT
          n.nspname AS schema_name,
          c.relname AS table_name,
          CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END AS table_type,
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
          EXISTS (
            SELECT 1
            FROM pg_index i
            WHERE i.indrelid = c.oid
              AND i.indisprimary
              AND a.attnum = ANY (i.indkey)
          ) AS is_pk
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relkind IN ('r', 'p', 'v', 'm')
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY n.nspname, c.relname, a.attnum
      `);

      const { rows: fkRows } = await client.query<{
        schema_name: string;
        table_name: string;
        column_name: string;
        to_schema: string;
        to_table: string;
        to_column: string;
      }>(`
        SELECT
          nsp.nspname AS schema_name,
          rel.relname AS table_name,
          att.attname AS column_name,
          fnsp.nspname AS to_schema,
          frel.relname AS to_table,
          fatt.attname AS to_column
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class frel ON frel.oid = con.confrelid
        JOIN pg_namespace fnsp ON fnsp.oid = frel.relnamespace
        JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src(attnum, ord) ON true
        JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS dst(attnum, ord)
          ON dst.ord = src.ord
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = src.attnum
        JOIN pg_attribute fatt
          ON fatt.attrelid = con.confrelid AND fatt.attnum = dst.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      `);

      return mapCatalogRelations(groupSchemas(rows), fkRows);
    } finally {
      await client.end();
    }
  },

  async query(config, secrets, sql, params, options) {
    const maxRows = options?.maxRows ?? 5000;
    const offset = options?.offset ?? 0;
    const bound = bindSql("postgres", sql, params);
    const client = pool(config, secrets);

    try {
      const limited = applySqlRowLimits(bound.text, maxRows, offset);

      const result = await client.query(limited, bound.values);
      const rows = result.rows.map((row) => ({ ...row })) as Record<
        string,
        unknown
      >[];

      return {
        rows,
        fields: result.fields.map((field) => ({
          name: field.name,
          type: String(field.dataTypeID),
        })),
        rowCount: rows.length,
        previewSql: bound.preview,
      } satisfies DbQueryResult;
    } finally {
      await client.end();
    }
  },
};

function groupSchemas(
  rows: {
    schema_name: string;
    table_name: string;
    table_type: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    is_pk: boolean;
  }[],
): DbSchema[] {
  const schemas = new Map<string, Map<string, DbTable>>();

  for (const row of rows) {
    let tables = schemas.get(row.schema_name);
    if (!tables) {
      tables = new Map();
      schemas.set(row.schema_name, tables);
    }

    let table = tables.get(row.table_name);
    if (!table) {
      table = {
        name: row.table_name,
        kind: row.table_type === "view" ? "view" : "table",
        columns: [],
      };
      tables.set(row.table_name, table);
    }

    table.columns.push({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      isPk: Boolean(row.is_pk),
    });
  }

  return [...schemas.entries()].map(([name, tables]) => ({
    name,
    tables: [...tables.values()],
  }));
}
