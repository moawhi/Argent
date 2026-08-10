import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.APP_MASTER_KEY;
  if (!raw) {
    throw new Error(
      "APP_MASTER_KEY is not set. Generate one with:\n" +
        `  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `APP_MASTER_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
        "It should be a base64 encoded 32 byte random value.",
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Returns whether a usable master key is configured, without throwing. The UI
 * uses this to show a setup warning instead of crashing.
 */
export function hasMasterKey(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a UTF-8 string. Output layout is `iv:tag:ciphertext`, each part
 * base64 encoded, so the whole blob fits in a single text column.
 */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptString(blob: string): string {
  const parts = blob.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext: expected three base64 sections.");
  }

  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const data = Buffer.from(dataPart, "base64");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed ciphertext: bad IV or auth tag length.");
  }

  const decipher = createDecipheriv(ALGORITHM, masterKey(), iv);
  decipher.setAuthTag(tag);

  // Throws if the auth tag does not verify, which also covers a rotated key.
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export type SecretBag = Record<string, string>;

export function encryptSecrets(secrets: SecretBag): string {
  return encryptString(JSON.stringify(secrets));
}

/**
 * Decrypts a secret bag. Returns an empty bag for missing input, and rethrows
 * with a clearer message when the key no longer matches.
 */
export function decryptSecrets(blob: string | null | undefined): SecretBag {
  if (!blob) return {};

  try {
    const parsed: unknown = JSON.parse(decryptString(blob));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const out: SecretBag = {};
    for (const [key, value] of Object.entries(parsed as SecretBag)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch (error) {
    if (error instanceof Error && /unable to authenticate/i.test(error.message)) {
      throw new Error(
        "Stored credentials could not be decrypted. This usually means " +
          "APP_MASTER_KEY changed since they were saved. Re-enter the " +
          "credentials for this connection.",
      );
    }
    throw error;
  }
}

/** Constant-time string comparison, for anything that gates access. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Replaces every secret value found in `text` with `***`. */
export function redact(text: string, secrets: SecretBag): string {
  let out = text;
  // Longest first, so a secret that contains another is masked as a whole.
  const values = Object.values(secrets)
    .filter((value) => value && value.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const value of values) {
    out = out.split(value).join("***");
  }
  return out;
}

/**
 * Masks a URL for display. Only whole query-parameter values are replaced, so
 * a short secret that also happens to appear in the path — `demo` in
 * `/api/demo/accounts` — does not turn the address into nonsense.
 */
export function redactUrl(url: URL | string, secrets: SecretBag): string {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
  } catch {
    return redact(String(url), secrets);
  }

  const values = new Set(
    Object.values(secrets).filter((value) => value.length > 0),
  );
  if (values.size === 0) return parsed.toString();

  for (const [key, value] of [...parsed.searchParams]) {
    if (values.has(value)) parsed.searchParams.set(key, "***");
  }

  if (parsed.username || parsed.password) {
    if (values.has(parsed.username)) parsed.username = "***";
    if (values.has(parsed.password)) parsed.password = "***";
  }

  return parsed.toString();
}
