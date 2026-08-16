/**
 * Shared vocabulary between the spec importer, the gateway and the UI.
 * Deliberately kept free of server-only imports so client components can use it.
 */

export interface JsonSchema {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  nullable?: boolean;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  required?: string[];
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
}

export type ParameterLocation = "query" | "path" | "header" | "cookie";

/**
 * A semantic type is a display and input hint inferred from a field's name,
 * format and constraints. It is what lets a table know to render `balance` as
 * currency and `commissionRate` as a percentage without any configuration.
 */
export type SemanticType =
  | "id"
  | "currency"
  | "percent"
  | "datetime"
  | "date"
  | "time"
  | "duration"
  | "url"
  | "email"
  | "enum"
  | "boolean"
  | "integer"
  | "number"
  | "timezone"
  | "country"
  | "credential"
  | "text"
  | "longText"
  | "json"
  | "binary"
  | "unknown";

export type PrimitiveType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "unknown";

export interface ParameterDescriptor {
  name: string;
  in: ParameterLocation;
  required: boolean;
  description?: string;
  type: PrimitiveType;
  semantic: SemanticType;
  format?: string;
  enumValues?: string[];
  default?: unknown;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  /** True when the importer thinks this parameter carries a credential. */
  looksLikeCredential?: boolean;
}

/** One leaf (or notable branch) of a response or request schema. */
export interface FieldDescriptor {
  /** Dotted path relative to the row object, e.g. `transaction.amount`. */
  path: string;
  /** The final segment of `path`. */
  key: string;
  label: string;
  type: PrimitiveType;
  semantic: SemanticType;
  required: boolean;
  nullable: boolean;
  readOnly: boolean;
  description?: string;
  format?: string;
  enumValues?: string[];
  default?: unknown;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  /** Nesting depth; 0 for top-level fields of the row. */
  depth: number;
}

export type ResponseKind =
  | "collection"
  | "object"
  | "scalar"
  | "binary"
  | "empty"
  | "unknown";

/**
 * What an endpoint actually returns, reduced to the two questions the object
 * builder cares about: is it a list, and what are the columns?
 */
export interface ResponseShape {
  kind: ResponseKind;
  /**
   * Dotted path from the response root to the array of rows.
   * Empty string means the response root is itself the array.
   * `null` means there is no array.
   */
  rowsPath: string | null;
  /** Fields of a single row (or of the object, when `kind` is `object`). */
  fields: FieldDescriptor[];
  /**
   * Fields that sit beside the rows array, such as the `fromDate` / `toDate`
   * envelope on the sample report endpoints.
   */
  envelopeFields: FieldDescriptor[];
  contentType?: string;
}

export interface OperationSummary {
  id: string;
  operationKey: string;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  tags: string[];
  source: string;
  deprecated: boolean;
}

export interface NormalizedOperation {
  operationKey: string;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  tags: string[];
  params: ParameterDescriptor[];
  requestSchema: JsonSchema | null;
  requestContentType: string | null;
  responseSchema: JsonSchema | null;
  responseContentTypes: string[];
  successStatus: string | null;
  deprecated: boolean;
  sortOrder: number;
}

export interface SpecServer {
  url: string;
  description?: string;
}

/**
 * A parameter that appears on enough operations, with a credential-shaped
 * name, that we offer to store it once at the connection level.
 */
export interface CredentialCandidate {
  name: string;
  in: ParameterLocation;
  description?: string;
  /** How many operations require it. */
  occurrences: number;
  /** Share of operations that require it, 0-1. */
  coverage: number;
}

export interface IngestResult {
  title: string;
  version: string | null;
  description: string | null;
  openapiVersion: string | null;
  servers: SpecServer[];
  operations: NormalizedOperation[];
  tags: string[];
  credentialCandidates: CredentialCandidate[];
  warnings: string[];
}

export const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
