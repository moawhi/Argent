"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import {
  createMcpTokenAction,
  disableMcpServerAction,
  enableMcpServerAction,
  revokeMcpTokenAction,
  setMcpToolsAction,
} from "@/app/connections/mcp-actions";
import { Button } from "@/components/ui/button";
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

export type McpOperationOption = {
  id: string;
  operationKey: string;
  method: string;
  path: string;
  summary: string | null;
  tags: string[];
};

export type McpTokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type Props = {
  connectionId: string;
  connectionName: string;
  enabled: boolean;
  selectedOperationIds: string[];
  operations: McpOperationOption[];
  tokens: McpTokenRow[];
};

function mcpEndpointUrl(connectionId: string): string {
  if (typeof window === "undefined") return `/api/mcp/${connectionId}`;
  return `${window.location.origin}/api/mcp/${connectionId}`;
}

function clientConfigSnippet(connectionId: string, tokenPlaceholder: string) {
  const url = mcpEndpointUrl(connectionId);
  return JSON.stringify(
    {
      mcpServers: {
        seeit: {
          url,
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

export function McpServerPanel({
  connectionId,
  connectionName,
  enabled,
  selectedOperationIds,
  operations,
  tokens,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedOperationIds),
  );
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"config" | "token" | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, McpOperationOption[]>();
    for (const op of operations) {
      const tag = op.tags[0] ?? "Uncategorized";
      const list = map.get(tag) ?? [];
      list.push(op);
      map.set(tag, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [operations]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(operations.map((op) => op.id)));
  }

  function selectNone() {
    setSelected(new Set());
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
    connectionId,
    freshToken ?? "seeit_mcp_YOUR_TOKEN",
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>MCP server</CardTitle>
            <p className="text-xs text-ink-soft">
              Host tools from this API for Cursor, Claude and other MCP
              clients. Credentials stay on seeIt&apos;s gateway.
            </p>
          </div>
          <Badge tone={enabled ? "positive" : "neutral"}>
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {enabled ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => disableMcpServerAction(connectionId))}
            >
              Disable
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => run(() => enableMcpServerAction(connectionId))}
            >
              Enable MCP server
            </Button>
          )}
          {pending ? (
            <Loader2 className="size-4 animate-spin text-ink-faint" />
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Field label="Tools">
              <p className="text-xs text-ink-faint">
                Choose which endpoints agents may call for{" "}
                <span className="font-medium text-ink">{connectionName}</span>.
              </p>
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAll}
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectNone}
              >
                None
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setMcpToolsAction(connectionId, [...selected]),
                  )
                }
              >
                Save tools
              </Button>
            </div>
          </div>

          <div className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-line bg-canvas/40 p-3">
            {groups.length === 0 ? (
              <p className="text-sm text-ink-faint">
                No operations on this connection yet.
              </p>
            ) : (
              groups.map(([tag, ops]) => (
                <div key={tag}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    {tag}
                  </p>
                  <ul className="space-y-1.5">
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
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-ink-soft" />
            <p className="text-sm font-medium">Access tokens</p>
          </div>
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
                    connectionId,
                    tokenName,
                  );
                  if (!result.ok || !result.rawToken) {
                    setError(result.error ?? "Could not create token.");
                    return;
                  }
                  setFreshToken(result.rawToken);
                  setTokenName("");
                  setMessage("Token created — copy it now; it won’t be shown again.");
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
            <p className="text-xs text-ink-faint">
              No active tokens yet. Create one to connect an MCP client.
            </p>
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
                      run(() =>
                        revokeMcpTokenAction(connectionId, token.id),
                      )
                    }
                    aria-label={`Revoke ${token.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
            <code className="font-mono">{mcpEndpointUrl(connectionId)}</code>
          </p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
            {snippet}
          </pre>
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : message ? (
          <p className="text-sm text-positive">{message}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
