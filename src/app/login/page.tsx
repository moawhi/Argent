import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { needsBootstrap } from "@/server/auth/bootstrap";
import { getSessionUser } from "@/server/auth/permissions";
import { publicSignupEnabled } from "@/server/auth/account";
import { redirectAfterAuth, safeNextPath } from "@/server/auth/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirectAfterAuth(user, params.next);

  const bootstrap = await needsBootstrap();
  const signupOpen = !bootstrap && (await publicSignupEnabled());
  const nextPath = safeNextPath(params.next);

  return (
    <AuthShell
      title={bootstrap ? "Create your admin account" : "Sign in"}
      subtitle={
        bootstrap
          ? "This is the first account on this Argent instance."
          : "Use the email and password for your Argent account."
      }
      footer={
        bootstrap ? null : (
          <p>
            {signupOpen ? (
              <>
                No account yet?{" "}
                <Link href="/signup" className="font-medium text-brand hover:underline">
                  Sign up
                </Link>
              </>
            ) : (
              "Ask an admin if you need an account."
            )}
          </p>
        )
      }
    >
      <LoginForm
        bootstrap={bootstrap}
        nextPath={nextPath}
        resetSuccess={params.reset === "1"}
        verifiedSuccess={params.verified === "1"}
      />
    </AuthShell>
  );
}
