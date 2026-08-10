"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PlugZap,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  refreshDbCatalogAction,
  testDatabaseConnectionAction,
  updateDatabaseConnectionAction,
} from "@/app/connections/db-actions";
import { deleteConnectionAction } from "@/app/connections/actions";
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
  StatusDot,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SchemaBrowser } from "./SchemaBrowser";
import { SqlEditor } from "./SqlEditor";
import { ENGINE_DEFAULTS, type DbEngine } from "@/lib/database/engines";
import type { DbConfig, DbSchema } from "@/server/database/types";

export interface DatabaseConnectionView {
  id: string;
  name: string;
  baseUrl: string;
  readOnly: boolean;
  status: string;
  lastError: string | null;
  operationCount: number;
  objectCount: number;
  config: DbConfig;
  hasPassword: boolean;
}

export function DatabaseConnectionPanel({
  connection,
  schemas,
  refreshedAt,
  queries,
}: {
  connection: DatabaseConnectionView;
  schemas: DbSchema[];
  refreshedAt: string | null;
  queries: { id: string; name: string; sqlTemplate: string; description: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(connection.name);
  const [config, setConfig] = useState(connection.config);
  const [password, setPassword] = useState("");
  const [readOnly, setReadOnly] = useState(connection.readOnly);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sql, setSql] = useState(
    queries[0]?.sqlTemplate ??
      "SELECT *\nFROM information_schema.tables\nLIMIT {{limit}}",
  );
  const [activeQueryId, setActiveQueryId] = useState<string | null>(
    queries[0]?.id ?? null,
  );

  const engine = config.engine as DbEngine;
  const activeQuery = useMemo(
    () => queries.find((query) => query.id === activeQueryId) ?? null,
    [queries, activeQueryId],
  );

  function handleSave() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateDatabaseConnectionAction(connection.id, {
        name,
        config,
        password: password.trim() || undefined,
        readOnly,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setPassword("");
      setMessage("Saved.");
      router.refresh();
    });
  }

  function handleTest() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await testDatabaseConnectionAction(connection.id);
      if (result.ok) setMessage(result.message);
      else setError(result.message);
      router.refresh();
    });
  }

  function handleRefresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshDbCatalogAction(connection.id);
      if (!result.ok) setError(result.error ?? "Could not refresh schema.");
      else setMessage("Schema refreshed.");
      router.refresh();
    });
  }

  function insertSnippet(snippet: string) {
    setSql((current) => (current.trim() ? `${current} ${snippet}` : snippet));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-soft">Engine</p>
          <p className="mt-1 text-sm font-semibold">
            {ENGINE_DEFAULTS[engine].label}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-soft">Saved queries</p>
          <p className="mt-1 text-sm font-semibold">{connection.operationCount}</p>
        </Card>
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
              Where seeIt connects, and whether it may change data.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Connection name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Host" className="sm:col-span-2">
              <Input
                value={config.host}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, host: event.target.value }))
                }
              />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={config.port}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    port: Number(event.target.value) || current.port,
                  }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Database">
              <Input
                value={config.database}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    database: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Username">
              <Input
                value={config.user}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, user: event.target.value }))
                }
              />
            </Field>
          </div>

          <Field
            label="Password"
            hint={
              connection.hasPassword
                ? "Leave blank to keep the saved password."
                : "Required."
            }
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              placeholder={connection.hasPassword ? "•••••••• saved" : ""}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
            <Checkbox
              checked={config.ssl}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  ssl: event.target.checked,
                }))
              }
            />
            Use {ENGINE_DEFAULTS[engine].sslLabel}
          </label>

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
                While this is off, only SELECT / SHOW style queries are allowed.
              </span>
            </span>
          </label>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          ) : null}

          {message ? (
            <div className="flex items-start gap-2 rounded-lg border border-positive/30 bg-positive-soft p-3 text-positive">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs">{message}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Save changes
              </Button>
              <Button variant="secondary" onClick={handleTest} disabled={pending}>
                <PlugZap />
                <span className="hidden sm:inline">Test connection</span>
                <span className="sm:hidden">Test</span>
              </Button>
              <Button variant="ghost" onClick={handleRefresh} disabled={pending}>
                <RefreshCw />
                <span className="hidden sm:inline">Refresh schema</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              <span className="hidden sm:inline">Remove connection</span>
              <span className="sm:hidden">Remove</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid min-h-[22rem] gap-3 sm:min-h-[28rem] lg:grid-cols-[16rem_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Schema</CardTitle>
              <p className="text-[11px] text-ink-faint">
                {refreshedAt
                  ? `Mapped ${new Date(refreshedAt).toLocaleString()}`
                  : "Not mapped yet"}
              </p>
            </div>
          </CardHeader>
          <CardBody className="min-h-0 flex-1 overflow-hidden p-0">
            <SchemaBrowser
              connectionId={connection.id}
              schemas={schemas}
              onInsert={insertSnippet}
            />
          </CardBody>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <div className="flex w-full flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Queries</CardTitle>
                <p className="text-xs text-ink-soft">
                  Write SQL with {"{{parameters}}"}, run it, then save for the object builder.
                </p>
              </div>
              {queries.length > 0 ? (
                <select
                  value={activeQueryId ?? ""}
                  onChange={(event) => {
                    const id = event.target.value || null;
                    setActiveQueryId(id);
                    const found = queries.find((query) => query.id === id);
                    if (found) setSql(found.sqlTemplate);
                  }}
                  className="h-8 rounded-md border border-line bg-surface px-2 text-xs"
                >
                  <option value="">New query</option>
                  {queries.map((query) => (
                    <option key={query.id} value={query.id}>
                      {query.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </CardHeader>
          <CardBody className="min-h-0 flex-1 overflow-auto">
            <SqlEditor
              key={activeQueryId ?? "new"}
              connectionId={connection.id}
              engine={engine}
              initial={
                activeQuery
                  ? {
                      id: activeQuery.id,
                      name: activeQuery.name,
                      sqlTemplate: activeQuery.sqlTemplate,
                      description: activeQuery.description,
                    }
                  : null
              }
              sql={sql}
              onSqlChange={setSql}
              onSaved={(id) => {
                setActiveQueryId(id);
                router.refresh();
              }}
            />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this database connection?"
        description="Saved queries and objects that use them are removed too."
        confirmLabel="Remove connection"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          startTransition(async () => {
            await deleteConnectionAction(connection.id);
            router.push("/connections");
            router.refresh();
          });
        }}
      />
    </div>
  );
}
