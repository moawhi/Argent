"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Boxes,
  Check,
  LayoutDashboard,
  Plug,
  ShieldCheck,
} from "lucide-react";
import {
  onboardingChangePasswordAction,
  onboardingCompleteAction,
  onboardingSaveProfileAction,
  onboardingSaveThemeAction,
  type AuthFormState,
} from "@/app/login/actions";
import { SeeItLogo } from "@/components/brand/SeeItLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { THEME_OPTIONS, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

const initial: AuthFormState = {};

const PRODUCT_STEPS = [
  {
    icon: Plug,
    title: "Connect an API or database",
    body: "Import OpenAPI, or connect Postgres, MariaDB or ClickHouse. Credentials stay encrypted on the server.",
  },
  {
    icon: Boxes,
    title: "Build objects from the data",
    body: "Turn endpoints into tables, charts, number cards and forms with a live preview.",
  },
  {
    icon: LayoutDashboard,
    title: "Arrange a dashboard",
    body: "Drop tiles on a grid, share filters across them, and keep large result sets paging smoothly.",
  },
  {
    icon: ShieldCheck,
    title: "Keys never reach the browser",
    body: "Every upstream call goes through seeIt's gateway — CORS and secrets stay off your clients.",
  },
];

type StepId = "profile" | "password" | "theme" | "product" | "finish";

export function OnboardingWizard({
  name,
  email,
  mustChangePassword,
  theme,
}: {
  name: string;
  email: string;
  mustChangePassword: boolean;
  theme: ThemeId;
}) {
  const { setTheme } = useTheme();
  const [step, setStep] = useState<StepId>(
    mustChangePassword ? "password" : "profile",
  );
  const [productIndex, setProductIndex] = useState(0);
  const [passwordDone, setPasswordDone] = useState(!mustChangePassword);

  const steps: { id: StepId; label: string }[] = [
    { id: "profile", label: "Profile" },
    ...(mustChangePassword || !passwordDone
      ? [{ id: "password" as const, label: "Password" }]
      : []),
    { id: "theme", label: "Look" },
    { id: "product", label: "Tour" },
    { id: "finish", label: "Done" },
  ];

  const visibleSteps = mustChangePassword
    ? steps
    : steps.filter((entry) => entry.id !== "password" || !passwordDone);

  return (
    <div className="landing mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <SeeItLogo size="lg" variant="pastel" />
        <p className="mt-2 text-sm text-ink-soft">Welcome, {name.split(" ")[0]}</p>
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-1.5">
        {visibleSteps.map((entry) => {
          const active = entry.id === step;
          const reached =
            visibleSteps.findIndex((s) => s.id === step) >=
            visibleSteps.findIndex((s) => s.id === entry.id);
          return (
            <span
              key={entry.id}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium",
                active
                  ? "bg-brand-soft text-brand-ink"
                  : reached
                    ? "text-ink-soft"
                    : "text-ink-faint",
              )}
            >
              {entry.label}
            </span>
          );
        })}
      </div>

      <div className="card space-y-5 border border-line p-6">
        {step === "profile" ? (
          <ProfileStep
            defaultName={name}
            email={email}
            onNext={() =>
              setStep(mustChangePassword && !passwordDone ? "password" : "theme")
            }
          />
        ) : null}

        {step === "password" ? (
          <PasswordStep
            force={mustChangePassword}
            onNext={() => {
              setPasswordDone(true);
              setStep("theme");
            }}
          />
        ) : null}

        {step === "theme" ? (
          <ThemeStep
            initialTheme={theme}
            onTheme={setTheme}
            onBack={() =>
              setStep(mustChangePassword && !passwordDone ? "password" : "profile")
            }
            onNext={() => setStep("product")}
          />
        ) : null}

        {step === "product" ? (
          <ProductStep
            index={productIndex}
            onIndex={setProductIndex}
            onBack={() => setStep("theme")}
            onNext={() => setStep("finish")}
          />
        ) : null}

        {step === "finish" ? <FinishStep onBack={() => setStep("product")} /> : null}
      </div>
    </div>
  );
}

function ProfileStep({
  defaultName,
  email,
  onNext,
}: {
  defaultName: string;
  email: string;
  onNext: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    onboardingSaveProfileAction,
    initial,
  );

  useEffect(() => {
    if (state.message === "saved") onNext();
  }, [state.message, onNext]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Confirm your profile</h2>
        <p className="mt-1 text-sm text-ink-soft">
          This name appears in the sidebar and on shared dashboards.
        </p>
      </div>
      <Field label="Name">
        <Input name="name" defaultValue={defaultName} required />
      </Field>
      <Field label="Email">
        <Input value={email} disabled readOnly />
      </Field>
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function PasswordStep({
  force,
  onNext,
}: {
  force: boolean;
  onNext: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    onboardingChangePasswordAction,
    initial,
  );

  useEffect(() => {
    if (state.message === "saved") onNext();
  }, [state.message, onNext]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          {force ? "Choose your own password" : "Update your password"}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {force
            ? "An admin set a temporary password. Pick one only you know."
            : "Optional — you can skip if you already like your password."}
        </p>
      </div>

      {!force ? (
        <Field label="Current password">
          <Input
            name="current"
            type="password"
            autoComplete="current-password"
          />
        </Field>
      ) : null}

      <Field label="New password" hint="At least 8 characters.">
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
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        {!force ? (
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onNext}
          >
            Skip
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </div>
    </form>
  );
}

function ThemeStep({
  initialTheme,
  onTheme,
  onBack,
  onNext,
}: {
  initialTheme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<ThemeId>(initialTheme);
  const [state, formAction, pending] = useActionState(
    onboardingSaveThemeAction,
    initial,
  );

  useEffect(() => {
    if (state.message === "saved") onNext();
  }, [state.message, onNext]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Pick an appearance</h2>
        <p className="mt-1 text-sm text-ink-soft">
          You can change this later in Settings.
        </p>
      </div>

      <input type="hidden" name="theme" value={selected} />

      <div className="grid gap-1.5">
        {THEME_OPTIONS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelected(option.id);
                onTheme(option.id);
              }}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-brand bg-brand-soft"
                  : "border-line hover:bg-canvas",
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-[11px] text-ink-faint">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

function ProductStep({
  index,
  onIndex,
  onBack,
  onNext,
}: {
  index: number;
  onIndex: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const step = PRODUCT_STEPS[index];
  const Icon = step.icon;
  const last = index === PRODUCT_STEPS.length - 1;

  return (
    <div className="space-y-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
      </div>

      <div className="flex gap-1.5" aria-hidden>
        {PRODUCT_STEPS.map((entry, position) => (
          <button
            key={entry.title}
            type="button"
            onClick={() => onIndex(position)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              position === index ? "w-6 bg-brand" : "w-1.5 bg-line",
            )}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={() => (index === 0 ? onBack() : onIndex(index - 1))}
        >
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => (last ? onNext() : onIndex(index + 1))}
        >
          {last ? "Continue" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function FinishStep({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-positive-soft text-positive">
        <Check className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold">You are ready</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Load the bundled example to explore a finished dashboard, or jump
          straight into connecting your own API.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            start(async () => {
              const { onboardingCompleteAndLoadDemoAction } = await import(
                "@/app/login/actions"
              );
              const result = await onboardingCompleteAndLoadDemoAction();
              if (result?.error) setError(result.error);
            });
          }}
        >
          {pending ? "Setting up…" : "Load the example"}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await onboardingCompleteAction("/connections/new");
              if (result?.error) setError(result.error);
            });
          }}
        >
          Connect my own API
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await onboardingCompleteAction("/");
              if (result?.error) setError(result.error);
            });
          }}
        >
          Go to seeIt
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
          Back
        </Button>
      </div>
    </div>
  );
}
