import { ENGINE_DEFAULTS, type DbEngine } from "@/lib/database/engines";
import type {
  DbColumn,
  DbRelation,
  DbSchema,
  DbTable,
} from "@/lib/database/schema-types";

export type { DbEngine, DbColumn, DbRelation, DbSchema, DbTable };
export { ENGINE_DEFAULTS };

export interface DbConfig {
  engine: DbEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  /** Postgres search_path hint; unused by MariaDB/ClickHouse. */
  searchPath?: string;
  /** ClickHouse HTTP protocol. */
  protocol?: "http" | "https";
}

export interface DbQueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; type?: string }[];
  rowCount: number;
  /** Bound SQL with secrets already replaced — for logs only. */
  previewSql: string;
}

export interface DbSecrets {
  password?: string;
}

export interface DbAdapter {
  engine: DbEngine;
  testConnection(config: DbConfig, secrets: DbSecrets): Promise<void>;
  introspect(config: DbConfig, secrets: DbSecrets): Promise<DbSchema[]>;
  query(
    config: DbConfig,
    secrets: DbSecrets,
    sql: string,
    params: Record<string, unknown>,
    options?: { maxRows?: number; offset?: number; timeoutMs?: number },
  ): Promise<DbQueryResult>;
}

export function displayBaseUrl(config: DbConfig): string {
  const scheme =
    config.engine === "clickhouse"
      ? (config.protocol ?? (config.ssl ? "https" : "http"))
      : config.engine;
  return `${scheme}://${config.host}:${config.port}/${config.database}`;
}
