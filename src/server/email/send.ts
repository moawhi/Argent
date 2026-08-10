import "server-only";

import { Resend } from "resend";

export function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/+$/, "") || "http://localhost:3000"
  );
}

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() || "seeIt <onboarding@resend.dev>"
  );
}

export type SendMailResult =
  | { ok: true; delivered: true }
  | { ok: true; delivered: false; reason: "no_api_key" }
  | { ok: false; error: string };

/**
 * Sends transactional email via Resend.
 * Without RESEND_API_KEY: in development returns delivered:false so callers can
 * surface the link in the UI; in production fails closed.
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error:
          "Email delivery is not configured. Set RESEND_API_KEY (and EMAIL_FROM) on this server.",
      };
    }
    return { ok: true, delivered: false, reason: "no_api_key" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (error) {
      return { ok: false, error: error.message || "Failed to send email." };
    }
    return { ok: true, delivered: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send email.",
    };
  }
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  token: string;
}): Promise<SendMailResult & { url: string }> {
  const url = `${appBaseUrl()}/verify-email?token=${encodeURIComponent(input.token)}`;
  const result = await sendMail({
    to: input.to,
    subject: "Verify your seeIt email",
    text: `Hi ${input.name},\n\nConfirm your seeIt account by opening this link (valid for 24 hours):\n\n${url}\n\nIf you did not sign up, you can ignore this message.`,
    html: `<p>Hi ${escapeHtml(input.name)},</p>
<p>Confirm your seeIt account by opening this link (valid for 24 hours):</p>
<p><a href="${url}">${url}</a></p>
<p>If you did not sign up, you can ignore this message.</p>`,
  });
  return { ...result, url };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  token: string;
}): Promise<SendMailResult & { url: string }> {
  const url = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
  const result = await sendMail({
    to: input.to,
    subject: "Reset your seeIt password",
    text: `Hi ${input.name},\n\nReset your seeIt password with this link (valid for one hour):\n\n${url}\n\nIf you did not request a reset, you can ignore this message.`,
    html: `<p>Hi ${escapeHtml(input.name)},</p>
<p>Reset your seeIt password with this link (valid for one hour):</p>
<p><a href="${url}">${url}</a></p>
<p>If you did not request a reset, you can ignore this message.</p>`,
  });
  return { ...result, url };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
