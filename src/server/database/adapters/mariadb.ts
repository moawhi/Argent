import mysql from "mysql2/promise";
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

function pool(config: DbConfig, secrets: DbSecrets) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: secrets.password ?? "",
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectionLimit: 3,
    connectTimeout: 10_000,
  });
}

export const mariadbAdapter: DbAdapter = {
  engine: "mariadb",

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
      const [rows] = await client.query<mysql.RowDataPacket[]>(
        `
        SELECT
          c.TABLE_SCHEMA AS schema_name,
          c.TABLE_NAME AS table_name,
          CASE t.TABLE_TYPE WHEN 'VIEW' THEN 'view' ELSE 'table' END AS table_type,
          c.COLUMN_NAME AS column_name,
          c.COLUMN_TYPE AS data_type,
          c.IS_NULLABLE AS is_nullable,
          CASE WHEN c.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS is_pk
        FROM information_schema.COLUMNS c
        JOIN information_schema.TABLES t
          ON t.TABLE_SCHEMA = c.TABLE_SCHEMA
         AND t.TABLE_NAME = c.TABLE_NAME
        WHERE c.TABLE_SCHEMA = ?
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
        `,
        [config.database],
      );

      const [fkRows] = await client.query<mysql.RowDataPacket[]>(
        `
        SELECT
          TABLE_SCHEMA AS schema_name,
          TABLE_NAME AS table_name,
          COLUMN_NAME AS column_name,
          REFERENCED_TABLE_SCHEMA AS to_schema,
          REFERENCED_TABLE_NAME AS to_table,
          REFERENCED_COLUMN_NAME AS to_column
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_NAME IS NOT NULL
          AND TABLE_SCHEMA = ?
        `,
        [config.database],
      );

      return mapCatalogRelations(
        groupSchemas(
          rows.map((row) => ({
            schema_name: String(row.schema_name),
            table_name: String(row.table_name),
            table_type: String(row.table_type),
            column_name: String(row.column_name),
            data_type: String(row.data_type),
            is_nullable: String(row.is_nullable),
            is_pk: Boolean(row.is_pk),
          })),
        ),
        fkRows.map((row) => ({
          schema_name: String(row.schema_name),
          table_name: String(row.table_name),
          column_name: String(row.column_name),
          to_schema: String(row.to_schema),
          to_table: String(row.to_table),
          to_column: String(row.to_column),
        })),
      );
    } finally {
      await client.end();
    }
  },

  async query(config, secrets, sql, params, options) {
    const maxRows = options?.maxRows ?? 5000;
    const offset = options?.offset ?? 0;
    const bound = bindSql("mariadb", sql, params);
    const client = pool(config, secrets);

    try {
      const limited = applySqlRowLimits(bound.text, maxRows, offset);

      const [rows, fields] = await client.query(limited, bound.values);
      const list = Array.isArray(rows)
        ? (rows as Record<string, unknown>[])
        : [];

      return {
        rows: list.map((row) => ({ ...row })),
        fields: (Array.isArray(fields) ? fields : []).map((field) => ({
          name: field.name,
          type: String(field.type),
        })),
        rowCount: list.length,
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
