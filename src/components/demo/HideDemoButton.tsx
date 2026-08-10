"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { hideDemoAction, showDemoAction } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";

/** Soft-hide the bundled example for the current user (clients / non-admins). */
export function HideDemoButton({
  label = "Hide example",
  size = "sm",
  variant = "ghost",
}: {
  label?: string;
  size?: "sm" | "md" | "icon";
  variant?: "ghost" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          await hideDemoAction();
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <EyeOff />}
      {label}
    </Button>
  );
}

/** Restore a previously soft-hidden demo for this user. */
export function ShowDemoButton({
  label = "Show the example again",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await showDemoAction();
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Eye />}
      {label}
    </Button>
  );
}
