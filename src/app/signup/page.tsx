import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { needsBootstrap } from "@/server/auth/bootstrap";
import { publicSignupEnabled } from "@/server/auth/account";
import { getSessionUser } from "@/server/auth/permissions";
import { redirectAfterAuth } from "@/server/auth/redirect";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirectAfterAuth(user);

  if (await needsBootstrap()) {
    redirect("/login");
  }

  if (!(await publicSignupEnabled())) {
    return (
      <AuthShell
        title="Sign-up is closed"
        subtitle="Public registration is turned off on this server."
        footer={
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="card border border-line p-6 text-sm text-ink-soft">
          Ask an admin to create an account for you under Users.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="We will email a verification link. After you confirm, sign in and finish a short setup."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
