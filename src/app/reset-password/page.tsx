import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getSessionUser } from "@/server/auth/permissions";
import { redirectAfterAuth } from "@/server/auth/redirect";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirectAfterAuth(user);

  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthShell
        title="Reset link missing"
        subtitle="Request a new password reset from the sign-in page."
        footer={
          <Link
            href="/forgot-password"
            className="font-medium text-brand hover:underline"
          >
            Request a reset link
          </Link>
        }
      >
        <div className="card border border-line p-6 text-sm text-ink-soft">
          No token was found in the address.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="This link works once and expires after an hour."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
