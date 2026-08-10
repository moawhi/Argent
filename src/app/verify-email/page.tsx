import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { verifyEmailWithToken } from "@/server/auth/account";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() || "";

  if (token) {
    const result = await verifyEmailWithToken(token);
    if (result.ok) {
      redirect("/login?verified=1");
    }

    return (
      <AuthShell
        title="Verification failed"
        subtitle="This link is invalid or has expired."
        footer={
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="card space-y-4 border border-line p-6">
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {result.error}
          </p>
          <ResendVerificationForm />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the email you used to sign up to get a new verification link."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="card space-y-4 border border-line p-6">
        <ResendVerificationForm />
      </div>
    </AuthShell>
  );
}
