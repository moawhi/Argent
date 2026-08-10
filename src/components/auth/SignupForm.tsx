"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type AuthFormState } from "@/app/login/actions";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";

const initial: AuthFormState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  if (state.message || state.needsVerification) {
    return (
      <div className="card space-y-4 border border-line p-6">
        {state.error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <div className="space-y-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-ink">
            <p>{state.message}</p>
            {state.linkUrl ? (
              <div className="space-y-2 rounded-md border border-line bg-surface p-2">
                <p className="break-all font-mono text-[11px] text-ink">
                  {state.linkUrl}
                </p>
                <CopyButton value={state.linkUrl} label="Copy link" />
              </div>
            ) : null}
          </div>
        ) : null}

        <ResendVerificationForm defaultEmail={state.email} />

        <p className="text-center text-sm text-ink-soft">
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="card space-y-4 border border-line p-6"
    >
      <Field label="Name">
        <Input
          name="name"
          autoComplete="name"
          required
          placeholder="Ada Lovelace"
        />
      </Field>

      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Password" hint="At least 8 characters.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Field label="Confirm password">
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      {state.error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
