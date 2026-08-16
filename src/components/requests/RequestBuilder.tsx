"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Save, Sparkles } from "lucide-react";
import {
  saveAsOperationAction,
  saveManualRequestAction,
  sendManualRequestAction,
} from "@/app/requests/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ResponseViewer } from "@/components/explorer/ResponseViewer";
import { KeyValueEditor } from "./KeyValueEditor";
import { cn } from "@/lib/utils";
import {
  collectVariables,
  emptyRequest,
  HTTP_METHOD_OPTIONS,
  type AuthMode,
  type BodyMode,
  type ManualRequest,
} from "@/lib/requests/types";
import type { ExecuteResponseBody } from "@/lib/gateway/types";

type Tab = "params" | "headers" | "body" | "auth";

export function RequestBuilder({
  connections,
  initial,
  savedRequestId,
}: {
  connections: {
    id: string;
    name: string;
    baseUrl: string;
    readOnly: boolean;
    secretKeys: string[];
    variableKeys: string[];
  }[];
  initial?: ManualRequest;
  savedRequestId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [request, setRequest] = useState<ManualRequest>(
    initial ?? emptyRequest(connections[0]?.id ?? null),
  );
  const [tab, setTab] = useState<Tab>("params");
  const [result, setResult] = useState<ExecuteResponseBody | null>(null);
  const [sending, setSending] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(savedRequestId);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmWrite, setConfirmWrite] = useState(false);

  const connection = connections.find(
    (entry) => entry.id === request.connectionId,
  );

  function update(patch: Partial<ManualRequest>) {
    setRequest((current) => ({ ...current, ...patch }));
  }

  const usedVariables = useMemo(() => collectVariables(request), [request]);
  const knownVariables = new Set([
    ...(connection?.secretKeys ?? []),
    ...(connection?.variableKeys ?? []),
  ]);
  const unknownVariables = usedVariables.filter(
    (name) => !knownVariables.has(name),
  );

  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(
    request.method.toUpperCase(),
  );

  async function send() {
    setSending(true);
    setNotice(null);
    const response = await sendManualRequestAction(request);
    setResult(response);
    setSending(false);
  }

  function save() {
    setNotice(null);
    startTransition(async () => {
      const saved = await saveManualRequestAction({
        id: savedId,
        request,
        lastStatus: result?.status ?? null,
        lastDurationMs: result?.durationMs ?? null,
      });

      if (!saved.ok) {
        setNotice(saved.error ?? "Could not save.");
        return;
      }

      setSavedId(saved.id);
      setNotice("Saved to your requests.");
      router.refresh();
    });
  }

  function promote() {
    if (!request.connectionId) {
      setNotice("Pick a connection first, so Argent knows where this belongs.");
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const promoted = await saveAsOperationAction({
        connectionId: request.connectionId!,
        request,
        sampleResponse: result?.data,
      });

      if (!promoted.ok) {
        setNotice(promoted.error ?? "Could not add this as an endpoint.");
        return;
      }

      router.push(
        `/objects/new?connection=${request.connectionId}&operation=${promoted.operationId}`,
      );
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <Input
            value={request.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Name this request, e.g. Daily commission report"
            className="min-w-56 flex-1"
          />
          {connections.length > 0 ? (
            <Select
              value={request.connectionId ?? ""}
              onChange={(event) =>
                update({ connectionId: event.target.value || null })
              }
              className="w-52"
            >
              <option value="">No connection</option>
              {connections.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2">
          <Select
            value={request.method}
            onChange={(event) => update({ method: event.target.value })}
            className="w-28 font-mono text-xs font-semibold"
          >
            {HTTP_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>

          <Input
            value={request.url}
            onChange={(event) => update({ url: event.target.value })}
            placeholder={
              connection
                ? `/api/accounts   (added to ${connection.baseUrl})`
                : "https://api.example.com/accounts"
            }
            className="flex-1 font-mono text-xs"
          />

          <Button
            onClick={() => (isWrite ? setConfirmWrite(true) : void send())}
            disabled={sending || !request.url.trim()}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Play />}
            Send
          </Button>
        </div>

        {connection ? (
          <p className="mt-2 text-[11px] text-ink-faint">
            Paths starting with <code className="font-mono">/</code> are added
            to <code className="font-mono">{connection.baseUrl}</code>.
            {request.authMode === "inherit" && connection.secretKeys.length > 0
              ? ` This connection's saved credentials are attached automatically.`
              : ""}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex gap-1 border-b border-line bg-canvas px-2 py-1.5">
          {(
            [
              ["params", `Params${countActive(request.queryParams)}`],
              ["headers", `Headers${countActive(request.headers)}`],
              ["body", "Body"],
              ["auth", "Auth"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "params" ? (
            <KeyValueEditor
              entries={request.queryParams}
              onChange={(queryParams) => update({ queryParams })}
              keyPlaceholder="Name"
              valuePlaceholder="Value"
              emptyHint="Values added to the end of the web address, after the ?"
            />
          ) : null}

          {tab === "headers" ? (
            <KeyValueEditor
              entries={request.headers}
              onChange={(headers) => update({ headers })}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
              emptyHint="Extra headers sent with the request, such as Accept or X-Request-Id."
            />
          ) : null}

          {tab === "body" ? (
            <div className="space-y-3">
              <Select
                value={request.bodyMode}
                onChange={(event) =>
                  update({ bodyMode: event.target.value as BodyMode })
                }
                className="h-8 w-44 text-xs"
              >
                <option value="none">No body</option>
                <option value="json">JSON</option>
                <option value="form">Form fields</option>
                <option value="raw">Plain text</option>
              </Select>

              {request.bodyMode !== "none" ? (
                <Textarea
                  rows={10}
                  value={request.body}
                  onChange={(event) => update({ body: event.target.value })}
                  placeholder={
                    request.bodyMode === "json"
                      ? '{\n  "name": "Example"\n}'
                      : request.bodyMode === "form"
                        ? "name=Example&status=active"
                        : "Anything you like"
                  }
                  className="font-mono text-xs"
                />
              ) : (
                <p className="text-xs text-ink-faint">
                  GET requests do not usually send a body.
                </p>
              )}
            </div>
          ) : null}

          {tab === "auth" ? (
            <AuthEditor
              request={request}
              onChange={update}
              connectionName={connection?.name}
              hasSecrets={(connection?.secretKeys.length ?? 0) > 0}
            />
          ) : null}
        </div>
      </Card>

      {usedVariables.length > 0 ? (
        <Card className="p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Placeholders in this request
          </p>
          <div className="flex flex-wrap gap-1.5">
            {usedVariables.map((name) => (
              <Badge
                key={name}
                tone={knownVariables.has(name) ? "positive" : "warning"}
              >
                {`{{${name}}}`}
              </Badge>
            ))}
          </div>
          {unknownVariables.length > 0 ? (
            <p className="mt-1.5 text-[11px] text-ink-soft">
              {unknownVariables.join(", ")}{" "}
              {unknownVariables.length === 1 ? "has" : "have"} no saved value, so{" "}
              {unknownVariables.length === 1 ? "it" : "they"} will be sent as
              written. Add {unknownVariables.length === 1 ? "it" : "them"} to the
              connection&apos;s credentials to fill{" "}
              {unknownVariables.length === 1 ? "it" : "them"} in automatically.
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-ink-soft">
              These are filled in on the server from this connection&apos;s saved
              values.
            </p>
          )}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {savedId ? "Update saved request" : "Save request"}
        </Button>

        <Button
          variant="ghost"
          onClick={promote}
          disabled={pending || !request.connectionId}
          title="Adds this as an endpoint so you can build tables and charts from it"
        >
          <Sparkles /> Turn into an endpoint
        </Button>

        {notice ? (
          <span className="text-xs text-ink-soft">{notice}</span>
        ) : null}
      </div>

      {result ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Response
          </h3>
          <ResponseViewer result={result} />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmWrite}
        destructive={request.method.toUpperCase() === "DELETE"}
        title={`Send a ${request.method} request?`}
        description="This is a real request to a real API and may change or remove data. Argent cannot undo it."
        confirmLabel={`Send ${request.method}`}
        onCancel={() => setConfirmWrite(false)}
        onConfirm={() => {
          setConfirmWrite(false);
          void send();
        }}
      />
    </div>
  );
}

function countActive(entries: { key: string; enabled: boolean }[]): string {
  const count = entries.filter((entry) => entry.enabled && entry.key.trim())
    .length;
  return count > 0 ? ` (${count})` : "";
}

function AuthEditor({
  request,
  onChange,
  connectionName,
  hasSecrets,
}: {
  request: ManualRequest;
  onChange: (patch: Partial<ManualRequest>) => void;
  connectionName?: string;
  hasSecrets: boolean;
}) {
  const auth = request.authConfig ?? {};

  function setAuth(patch: Partial<typeof auth>) {
    onChange({ authConfig: { ...auth, ...patch } });
  }

  return (
    <div className="space-y-3">
      <Field label="How should this request prove who you are?">
        <Select
          value={request.authMode}
          onChange={(event) =>
            onChange({ authMode: event.target.value as AuthMode })
          }
          className="h-8 w-64 text-xs"
        >
          <option value="inherit">
            Use the connection&apos;s saved credentials
          </option>
          <option value="none">No authentication</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Username and password</option>
          <option value="apiKey">API key</option>
        </Select>
      </Field>

      {request.authMode === "inherit" ? (
        <p className="rounded-md bg-canvas px-2.5 py-2 text-[11px] text-ink-soft">
          {hasSecrets
            ? `Argent attaches ${connectionName}'s saved credentials on the server. They never reach your browser.`
            : `${connectionName ?? "This connection"} has no saved credentials yet. Add them in the connection settings, or pick another option here.`}
        </p>
      ) : null}

      {request.authMode === "bearer" ? (
        <Field label="Token" hint="Sent as “Authorization: Bearer …”.">
          <Input
            type="password"
            autoComplete="off"
            value={auth.token ?? ""}
            onChange={(event) => setAuth({ token: event.target.value })}
            className="font-mono text-xs"
          />
        </Field>
      ) : null}

      {request.authMode === "basic" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username">
            <Input
              value={auth.username ?? ""}
              onChange={(event) => setAuth({ username: event.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="off"
              value={auth.password ?? ""}
              onChange={(event) => setAuth({ password: event.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {request.authMode === "apiKey" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <Input
              value={auth.keyName ?? ""}
              onChange={(event) => setAuth({ keyName: event.target.value })}
              placeholder="apikey"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Send it as">
            <Select
              value={auth.keyIn ?? "query"}
              onChange={(event) =>
                setAuth({ keyIn: event.target.value as "query" | "header" })
              }
            >
              <option value="query">Part of the web address</option>
              <option value="header">A header</option>
            </Select>
          </Field>
          <Field label="Value">
            <Input
              type="password"
              autoComplete="off"
              value={auth.keyValue ?? ""}
              onChange={(event) => setAuth({ keyValue: event.target.value })}
              className="font-mono text-xs"
            />
          </Field>
        </div>
      ) : null}

      {request.authMode !== "inherit" && request.authMode !== "none" ? (
        <p className="text-[11px] text-ink-faint">
          Values typed here are used for this request only and are stored in
          plain text if you save it. For anything long-lived, add it to the
          connection&apos;s credentials instead.
        </p>
      ) : null}
    </div>
  );
}
