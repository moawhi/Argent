"use client";

import { useActionState } from "react";
import {
  resendVerificationAction,
  type AuthFormState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";

const initial: AuthFormState = {};

export function ResendVerificationForm({
  defaultEmail,
}: {
  defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          defaultValue={defaultEmail}
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
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
