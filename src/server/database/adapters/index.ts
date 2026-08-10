import type { DbAdapter, DbEngine } from "../types";
import { clickhouseAdapter } from "./clickhouse";
import { mariadbAdapter } from "./mariadb";
import { postgresAdapter } from "./postgres";

const ADAPTERS: Record<DbEngine, DbAdapter> = {
  postgres: postgresAdapter,
  mariadb: mariadbAdapter,
  clickhouse: clickhouseAdapter,
};

export function getAdapter(engine: DbEngine): DbAdapter {
  const adapter = ADAPTERS[engine];
  if (!adapter) {
    throw new Error(`Unsupported database engine: ${engine}`);
  }
  return adapter;
}
