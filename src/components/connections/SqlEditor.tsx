"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Save,
} from "lucide-react";
import {
  deleteSqlOperationAction,
  runSqlAction,
  saveSqlOperationAction,
} from "@/app/connections/db-actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import { extractParamNames } from "@/lib/database/sql";
import type { DbEngine } from "@/lib/database/engines";
import type { ExecuteResponseBody } from "@/lib/gateway/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const DIALECT_HINT: Record<DbEngine, string> = {
  postgres: "Bound as $1, $2… under the hood — write {{name}} in your SQL.",
  mariadb: "Bound as ? under the hood — write {{name}} in your SQL.",
  clickhouse: "Bound as {name:Type} under the hood — write {{name}} in your SQL.",
};

export interface SavedQuery {
  id: string;
  name: string;
  sqlTemplate: string;
  description?: string | null;
}

/**
 * Postman-style SQL editor: write a query with {{params}}, fill values, run,
 * and save as an Operation the object builder can use.
 */
export function SqlEditor({
  connectionId,
  engine,
  initial,
  sql,
  onSqlChange,
  onSaved,
}: {
  connectionId: string;
  engine: DbEngine;
  initial?: SavedQuery | null;
  sql: string;
  onSqlChange: (next: string) => void;
  onSaved?: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExecuteResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);
  const [confirmWrite, setConfirmWrite] = useState(false);

  const paramNames = useMemo(() => extractParamNames(sql), [sql]);

  function paramsRecord(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const name of paramNames) {
      const raw = paramValues[name] ?? "";
      if (raw === "") continue;
      if (/^-?\d+(\.\d+)?$/.test(raw)) out[name] = Number(raw);
      else if (raw === "true" || raw === "false") out[name] = raw === "true";
      else out[name] = raw;
    }
    return out;
  }

  function handleRun(forceConfirm = false) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const response = await runSqlAction({
        connectionId,
        sql,
        params: paramsRecord(),
        confirmWrite: forceConfirm,
      });

      if (
        !response.ok &&
        response.error?.kind === "config" &&
        response.error.message.includes("confirmation")
      ) {
        setConfirmWrite(true);
        return;
      }

      setResult(response);
      if (!response.ok) {
        setError(response.error?.message ?? "The query failed.");
      }
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const response = await saveSqlOperationAction({
        connectionId,
        id: savedId ?? undefined,
        name: name || "Untitled query",
        sqlTemplate: sql,
      });
      if (!response.ok || !response.id) {
        setError(response.error ?? "Could not save.");
        return;
      }
      setSavedId(response.id);
      onSaved?.(response.id);
    });
  }

  const rows = result?.rows ?? [];
  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : (result?.fields ?? []).map((field) => field.path);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Query name" className="min-w-[12rem] flex-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Orders this month"
            className="h-8 text-xs"
          />
        </Field>
        <Button size="sm" variant="secondary" onClick={handleSave} disabled={pending || !sql.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Save query
        </Button>
        <Button size="sm" onClick={() => handleRun(false)} disabled={pending || !sql.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Play />}
          Run
        </Button>
      </div>

      <Textarea
        value={sql}
        onChange={(event) => onSqlChange(event.target.value)}
        rows={10}
        spellCheck={false}
        className="min-h-[10rem] flex-1 font-mono text-xs leading-relaxed"
        placeholder={"SELECT *\nFROM schema.table\nWHERE status = {{status}}\nLIMIT {{limit}}"}
      />

      <p className="text-[11px] text-ink-faint">{DIALECT_HINT[engine]}</p>

      {paramNames.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <p className="text-[11px] font-medium text-ink-soft">Parameters</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {paramNames.map((param) => (
              <Field key={param} label={param}>
                <Input
                  value={paramValues[param] ?? ""}
                  onChange={(event) =>
                    setParamValues((current) => ({
                      ...current,
                      [param]: event.target.value,
                    }))
                  }
                  placeholder={`Value for {{${param}}}`}
                  className="h-8 font-mono text-xs"
                />
              </Field>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="text-xs">
            <p className="font-medium">{error}</p>
            {result?.error?.detail ? (
              <p className="mt-1 opacity-80">{result.error.detail}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {result?.ok ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line">
          <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-1.5 text-[11px] text-ink-soft">
            <CheckCircle2 className="size-3.5 text-positive" />
            {result.rowCount ?? rows.length} rows · {result.durationMs} ms
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-xs text-ink-faint">No rows returned.</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-canvas">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="border-b border-line px-2 py-1.5 font-medium text-ink-soft"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row, index) => (
                  <tr key={index} className="border-b border-line/70">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className="max-w-[14rem] truncate px-2 py-1 font-mono text-ink"
                      >
                        {formatCell(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {savedId && initial?.id === savedId ? (
        <button
          type="button"
          className="self-start text-[11px] text-danger hover:underline"
          onClick={() =>
            startTransition(async () => {
              await deleteSqlOperationAction(connectionId, savedId);
              setSavedId(null);
            })
          }
        >
          Delete this saved query
        </button>
      ) : null}

      <ConfirmDialog
        open={confirmWrite}
        title="Run a query that changes data?"
        description="This SQL is not a read-only SELECT. It will be sent to the database."
        confirmLabel="Yes, run it"
        destructive
        onCancel={() => setConfirmWrite(false)}
        onConfirm={() => {
          setConfirmWrite(false);
          handleRun(true);
        }}
      />
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
