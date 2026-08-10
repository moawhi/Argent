import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getSessionUser } from "@/server/auth/permissions";
import { redirectAfterAuth } from "@/server/auth/redirect";

export default async function ForgotPasswordPage() {
  const user = await getSessionUser();
  if (user) redirectAfterAuth(user);

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email to get a one-time reset link."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
