import "server-only";

import { createHash, randomBytes } from "crypto";

const TOKEN_PREFIX = "seeit_mcp_";
const RAW_BYTES = 24;

export function hashMcpToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function mintMcpToken(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const raw = `${TOKEN_PREFIX}${randomBytes(RAW_BYTES).toString("base64url")}`;
  return {
    raw,
    hash: hashMcpToken(raw),
    prefix: raw.slice(0, 16),
  };
}

export function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}
