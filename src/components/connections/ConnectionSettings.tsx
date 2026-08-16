"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  PlugZap,
  Trash2,
} from "lucide-react";
import {
  deleteConnectionAction,
  saveConnectionHeadersAction,
  saveCredentialsAction,
  saveTokenAuthAction,
  testConnectionAction,
  updateConnectionAction,
} from "@/app/connections/actions";
import { removeDemoAction } from "@/app/demo/actions";
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
  Select,
  StatusDot,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ConnectionHeadersEditor,
  newRow,
  type HeaderRow,
} from "@/components/connections/ConnectionHeadersEditor";
import { validateHeader } from "@/lib/connections/headers";
import type { TestResult } from "@/server/connections/service";

export interface CredentialField {
  name: string;
  in: "query" | "header";
  description?: string;
  occurrences: number;
  hasValue: boolean;
  enabled: boolean;
}

type AuthMode = "none" | "bearer" | "basic" | "params";

interface AuthParamRow {
  id: string;
  name: string;
  in: "query" | "header";
  description?: string;
  occurrences?: number;
  hasValue: boolean;
  value: string;
}

interface ConnectionView {
  id: string;
  name: string;
  baseUrl: string;
  readOnly: boolean;
  status: string;
  lastError: string | null;
  servers: { url: string; description?: string }[];
  operationCount: number;
  objectCount: number;
  authKind: string;
  hasBearerToken: boolean;
  hasBasicUser: boolean;
  /** The bundled example, which is removed as a whole rather than piecemeal. */
  isDemo: boolean;
}

function fingerprint(rows: HeaderRow[]): string {
  return JSON.stringify(
    rows
      .filter((row) => row.key.trim())
      .map((row) => [
        row.key.trim(),
        row.value,
        row.enabled,
        row.secret,
        row.description ?? "",
        row.hasValue,
      ]),
  );
}

function modeFromKind(kind: string): AuthMode {
  if (kind === "bearer") return "bearer";
  if (kind === "basic") return "basic";
  if (kind === "queryParam" || kind === "header") return "params";
  return "none";
}

function newParamRow(partial?: Partial<AuthParamRow>): AuthParamRow {
  return {
    id: `p_${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    in: "query",
    hasValue: false,
    value: "",
    ...partial,
  };
}

export function ConnectionSettings({
  connection,
  credentialFields,
  headers: savedHeaders,
  canRemoveDemo = false,
}: {
  connection: ConnectionView;
  credentialFields: CredentialField[];
  headers: HeaderRow[];
  /** Only admins may permanently delete the bundled demo. */
  canRemoveDemo?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(connection.name);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [readOnly, setReadOnly] = useState(connection.readOnly);
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    modeFromKind(connection.authKind),
  );
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authParams, setAuthParams] = useState<AuthParamRow[]>(() =>
    credentialFields.length > 0
      ? credentialFields.map((field) =>
          newParamRow({
            name: field.name,
            in: field.in,
            description: field.description,
            occurrences: field.occurrences,
            hasValue: field.hasValue,
          }),
        )
      : [newParamRow({ in: "query", name: "apikey" })],
  );
  const [headers, setHeaders] = useState<HeaderRow[]>(
    savedHeaders.length > 0 ? savedHeaders : [newRow()],
  );
  const [test, setTest] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const headerProblem =
    headers.map(validateHeader).find((problem) => problem) ?? null;

  const initialMode = modeFromKind(connection.authKind);
  const paramsDirty = useMemo(() => {
    if (authMode !== "params") return false;
    return authParams.some(
      (row) => row.value.trim() || (row.name.trim() && !row.hasValue),
    );
  }, [authMode, authParams]);

  const dirty =
    name !== connection.name ||
    baseUrl !== connection.baseUrl ||
    readOnly !== connection.readOnly ||
    authMode !== initialMode ||
    Boolean(token.trim()) ||
    Boolean(username.trim()) ||
    Boolean(password) ||
    paramsDirty ||
    fingerprint(headers) !== fingerprint(savedHeaders);

  function handleSave() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      await updateConnectionAction(connection.id, { name, baseUrl, readOnly });

      if (authMode === "bearer") {
        const result = await saveTokenAuthAction(connection.id, "bearer", {
          token: token.trim() || undefined,
        });
        if (!result.ok) {
          setError(result.error ?? "Could not save bearer token.");
          return;
        }
      } else if (authMode === "basic") {
        const result = await saveTokenAuthAction(connection.id, "basic", {
          username: username.trim() || undefined,
          password: password || undefined,
        });
        if (!result.ok) {
          setError(result.error ?? "Could not save basic auth.");
          return;
        }
      } else if (authMode === "params") {
        const credentials = authParams
          .filter((row) => row.name.trim())
          .map((row) => ({
            name: row.name.trim(),
            in: row.in,
            value: row.value,
          }));

        const result = await saveCredentialsAction(connection.id, credentials);
        if (!result.ok) {
          setError(result.error ?? "Could not save auth parameters.");
          return;
        }
      } else {
        const result = await saveTokenAuthAction(connection.id, "none", {});
        if (!result.ok) {
          setError(result.error ?? "Could not clear authentication.");
          return;
        }
      }

      const headerResult = await saveConnectionHeadersAction(
        connection.id,
        headers,
      );
      if (!headerResult.ok) {
        setError(headerResult.error ?? "Those headers could not be saved.");
        return;
      }

      setHeaders(
        headers
          .filter((row) => row.key.trim())
          .map((row) => ({
            ...row,
            key: row.key.trim(),
            value: row.secret ? "" : row.value,
            hasValue: row.secret
              ? row.hasValue || row.value.trim().length > 0
              : true,
          })),
      );
      setAuthParams((rows) =>
        rows.map((row) => ({
          ...row,
          value: "",
          hasValue: row.hasValue || Boolean(row.value.trim()),
        })),
      );
      setToken("");
      setUsername("");
      setPassword("");
      setSaved(true);
      router.refresh();
    });
  }

  function handleTest() {
    setTest(null);
    startTransition(async () => {
      setTest(await testConnectionAction(connection.id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Endpoints" value={connection.operationCount} />
        <StatCard label="Objects built" value={connection.objectCount} />
        <Card className="p-4">
          <p className="text-xs text-ink-soft">Status</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            <StatusDot status={connection.status} />
            {connection.status === "healthy"
              ? "Working"
              : connection.status === "failing"
                ? "Not responding"
                : "Not tested"}
          </p>
        </Card>
      </div>

      {connection.status === "failing" && connection.lastError ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-relaxed">{connection.lastError}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Settings</CardTitle>
            <p className="text-xs text-ink-soft">
              Where Argent sends requests, and what it is allowed to do.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Connection name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field
            label="Server"
            hint="Every request from every object goes to this address."
          >
            {connection.servers.length > 1 ? (
              <Select
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              >
                {connection.servers.map((server) => (
                  <option key={server.url} value={server.url}>
                    {server.url}
                    {server.description ? ` — ${server.description}` : ""}
                  </option>
                ))}
                {connection.servers.every((s) => s.url !== baseUrl) ? (
                  <option value={baseUrl}>{baseUrl}</option>
                ) : null}
              </Select>
            ) : (
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            )}
          </Field>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3">
            <Checkbox
              checked={!readOnly}
              onChange={(event) => setReadOnly(!event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                Allow changes to data
                {readOnly ? (
                  <Badge tone="neutral">Currently read only</Badge>
                ) : (
                  <Badge tone="warning">Writes enabled</Badge>
                )}
              </span>
              <span className="block text-xs text-ink-soft">
                While this is off, Argent refuses anything other than reads, so
                forms and delete buttons cannot touch real records.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Authentication</CardTitle>
            <p className="text-xs text-ink-soft">
              Applied to every request Argent sends for this connection —
              explorer, objects, dashboards, and the request builder (when set
              to inherit).
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Method">
            <Select
              value={authMode}
              onChange={(event) => setAuthMode(event.target.value as AuthMode)}
            >
              <option value="none">None</option>
              <option value="bearer">Bearer token (Authorization header)</option>
              <option value="basic">Basic username &amp; password</option>
              <option value="params">
                Default query / header parameters
              </option>
            </Select>
          </Field>

          {authMode === "bearer" ? (
            <Field
              label="Bearer token"
              hint="Sent as Authorization: Bearer &lt;token&gt; on every request."
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder={
                  connection.hasBearerToken
                    ? "•••••••• saved — type to replace"
                    : "Paste access token"
                }
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </Field>
          ) : null}

          {authMode === "basic" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Username">
                <Input
                  autoComplete="off"
                  placeholder={
                    connection.hasBasicUser
                      ? "Saved — type to replace"
                      : "Username"
                  }
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    connection.hasBasicUser
                      ? "•••••••• saved — type to replace"
                      : "Password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {authMode === "params" ? (
            <div className="space-y-3">
              <p className="text-xs text-ink-soft">
                Injected on every request even if the OpenAPI file never lists
                them. Use <strong>Query</strong> for URL keys such as{" "}
                <code className="font-mono text-[11px]">
                  /campaigns?apikey=…
                </code>
                , or <strong>Header</strong> for keys like{" "}
                <code className="font-mono text-[11px]">X-Api-Key</code>.
              </p>
              {credentialFields.length === 0 ? (
                <p className="rounded-lg bg-canvas px-3 py-2 text-[11px] text-ink-faint">
                  Argent did not detect shared login parameters in this spec. Set
                  the parameter name to match your API (often{" "}
                  <code className="font-mono">apikey</code> or{" "}
                  <code className="font-mono">api_key</code>).
                </p>
              ) : null}
              <div className="space-y-2">
                {authParams.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[7rem_1fr_1fr_auto]"
                  >
                    <Select
                      value={row.in}
                      onChange={(event) =>
                        setAuthParams((rows) =>
                          rows.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  in: event.target.value as "query" | "header",
                                }
                              : entry,
                          ),
                        )
                      }
                      className="h-8 text-xs"
                    >
                      <option value="query">Query</option>
                      <option value="header">Header</option>
                    </Select>
                    <Input
                      value={row.name}
                      onChange={(event) =>
                        setAuthParams((rows) =>
                          rows.map((entry, i) =>
                            i === index
                              ? { ...entry, name: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="Parameter name"
                      className="h-8 font-mono text-xs"
                    />
                    <Input
                      type="password"
                      autoComplete="off"
                      value={row.value}
                      onChange={(event) =>
                        setAuthParams((rows) =>
                          rows.map((entry, i) =>
                            i === index
                              ? { ...entry, value: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder={
                        row.hasValue
                          ? "•••••••• saved — type to replace"
                          : "Value"
                      }
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setAuthParams((rows) =>
                          rows.length === 1
                            ? [newParamRow()]
                            : rows.filter((_, i) => i !== index),
                        )
                      }
                      aria-label="Remove parameter"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    {row.description ? (
                      <p className="text-[11px] text-ink-faint sm:col-span-4">
                        {row.description}
                        {row.occurrences
                          ? ` · seen on ${row.occurrences} endpoints`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setAuthParams((rows) => [...rows, newParamRow()])
                }
              >
                <Plus /> Add parameter
              </Button>
            </div>
          ) : null}

          {authMode === "none" ? (
            <p className="text-xs text-ink-faint">
              No connection-level auth. You can still send credentials per
              request in the request builder, or add headers below.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Headers</CardTitle>
            <p className="text-xs text-ink-soft">
              Added to every request Argent sends to this connection — from
              objects, the explorer and the request builder alike.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <ConnectionHeadersEditor rows={headers} onChange={setHeaders} />
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Prefer the Authentication section for Bearer tokens. Use headers
            here for other values (for example{" "}
            <code className="font-mono">Accept-Language</code>). Lock a row to
            keep it encrypted.
          </p>
        </CardBody>
      </Card>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      ) : null}

      {test ? (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            test.ok
              ? "border-positive/30 bg-positive-soft text-positive"
              : "border-danger/30 bg-danger-soft text-danger"
          }`}
        >
          {test.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="text-xs leading-relaxed">
            <p className="font-medium">{test.message}</p>
            {test.detail ? <p className="mt-0.5">{test.detail}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={pending || !dirty || Boolean(headerProblem)}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
          <Button variant="secondary" onClick={handleTest} disabled={pending}>
            <PlugZap />
            <span className="hidden sm:inline">Test connection</span>
            <span className="sm:hidden">Test</span>
          </Button>
          {saved && !dirty ? (
            <span className="flex items-center gap-1 text-xs text-positive">
              <CheckCircle2 className="size-3.5" /> Saved
            </span>
          ) : null}
        </div>

        {connection.isDemo && !canRemoveDemo ? null : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            {connection.isDemo ? "Remove the demo" : "Remove connection"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={
          connection.isDemo
            ? "Remove the bundled demo?"
            : "Remove this connection?"
        }
        description={
          connection.isDemo
            ? "This deletes the example connection, its objects and the Campaign performance dashboard. You can load it again at any time from the home page."
            : `This deletes “${connection.name}” along with its ${connection.operationCount} endpoints and ${connection.objectCount} objects. Nothing is changed on the API itself.`
        }
        confirmLabel={
          connection.isDemo ? "Remove the demo" : "Remove connection"
        }
        confirmWord={connection.isDemo ? undefined : connection.name}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          startTransition(async () => {
            if (connection.isDemo) await removeDemoAction();
            else await deleteConnectionAction(connection.id);
            router.push("/connections");
          });
        }}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
    </Card>
  );
}
