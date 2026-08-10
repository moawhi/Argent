export type DbEngine = "postgres" | "mariadb" | "clickhouse";

export const ENGINE_DEFAULTS: Record<
  DbEngine,
  { port: number; label: string; sslLabel: string }
> = {
  postgres: { port: 5432, label: "PostgreSQL", sslLabel: "SSL" },
  mariadb: { port: 3306, label: "MariaDB", sslLabel: "SSL" },
  clickhouse: { port: 8123, label: "ClickHouse", sslLabel: "HTTPS" },
};
