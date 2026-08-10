import "server-only";

import {
  FETCH_LIMITS,
  normalizePagination,
  type DataPagination,
} from "@/lib/gateway/pagination";
import type { ExecuteResponseBody } from "@/lib/gateway/types";

/**
 * Caps a collection response and attaches paging metadata.
 *
 * - Always hard-caps in-memory rows.
 * - If the upstream ignored `limit` and returned more than one page, pages
 *   locally with offset/limit so Next/Previous still work.
 * - If the upstream returned a single page, trusts that and reports `hasMore`
 *   when the page is full.
 */
export function applyRowCap(
  result: ExecuteResponseBody,
  pagination: DataPagination | null | undefined,
): ExecuteResponseBody {
  if (!result.ok || !pagination) return result;

  const rows = result.rows;
  if (!rows) {
    return {
      ...result,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: false,
      truncated: false,
    };
  }

  const hardCapped = rows.length > FETCH_LIMITS.hardMax;
  const working = hardCapped ? rows.slice(0, FETCH_LIMITS.hardMax) : rows;

  // Upstream returned more than requested — treat as a full set and page here.
  if (working.length > pagination.limit) {
    const start = pagination.offset;
    const end = start + pagination.limit;
    const sliced = working.slice(start, end);
    return {
      ...result,
      rows: sliced,
      rowCount: sliced.length,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: end < working.length,
      truncated: hardCapped,
    };
  }

  return {
    ...result,
    rows: working,
    rowCount: working.length,
    limit: pagination.limit,
    offset: pagination.offset,
    hasMore: working.length >= pagination.limit,
    truncated: hardCapped,
  };
}

export function resolveRequestPagination(
  input: { limit?: number; offset?: number } | null | undefined,
  maxLimit: number,
): DataPagination {
  return normalizePagination(input, maxLimit);
}
