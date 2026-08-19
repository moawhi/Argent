"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createSiteAction } from "@/app/sites/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { listSiteTemplates } from "@/lib/sites/templates";
import { cn } from "@/lib/utils";

const TEMPLATES = listSiteTemplates();

export function NewSiteButton({
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
  const [templateKey, setTemplateKey] = useState("blank");
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createSiteAction({
        name,
        description,
        connectionId: connectionId || null,
        templateKey: templateKey || "blank",
      });

      if (!result.ok || !result.slug) {
        setError(result.error ?? "Could not create that site.");
        return;
      }

      setOpen(false);
      router.push(`/sites/${result.slug}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New site
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade-in relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-xl">
            <div>
              <h3 className="text-sm font-semibold">Create a site</h3>
              <p className="text-xs text-ink-soft">
                Start blank or from a template. Pages, a menu and tabs can be
                edited after.
              </p>
            </div>

            <Field label="Name">
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Campaign hub"
              />
            </Field>

            <Field label="Description" hint="Optional.">
              <Textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this site is for"
              />
            </Field>

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">Template</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => setTemplateKey(template.key)}
                    className={cn(
                      "rounded-lg border p-3 text-left",
                      templateKey === template.key
                        ? "border-brand bg-brand-soft/50"
                        : "border-line hover:bg-canvas",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      {template.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {connections.length > 0 ? (
              <Field
                label="API connection"
                hint="Optional. Data tiles in a template use objects from this connection when they exist."
              >
                <Select
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                >
                  <option value="">None</option>
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
