import "server-only";

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { ensureDefaultRoles } from "@/server/auth/roles";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/server/email/send";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** Minimum gap between verification email resends for the same user. */
const RESEND_COOLDOWN_MS = 60 * 1000;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createRawResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates a reset token for an active user. Always succeeds from the caller's
 * perspective for unknown emails (to avoid account enumeration); returns null
 * when no user matched.
 */
export async function issuePasswordReset(
  email: string,
): Promise<{ token: string; userId: string; name: string; email: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.active) return null;

  const token = createRawResetToken();
  const tokenHash = hashResetToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  return { token, userId: user.id, name: user.name, email: user.email };
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

export async function publicSignupEnabled(): Promise<boolean> {
  const flag = process.env.ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  // Default on once an admin exists (bootstrap still owns the empty DB).
  return true;
}

export async function signupDefaultRoleKey(): Promise<string> {
  const key = process.env.SIGNUP_DEFAULT_ROLE?.trim().toLowerCase();
  if (key === "admin" || key === "dev" || key === "sales" || key === "client") {
    return key === "admin" ? "dev" : key; // never self-serve admin
  }
  return "client";
}

export type IssueEmailResult =
  | { ok: true; delivered: boolean; url?: string; email: string }
  | { ok: false; error: string };

async function createVerificationToken(userId: string): Promise<string> {
  // Invalidate prior unused tokens so only the newest link works.
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = createRawResetToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });
  return token;
}

export async function issueEmailVerification(
  userId: string,
): Promise<IssueEmailResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    return { ok: false, error: "Account not found." };
  }
  if (user.emailVerifiedAt) {
    return { ok: false, error: "This email is already verified. Sign in." };
  }

  const recent = await prisma.emailVerificationToken.findFirst({
    where: {
      userId,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return {
      ok: false,
      error: "Please wait a minute before requesting another verification email.",
    };
  }

  const token = await createVerificationToken(userId);
  const sent = await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token,
  });

  if (!sent.ok) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    return { ok: false, error: sent.error };
  }

  return {
    ok: true,
    delivered: sent.delivered,
    url: sent.delivered ? undefined : sent.url,
    email: user.email,
  };
}

export async function verifyEmailWithToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This verification link is invalid or has expired.",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

/**
 * Public sign-up: create unverified user and send a verification email.
 * Does not create a session — the user must verify, then sign in.
 */
export async function registerPublicUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<IssueEmailResult> {
  if (!(await publicSignupEnabled())) {
    throw new Error("Public sign-up is turned off.");
  }

  await ensureDefaultRoles();
  const count = await prisma.user.count();
  if (count === 0) {
    throw new Error("Create the first admin account from the sign-in page.");
  }

  const roleKey = await signupDefaultRoleKey();
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });

  const existing = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
  });
  if (existing) {
    throw new Error("An account with that email already exists. Sign in instead.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      roleId: role.id,
      active: true,
      mustChangePassword: false,
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
    },
  });

  const token = await createVerificationToken(user.id);
  const sent = await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token,
  });

  if (!sent.ok) {
    // Drop the unused token so an immediate resend is not blocked by cooldown.
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    return { ok: false, error: sent.error };
  }

  return {
    ok: true,
    delivered: sent.delivered,
    url: sent.delivered ? undefined : sent.url,
    email: user.email,
  };
}

/**
 * Resend verification for an unverified account. Avoids confirming whether the
 * email exists when the password is wrong or the account is already verified.
 */
export async function resendEmailVerification(
  email: string,
): Promise<IssueEmailResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Generic success when we should not leak account state.
  if (!user || !user.active) {
    return {
      ok: true,
      delivered: true,
      email: email.trim().toLowerCase(),
    };
  }
  if (user.emailVerifiedAt) {
    return {
      ok: false,
      error: "This email is already verified. Sign in.",
    };
  }

  return issueEmailVerification(user.id);
}

export async function sendPasswordResetForEmail(
  email: string,
): Promise<
  | { ok: true; delivered: boolean; url?: string }
  | { ok: false; error: string }
> {
  const issued = await issuePasswordReset(email);
  // Always succeed from the caller's perspective for unknown emails.
  if (!issued) {
    return { ok: true, delivered: true };
  }

  const sent = await sendPasswordResetEmail({
    to: issued.email,
    name: issued.name,
    token: issued.token,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return {
    ok: true,
    delivered: sent.delivered,
    url: sent.delivered ? undefined : sent.url,
  };
}

export function needsOnboarding(user: {
  mustChangePassword: boolean;
  onboardingCompletedAt: Date | null;
}): boolean {
  return user.mustChangePassword || user.onboardingCompletedAt === null;
}

export async function completeOnboarding(
  userId: string,
  data: { name?: string; theme?: string } = {},
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.theme ? { theme: data.theme } : {}),
      onboardingCompletedAt: new Date(),
    },
  });
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string | null,
  nextPassword: string,
) {
  if (nextPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (currentPassword !== null) {
    const { verifyPassword } = await import("@/server/auth/password");
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new Error("Current password is incorrect.");
  }

  const passwordHash = await hashPassword(nextPassword);
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });
}
