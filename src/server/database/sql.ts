import {
  extractParamNames,
  SQL_PARAM_PATTERN as PARAM,
} from "@/lib/database/sql";
import type { DbEngine } from "./types";

export { extractParamNames };

export interface BoundSql {
  /** Dialect-ready SQL with placeholders. */
  text: string;
  /** Positional values for postgres/mariadb. */
  values: unknown[];
  /** Named values for ClickHouse query_params. */
  named: Record<string, unknown>;
  /** SQL with `{{name}}` kept but values shown for logs (caller redacts). */
  preview: string;
}

/**
 * Turns `{{name}}` placeholders into engine-native binds. Values are never
 * spliced into the SQL string — only placeholder tokens change.
 */
export function bindSql(
  engine: DbEngine,
  template: string,
  params: Record<string, unknown>,
): BoundSql {
  const names = extractParamNames(template);
  const values: unknown[] = [];
  const named: Record<string, unknown> = {};

  let index = 0;
  const text = template.replace(PARAM, (_whole, name: string) => {
    const value = params[name];
    if (engine === "postgres") {
      values.push(value ?? null);
      index += 1;
      return `$${index}`;
    }
    if (engine === "mariadb") {
      values.push(value ?? null);
      return "?";
    }
    // ClickHouse named params: {name:Type}
    named[name] = value ?? null;
    return `{${name}:${clickhouseType(value)}}`;
  });

  const preview = template.replace(PARAM, (_whole, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) return "NULL";
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  });

  // Silence unused for engines that don't use named/values.
  void names;

  return { text, values, named, preview };
}

function clickhouseType(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "Int64" : "Float64";
  }
  if (typeof value === "boolean") return "UInt8";
  return "String";
}

/** Strip line/block comments so the first keyword is the real verb. */
export function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();
}

const READ_PREFIX =
  /^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN|EXISTS)\b/i;

const WRITE_PREFIX =
  /^(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|OPTIMIZE|ATTACH|DETACH|RENAME|KILL|SET)\b/i;

/** True when the statement is a single read-only query. */
export function isReadOnlySql(sql: string): boolean {
  const cleaned = stripSqlComments(sql);
  if (!cleaned) return false;
  // Refuse multi-statement scripts.
  if (cleaned.includes(";")) {
    const parts = cleaned.split(";").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) return false;
  }
  return READ_PREFIX.test(cleaned) && !WRITE_PREFIX.test(cleaned);
}

export function isWriteSql(sql: string): boolean {
  const cleaned = stripSqlComments(sql);
  if (!cleaned) return false;
  return WRITE_PREFIX.test(cleaned) || !isReadOnlySql(sql);
}

/** First keyword, for storing Operation.method. */
export function sqlVerb(sql: string): string {
  const cleaned = stripSqlComments(sql);
  const match = cleaned.match(/^([A-Za-z]+)/);
  return (match?.[1] ?? "SQL").toUpperCase();
}
