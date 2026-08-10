"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type AuthFormState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";

const initial: AuthFormState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initial,
  );

  return (
    <form
      action={formAction}
      className="card space-y-4 border border-line p-6"
    >
      <Field
        label="Email"
        hint="We will email a one-time reset link for that account."
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </Field>

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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Working…" : "Send reset link"}
      </Button>
    </form>
  );
}
