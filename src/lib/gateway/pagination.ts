/**
 * Shared limits and helpers for paging large API / SQL result sets.
 * Kept free of server-only imports so client components can use the constants.
 */

export const FETCH_LIMITS = {
  /** Default table page size when creating objects. */
  tableDefaultPage: 25,
  /** Hard cap for a single table page request. */
  tablePageMax: 500,
  /** Default / max rows plotted on a chart. */
  chartMax: 2_000,
  /** Default / max rows scanned for a number card aggregate. */
  kpiMax: 1_000,
  /** Absolute ceiling for any SQL or post-parse row set. */
  hardMax: 5_000,
} as const;

export interface DataPagination {
  limit: number;
  offset: number;
}

const LIMIT_PARAM_NAMES = [
  "limit",
  "pageSize",
  "page_size",
  "take",
  "per_page",
  "perPage",
  "count",
  "max",
  "maxResults",
  "max_results",
  "top",
  "rowLimit",
  "row_limit",
];

const OFFSET_PARAM_NAMES = ["offset", "skip", "from", "start", "startIndex", "start_index"];

const PAGE_PARAM_NAMES = [
  "page",
  "pageNumber",
  "page_number",
  "pageNo",
  "page_no",
  "p",
];

export function clampLimit(value: number | undefined, max: number): number {
  if (!Number.isFinite(value) || value === undefined) return Math.min(max, FETCH_LIMITS.hardMax);
  return Math.max(1, Math.min(Math.floor(value), max, FETCH_LIMITS.hardMax));
}

export function clampOffset(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value < 0) return 0;
  return Math.floor(value);
}

export function normalizePagination(
  input: { limit?: number; offset?: number } | null | undefined,
  maxLimit: number,
): DataPagination {
  return {
    limit: clampLimit(input?.limit, maxLimit),
    offset: clampOffset(input?.offset),
  };
}

export function findLimitParamName(names: Iterable<string>): string | null {
  const set = new Set(names);
  return LIMIT_PARAM_NAMES.find((name) => set.has(name)) ?? null;
}

export function findOffsetParamName(names: Iterable<string>): string | null {
  const set = new Set(names);
  return OFFSET_PARAM_NAMES.find((name) => set.has(name)) ?? null;
}

export function findPageParamName(names: Iterable<string>): string | null {
  const set = new Set(names);
  return PAGE_PARAM_NAMES.find((name) => set.has(name)) ?? null;
}

/**
 * Writes limit / offset / page into a params bag when the operation declares
 * matching names. Explicit client values already present are left alone unless
 * `overwrite` is set (used when the UI owns paging).
 */
export function applyPaginationToParams(
  params: Record<string, unknown>,
  pagination: DataPagination,
  paramNames: string[],
  options: { overwrite?: boolean } = {},
): Record<string, unknown> {
  const next = { ...params };
  const overwrite = options.overwrite ?? true;
  const limitName = findLimitParamName(paramNames);
  const offsetName = findOffsetParamName(paramNames);
  const pageName = findPageParamName(paramNames);

  if (limitName && (overwrite || next[limitName] === undefined)) {
    next[limitName] = pagination.limit;
  }

  if (offsetName && (overwrite || next[offsetName] === undefined)) {
    next[offsetName] = pagination.offset;
  } else if (pageName && (overwrite || next[pageName] === undefined)) {
    // Most APIs use 1-based page numbers.
    next[pageName] = Math.floor(pagination.offset / pagination.limit) + 1;
  }

  return next;
}

/** True when the operation can page at the source (param names or SQL). */
export function supportsSourcePagination(paramNames: string[]): boolean {
  return (
    findLimitParamName(paramNames) !== null ||
    findOffsetParamName(paramNames) !== null ||
    findPageParamName(paramNames) !== null
  );
}

export function defaultFetchLimitForKind(
  kind: "table" | "chart" | "kpi",
): number {
  switch (kind) {
    case "chart":
      return FETCH_LIMITS.chartMax;
    case "kpi":
      return FETCH_LIMITS.kpiMax;
    case "table":
    default:
      return FETCH_LIMITS.tableDefaultPage;
  }
}
