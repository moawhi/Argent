import { createClient, type ClickHouseClient } from "@clickhouse/client";
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

function client(config: DbConfig, secrets: DbSecrets): ClickHouseClient {
  const protocol = config.protocol ?? (config.ssl ? "https" : "http");
  return createClient({
    url: `${protocol}://${config.host}:${config.port}`,
    username: config.user,
    password: secrets.password ?? "",
    database: config.database,
    request_timeout: 30_000,
  });
}

export const clickhouseAdapter: DbAdapter = {
  engine: "clickhouse",

  async testConnection(config, secrets) {
    const ch = client(config, secrets);
    try {
      await ch.query({ query: "SELECT 1 AS ok", format: "JSONEachRow" });
    } finally {
      await ch.close();
    }
  },

  async introspect(config, secrets) {
    const ch = client(config, secrets);
    try {
      const result = await ch.query({
        query: `
          SELECT
            database AS schema_name,
            table AS table_name,
            if(engine LIKE '%View%', 'view', 'table') AS table_type,
            name AS column_name,
            type AS data_type,
            1 AS is_nullable,
            0 AS is_pk
          FROM system.columns
          WHERE database = {db:String}
            AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
          ORDER BY table, position
        `,
        query_params: { db: config.database },
        format: "JSONEachRow",
      });

      const rows = (await result.json()) as {
        schema_name: string;
        table_name: string;
        table_type: string;
        column_name: string;
        data_type: string;
        is_nullable: number;
        is_pk: number;
      }[];

      return mapCatalogRelations(
        groupSchemas(
          rows.map((row) => ({
            ...row,
            is_nullable: row.is_nullable ? "YES" : "NO",
            is_pk: Boolean(row.is_pk),
          })),
        ),
      );
    } finally {
      await ch.close();
    }
  },

  async query(config, secrets, sql, params, options) {
    const maxRows = options?.maxRows ?? 5000;
    const offset = options?.offset ?? 0;
    const bound = bindSql("clickhouse", sql, params);
    const ch = client(config, secrets);

    try {
      const limited = applySqlRowLimits(bound.text, maxRows, offset);

      const result = await ch.query({
        query: limited,
        query_params: bound.named,
        format: "JSONEachRow",
      });

      const rows = (await result.json()) as Record<string, unknown>[];
      const fields =
        rows.length > 0
          ? Object.keys(rows[0]).map((name) => ({ name }))
          : [];

      return {
        rows,
        fields,
        rowCount: rows.length,
        previewSql: bound.preview,
      } satisfies DbQueryResult;
    } finally {
      await ch.close();
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
