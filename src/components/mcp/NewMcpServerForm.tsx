"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMcpServerAction } from "@/app/mcp/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@/components/ui/primitives";

export function NewMcpServerForm({
  focusConnectionId,
}: {
  focusConnectionId?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Name your MCP server</CardTitle>
        <p className="text-xs text-ink-soft">
          You will pick tools from one or more API sets on the next screen.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ops agents"
            autoFocus
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button
          disabled={pending || !name.trim()}
          onClick={() => {
            setError(null);
            start(async () => {
              const result = await createMcpServerAction({ name });
              if (!result.ok || !result.id) {
                setError(result.error ?? "Could not create.");
                return;
              }
              const qs = focusConnectionId
                ? `?connection=${focusConnectionId}`
                : "";
              router.push(`/mcp/${result.id}${qs}`);
            });
          }}
        >
          {pending ? "Creating…" : "Create"}
        </Button>
      </CardBody>
    </Card>
  );
}
