import "server-only";

import { redirect } from "next/navigation";
import { needsOnboarding } from "@/server/auth/account";

/** Safe internal path only — blocks open redirects. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.startsWith("/login") || value.startsWith("/signup")) return null;
  if (
    value.startsWith("/forgot-password") ||
    value.startsWith("/reset-password") ||
    value.startsWith("/verify-email")
  ) {
    return null;
  }
  return value;
}

export function redirectAfterAuth(user: {
  mustChangePassword: boolean;
  onboardingCompletedAt: Date | null;
}, next?: string | null) {
  if (needsOnboarding(user)) {
    redirect("/onboarding");
  }
  const destination = safeNextPath(next) ?? "/";
  redirect(destination);
}
