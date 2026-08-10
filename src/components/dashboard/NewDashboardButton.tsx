"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createDashboardAction } from "@/app/dashboards/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";

export function NewDashboardButton({
  connections,
}: {
  connections: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createDashboardAction({
        name,
        description,
        connectionId: connectionId || null,
      });

      if (!result.ok || !result.slug) {
        setError(result.error ?? "Could not create that dashboard.");
        return;
      }

      setOpen(false);
      router.push(`/dashboards/${result.slug}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New dashboard
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade-in relative w-full max-w-md space-y-4 rounded-xl border border-line bg-surface p-5 shadow-xl">
            <div>
              <h3 className="text-sm font-semibold">Create a dashboard</h3>
              <p className="text-xs text-ink-soft">
                It starts with a date range filter that every chart can follow.
              </p>
            </div>

            <Field label="Name">
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Campaign performance"
              />
            </Field>

            <Field label="Description" hint="Optional.">
              <Textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this page is for"
              />
            </Field>

            {connections.length > 1 ? (
              <Field label="Mainly about which API?" hint="Optional. You can mix objects from any connection.">
                <Select
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                >
                  <option value="">No particular one</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {error ? <p className="text-xs text-danger">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={pending || !name.trim()}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
