"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  bootstrapAdminAction,
  loginAction,
  resendVerificationAction,
  type AuthFormState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";

const initial: AuthFormState = {};

export function LoginForm({
  bootstrap,
  nextPath,
  resetSuccess,
  verifiedSuccess,
}: {
  bootstrap: boolean;
  nextPath?: string | null;
  resetSuccess?: boolean;
  verifiedSuccess?: boolean;
}) {
  const action = bootstrap ? bootstrapAdminAction : loginAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationAction,
    initial,
  );

  const verificationEmail =
    (state.needsVerification && state.email) ||
    resendState.email ||
    undefined;

  return (
    <div className="space-y-3">
      <form
        action={formAction}
        className="card space-y-4 border border-line p-6"
      >
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

        {resetSuccess ? (
          <p className="rounded-lg bg-positive-soft px-3 py-2 text-sm text-positive">
            Password updated. Sign in with your new password.
          </p>
        ) : null}

        {verifiedSuccess ? (
          <p className="rounded-lg bg-positive-soft px-3 py-2 text-sm text-positive">
            Email verified. You can sign in now.
          </p>
        ) : null}

        {bootstrap ? (
          <Field label="Name">
            <Input
              name="name"
              autoComplete="name"
              required
              placeholder="Ada Lovelace"
            />
          </Field>
        ) : null}

        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            defaultValue={verificationEmail}
          />
        </Field>

        <Field label="Password">
          <Input
            name="password"
            type="password"
            autoComplete={bootstrap ? "new-password" : "current-password"}
            required
            minLength={bootstrap ? 8 : undefined}
          />
        </Field>

        {bootstrap ? (
          <Field label="Confirm password">
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
        ) : null}

        {state.error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : bootstrap
              ? "Create admin account"
              : "Sign in"}
        </Button>

        {!bootstrap ? (
          <p className="text-center text-xs text-ink-soft">
            <Link href="/forgot-password" className="text-brand hover:underline">
              Forgot password?
            </Link>
          </p>
        ) : null}
      </form>

      {verificationEmail ? (
        <form
          action={resendAction}
          className="card space-y-3 border border-line p-4"
        >
          <input type="hidden" name="email" value={verificationEmail} />
          {resendState.message ? (
            <div className="space-y-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-ink">
              <p>{resendState.message}</p>
              {resendState.linkUrl ? (
                <div className="space-y-2 rounded-md border border-line bg-surface p-2">
                  <p className="break-all font-mono text-[11px] text-ink">
                    {resendState.linkUrl}
                  </p>
                  <CopyButton value={resendState.linkUrl} label="Copy link" />
                </div>
              ) : null}
            </div>
          ) : null}
          {resendState.error ? (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {resendState.error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={resendPending}
          >
            {resendPending ? "Sending…" : "Resend verification email"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
