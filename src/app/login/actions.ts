"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import {
  changeOwnPassword,
  completeOnboarding,
  publicSignupEnabled,
  registerPublicUser,
  resendEmailVerification,
  resetPasswordWithToken,
  sendPasswordResetForEmail,
} from "@/server/auth/account";
import { createFirstAdmin, needsBootstrap } from "@/server/auth/bootstrap";
import { verifyPassword } from "@/server/auth/password";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/server/auth/session";
import { getSessionUser } from "@/server/auth/permissions";
import { redirectAfterAuth, safeNextPath } from "@/server/auth/redirect";
import { isThemeId, type ThemeId } from "@/lib/theme";

export type AuthFormState = {
  error?: string;
  message?: string;
  /** Dev fallback when Resend is not configured — verification or reset link. */
  linkUrl?: string;
  /** Email the verification / reset message was aimed at (for resend forms). */
  email?: string;
  /** True when the account exists but still needs email verification. */
  needsVerification?: boolean;
};

function nextFromForm(formData: FormData): string | null {
  return safeNextPath(String(formData.get("next") ?? ""));
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = nextFromForm(formData);

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "Invalid email or password." };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid email or password." };
  }

  if (!user.emailVerifiedAt) {
    return {
      error: "Verify your email before signing in. Check your inbox, or resend the link below.",
      needsVerification: true,
      email: user.email,
    };
  }

  await setSessionCookie(user.id);
  redirectAfterAuth(user, next);
  return {};
}

export async function bootstrapAdminAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!(await needsBootstrap())) {
    return { error: "An admin already exists. Sign in instead." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  try {
    const user = await createFirstAdmin({ name, email, password });
    await setSessionCookie(user.id);
    redirectAfterAuth(user);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create admin.",
    };
  }
  return {};
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (await needsBootstrap()) {
    return {
      error: "Create the first admin account from the sign-in page first.",
    };
  }
  if (!(await publicSignupEnabled())) {
    return { error: "Public sign-up is turned off on this server." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  try {
    const result = await registerPublicUser({ name, email, password });
    if (!result.ok) {
      return {
        error: result.error,
        needsVerification: true,
        email,
      };
    }
    return {
      message: result.delivered
        ? `Account created. We sent a verification link to ${result.email}. Open it, then sign in.`
        : `Account created. Email delivery is not configured locally, so use the verification link below (valid for 24 hours).`,
      linkUrl: result.url,
      email: result.email,
      needsVerification: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create account.",
    };
  }
}

export async function resendVerificationAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { error: "Enter your email to resend the verification link." };
  }

  const result = await resendEmailVerification(email);
  if (!result.ok) {
    return {
      error: result.error,
      needsVerification: true,
      email,
    };
  }

  return {
    message: result.delivered
      ? `If that email still needs verification, a new link is on its way to ${result.email}.`
      : `Email delivery is not configured locally — use the verification link below.`,
    linkUrl: result.url,
    email: result.email,
    needsVerification: true,
  };
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { error: "Enter the email on your account." };
  }

  const result = await sendPasswordResetForEmail(email);
  if (!result.ok) {
    return { error: result.error };
  }

  // Always show a success-shaped response so emails cannot be enumerated.
  return {
    message: result.delivered
      ? "If that email is registered, a reset link is on its way. Check your inbox."
      : "If that email is registered, a reset link is ready. Email delivery is not configured locally, so the link is shown below once.",
    linkUrl: result.url,
  };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) {
    return { error: "Missing reset token. Request a new link." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) return { error: result.error };

  redirect("/login?reset=1");
  return {};
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function saveThemeAction(theme: ThemeId) {
  if (!isThemeId(theme)) return;
  const user = await getSessionUser();
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { theme },
  });
}

export async function onboardingSaveProfileAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter your name." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  });

  return { message: "saved" };
}

export async function onboardingChangePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  try {
    await changeOwnPassword(
      user.id,
      user.mustChangePassword ? null : current || null,
      password,
    );
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update password.",
    };
  }

  return { message: "saved" };
}

export async function onboardingSaveThemeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const theme = String(formData.get("theme") ?? "");
  if (!isThemeId(theme)) return { error: "Pick a valid appearance." };

  await prisma.user.update({
    where: { id: user.id },
    data: { theme },
  });

  return { message: "saved" };
}

export async function onboardingCompleteAction(
  nextPath?: string,
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Re-read mustChangePassword from DB in case they just changed it.
  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });
  if (fresh.mustChangePassword) {
    return {
      error: "Choose a new password before finishing onboarding.",
    };
  }

  await completeOnboarding(user.id);
  redirect(safeNextPath(nextPath) ?? "/");
}

export async function onboardingCompleteAndLoadDemoAction(): Promise<
  AuthFormState & {
    mcp?: {
      serverId: string;
      slug: string;
      name: string;
      rawToken: string;
      dashboardSlug: string;
    };
  }
> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });
  if (fresh.mustChangePassword) {
    return {
      error: "Choose a new password before finishing onboarding.",
    };
  }

  await completeOnboarding(user.id);

  const { seedDemo } = await import("@/server/demo/seed");
  const { seedSampleMcpWithToken } = await import("@/server/mcp/sample");
  const { revalidatePath } = await import("next/cache");
  try {
    const result = await seedDemo(user.id);
    const mcp = await seedSampleMcpWithToken(user.id);
    revalidatePath("/");
    revalidatePath("/connections");
    revalidatePath("/dashboards");
    revalidatePath("/sites");
    revalidatePath("/objects");
    revalidatePath("/mcp");
    return {
      message: "demo-ready",
      mcp: {
        serverId: mcp.serverId,
        slug: mcp.slug,
        name: mcp.name,
        rawToken: mcp.rawToken,
        dashboardSlug: result.dashboardSlug,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The demo could not be installed.",
    };
  }
}
