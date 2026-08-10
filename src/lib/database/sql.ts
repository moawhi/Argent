/** Shared SQL helpers safe for both client and server. */

const PARAM = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;

/** Ordered unique parameter names as they first appear in the template. */
export function extractParamNames(sql: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of sql.matchAll(PARAM)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      found.push(name);
    }
  }
  return found;
}

export { PARAM as SQL_PARAM_PATTERN };
