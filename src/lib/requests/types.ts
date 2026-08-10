export interface KeyValueEntry {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type BodyMode = "none" | "json" | "raw" | "form";

export type AuthMode = "inherit" | "none" | "bearer" | "basic" | "apiKey";

export interface AuthConfig {
  token?: string;
  username?: string;
  password?: string;
  /** For `apiKey`: the parameter name and where it goes. */
  keyName?: string;
  keyIn?: "query" | "header";
  keyValue?: string;
}

export interface ManualRequest {
  name: string;
  connectionId: string | null;
  method: string;
  url: string;
  queryParams: KeyValueEntry[];
  headers: KeyValueEntry[];
  bodyMode: BodyMode;
  body: string;
  authMode: AuthMode;
  authConfig: AuthConfig;
}

export const HTTP_METHOD_OPTIONS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export function emptyEntry(): KeyValueEntry {
  return { key: "", value: "", enabled: true };
}

export function emptyRequest(connectionId: string | null = null): ManualRequest {
  return {
    name: "",
    connectionId,
    method: "GET",
    url: "",
    queryParams: [emptyEntry()],
    headers: [emptyEntry()],
    bodyMode: "none",
    body: "",
    authMode: "inherit",
    authConfig: {},
  };
}

/** Finds every `{{name}}` placeholder in a request, for the variables hint. */
export function collectVariables(request: ManualRequest): string[] {
  const sources = [
    request.url,
    request.body,
    ...request.queryParams.flatMap((entry) => [entry.key, entry.value]),
    ...request.headers.flatMap((entry) => [entry.key, entry.value]),
  ];

  const found = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
      found.add(match[1]);
    }
  }

  return [...found];
}
