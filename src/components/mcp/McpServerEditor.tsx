"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import {
  createMcpTokenAction,
  deleteMcpServerAction,
  revokeMcpTokenAction,
  setMcpToolsAction,
  updateMcpServerAction,
} from "@/app/mcp/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SampleMcpUsage } from "@/components/mcp/SampleMcpUsage";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  MethodBadge,
} from "@/components/ui/primitives";
import { mcpClientKey } from "@/lib/brand";

export type McpPickerOperation = {
  id: string;
  operationKey: string;
  method: string;
  path: string;
  summary: string | null;
  tags: string[];
  connectionId: string;
  connectionName: string;
  connectionSlug: string;
};

export type McpTokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type Props = {
  server: {
    id: string;
    name: string;
    slug: string;
    enabled: boolean;
    isSample: boolean;
  };
  selectedOperationIds: string[];
  operations: McpPickerOperation[];
  tokens: McpTokenRow[];
  /** Prefocus a connection group in the picker. */
  focusConnectionId?: string | null;
};

function mcpEndpointUrl(slug: string): string {
  if (typeof window === "undefined") return `/api/mcp/${slug}`;
  return `${window.location.origin}/api/mcp/${slug}`;
}

function clientConfigSnippet(slug: string, tokenPlaceholder: string) {
  return JSON.stringify(
    {
      mcpServers: {
        [mcpClientKey(slug)]: {
          url: mcpEndpointUrl(slug),
          headers: {
            Authorization: `Bearer ${tokenPlaceholder}`,
          },
        },
      },
    },
    null,
    2,
  );
}

export function McpServerEditor({
  server,
  selectedOperationIds,
  operations,
  tokens,
  focusConnectionId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(server.name);
  const [enabled, setEnabled] = useState(server.enabled);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedOperationIds),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (focusConnectionId) initial.add(focusConnectionId);
    else if (operations[0]) initial.add(operations[0].connectionId);
    return initial;
  });
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"config" | "token" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const byConnection = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; slug: string; ops: McpPickerOperation[] }
    >();
    for (const op of operations) {
      const entry = map.get(op.connectionId) ?? {
        id: op.connectionId,
        name: op.connectionName,
        slug: op.connectionSlug,
        ops: [],
      };
      entry.ops.push(op);
      map.set(op.connectionId, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [operations]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleConnection(connectionId: string, ops: McpPickerOperation[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ops.every((op) => next.has(op.id));
      for (const op of ops) {
        if (allOn) next.delete(op.id);
        else next.add(op.id);
      }
      return next;
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  async function copyText(kind: "config" | "token", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  }

  const snippet = clientConfigSnippet(
    server.slug,
    freshToken ?? "argent_mcp_YOUR_TOKEN",
  );

  return (
    <div className="space-y-5">
      {server.isSample ? <SampleMcpUsage /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Server</CardTitle>
              <p className="text-xs text-ink-soft">
                Slug{" "}
                <code className="font-mono text-[11px]">{server.slug}</code>
                {server.isSample ? (
                  <>
                    {" "}
                    · <Badge tone="brand">Sample</Badge>
                  </>
                ) : null}
              </p>
            </div>
            <Badge tone={enabled ? "positive" : "neutral"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateMcpServerAction(server.id, { name, enabled }),
                )
              }
            >
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                const next = !enabled;
                setEnabled(next);
                run(() =>
                  updateMcpServerAction(server.id, { enabled: next }),
                );
              }}
            >
              {enabled ? "Disable" : "Enable"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            {pending ? (
              <Loader2 className="size-4 animate-spin text-ink-faint" />
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle>Tools from API sets</CardTitle>
              <p className="text-xs text-ink-soft">
                Pick endpoints from any connected API. Agents only see what you
                enable here.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => setMcpToolsAction(server.id, [...selected]))
              }
            >
              Save tools
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {byConnection.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No API connections yet. Import an OpenAPI spec first.
            </p>
          ) : (
            byConnection.map((group) => {
              const open = expanded.has(group.id);
              const selectedCount = group.ops.filter((op) =>
                selected.has(op.id),
              ).length;
              const tags = new Map<string, McpPickerOperation[]>();
              for (const op of group.ops) {
                const tag = op.tags[0] ?? "Uncategorized";
                const list = tags.get(tag) ?? [];
                list.push(op);
                tags.set(tag, list);
              }

              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-line bg-canvas/40"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left text-sm font-medium"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                    >
                      {group.name}{" "}
                      <span className="font-normal text-ink-faint">
                        ({selectedCount}/{group.ops.length})
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleConnection(group.id, group.ops)}
                    >
                      {selectedCount === group.ops.length
                        ? "Clear"
                        : "Select all"}
                    </Button>
                  </div>
                  {open ? (
                    <div className="max-h-80 space-y-3 overflow-y-auto p-3">
                      {[...tags.entries()].map(([tag, ops]) => (
                        <div key={tag}>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                            {tag}
                          </p>
                          <ul className="space-y-1">
                            {ops.map((op) => (
                              <li key={op.id}>
                                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas">
                                  <Checkbox
                                    checked={selected.has(op.id)}
                                    onChange={() => toggle(op.id)}
                                    className="mt-0.5"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2 text-sm">
                                      <MethodBadge method={op.method} />
                                      <span className="font-mono text-xs text-ink-soft">
                                        {op.path}
                                      </span>
                                    </span>
                                    <span className="block text-xs text-ink-faint">
                                      {op.summary ?? op.operationKey}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-ink-soft" />
            <CardTitle>Access tokens</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Token name (e.g. Cursor)"
              className="max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await createMcpTokenAction(
                    server.id,
                    tokenName,
                  );
                  if (!result.ok || !result.rawToken) {
                    setError(result.error ?? "Could not create token.");
                    return;
                  }
                  setFreshToken(result.rawToken);
                  setTokenName("");
                  setMessage(
                    "Token created — copy it now; it won’t be shown again.",
                  );
                  router.refresh();
                });
              }}
            >
              Create token
            </Button>
          </div>

          {freshToken ? (
            <div className="rounded-xl border border-line bg-canvas p-3">
              <p className="text-xs text-ink-soft">New token (shown once)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all font-mono text-xs">{freshToken}</code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText("token", freshToken)}
                >
                  {copied === "token" ? <Check /> : <Copy />}
                  Copy
                </Button>
              </div>
            </div>
          ) : null}

          {tokens.length === 0 ? (
            <p className="text-xs text-ink-faint">No active tokens yet.</p>
          ) : (
            <ul className="space-y-2">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{token.name}</p>
                    <p className="font-mono text-[11px] text-ink-faint">
                      {token.tokenPrefix}…
                      {token.lastUsedAt
                        ? ` · last used ${new Date(token.lastUsedAt).toLocaleString()}`
                        : " · never used"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => revokeMcpTokenAction(server.id, token.id))
                    }
                    aria-label={`Revoke ${token.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Client config</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copyText("config", snippet)}
              >
                {copied === "config" ? <Check /> : <Copy />}
                Copy JSON
              </Button>
            </div>
            <p className="text-xs text-ink-faint">
              Endpoint:{" "}
              <code className="font-mono">{mcpEndpointUrl(server.slug)}</code>
            </p>
            <pre className="overflow-x-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
              {snippet}
            </pre>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : message ? (
        <p className="text-sm text-positive">{message}</p>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this MCP server?"
        description="Tokens stop working immediately. Tools are removed from this pack; your API connections stay."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          startTransition(async () => {
            const result = await deleteMcpServerAction(server.id);
            if (!result.ok) {
              setError(result.error ?? "Could not delete.");
              return;
            }
            router.push("/mcp");
          });
        }}
      />
    </div>
  );
}
