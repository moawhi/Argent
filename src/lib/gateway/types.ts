import type { FieldDescriptor, ResponseKind } from "@/lib/openapi/types";

export type RequestOrigin = "gateway" | "tryIt" | "manual" | "test" | "mcp";

export type GatewayErrorKind =
  | "notFound"
  | "readOnly"
  | "missingParam"
  | "invalidParam"
  | "blockedHost"
  | "noCredentials"
  | "upstreamError"
  | "network"
  | "timeout"
  | "parse"
  | "config"
  | "forbidden";

export interface GatewayError {
  kind: GatewayErrorKind;
  /** Short, plain-language sentence safe to show a non-technical user. */
  message: string;
  /** Optional technical detail, shown behind a disclosure. */
  detail?: string;
  /** Which parameter caused the problem, when applicable. */
  param?: string;
}

/** Everything the client is allowed to know about the request that was sent. */
export interface RequestPreview {
  method: string;
  /** Secret values already replaced with `***`. */
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ExecutePagination {
  /** Max rows to return for this request. */
  limit?: number;
  /** Rows to skip (0-based). */
  offset?: number;
}

export interface ExecuteRequestBody {
  /** Run a saved object. Mutually exclusive with `operationId`. */
  objectId?: string;
  /** Run a bare operation, used by the API explorer's Try it panel. */
  operationId?: string;
  /** Explicit parameter values, keyed by parameter name. */
  params?: Record<string, unknown>;
  /** Request body for write operations. */
  body?: unknown;
  /** Dashboard filter values that bound parameters read from. */
  filters?: Record<string, unknown>;
  /**
   * Page of data to load. Applied to limit/offset/page params when the
   * endpoint or SQL supports them, and used as a hard row cap otherwise.
   */
  pagination?: ExecutePagination;
  origin?: RequestOrigin;
  /** Required for any non-GET call, so a stray click cannot mutate data. */
  confirmWrite?: boolean;
  /** Skip the response cache. */
  noCache?: boolean;
}

export interface ExecuteResponseBody {
  ok: boolean;
  status: number | null;
  durationMs: number;
  contentType: string | null;
  /** Normalized rows when the response is a collection. */
  rows?: Record<string, unknown>[];
  /** Fields beside the rows, e.g. the report date envelope. */
  envelope?: Record<string, unknown>;
  /** The raw parsed payload, for the Try it viewer and single-object reads. */
  data?: unknown;
  /** Column descriptors derived from the live payload, not just the schema. */
  fields?: FieldDescriptor[];
  responseKind?: ResponseKind;
  /** Number of rows returned in this page. */
  rowCount?: number;
  /** Limit applied to this response, when paging was requested. */
  limit?: number;
  /** Offset applied to this response, when paging was requested. */
  offset?: number;
  /**
   * True when more rows likely exist beyond this page (returned a full
   * page, or the result was truncated to the cap).
   */
  hasMore?: boolean;
  /** True when rows were cut down to the safety cap. */
  truncated?: boolean;
  cached?: boolean;
  error?: GatewayError;
  requestPreview?: RequestPreview;
}

/** How one operation parameter gets its value at run time. */
export type ParamBinding =
  | { mode: "static"; value: unknown }
  | { mode: "filter"; filterKey: string }
  | { mode: "credential" }
  | { mode: "prompt"; label?: string }
  | { mode: "selection"; field: string }
  | { mode: "omit" };

export type ParamBindings = Record<string, ParamBinding>;
