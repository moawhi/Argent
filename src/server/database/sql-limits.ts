/**
 * Appends LIMIT / OFFSET when the bound SQL does not already declare them.
 * Leaves user-authored LIMIT {{limit}} / OFFSET {{offset}} alone.
 */
export function applySqlRowLimits(
  sql: string,
  maxRows: number,
  offset = 0,
): string {
  let next = sql.replace(/;+\s*$/, "");
  const hasLimit = /\blimit\b/i.test(next);
  const hasOffset = /\boffset\b/i.test(next);

  if (!hasLimit) {
    next = `${next} LIMIT ${Math.max(1, Math.floor(maxRows))}`;
  }

  if (!hasOffset && offset > 0) {
    next = `${next} OFFSET ${Math.max(0, Math.floor(offset))}`;
  }

  return next;
}
