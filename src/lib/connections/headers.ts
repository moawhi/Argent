export interface ConnectionHeader {
  key: string;
  /** Empty for secret headers — their value lives in the encrypted vault. */
  value: string;
  enabled: boolean;
  /** Store the value encrypted and never send it back to the browser. */
  secret: boolean;
  description?: string;
}

/** Vault key prefix, so header secrets never collide with credential names. */
export const HEADER_SECRET_PREFIX = "header:";

export function headerSecretKey(name: string): string {
  return `${HEADER_SECRET_PREFIX}${name.toLowerCase()}`;
}

export function isHeaderSecretKey(key: string): boolean {
  return key.startsWith(HEADER_SECRET_PREFIX);
}

export function emptyHeader(): ConnectionHeader {
  return { key: "", value: "", enabled: true, secret: false };
}

/**
 * Headers the fetch layer owns. Letting a user set these either breaks the
 * request or is silently ignored, so we reject them with an explanation.
 */
const RESERVED = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
]);

const TOKEN = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;

/** Returns a problem with this header, or null when it is fine to send. */
export function validateHeader(header: ConnectionHeader): string | null {
  const name = header.key.trim();
  if (!name) return null;

  if (!TOKEN.test(name)) {
    return `“${name}” is not a valid header name. Use letters, numbers and dashes.`;
  }

  if (RESERVED.has(name.toLowerCase())) {
    return `${name} is set automatically and cannot be changed here.`;
  }

  if (/[\r\n]/.test(header.value)) {
    return `The value for ${name} cannot contain line breaks.`;
  }

  return null;
}
