"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";
import { cn, formatDuration } from "@/lib/utils";
import type { ExecuteResponseBody } from "@/lib/gateway/types";

type Tab = "preview" | "raw" | "request";

/**
 * Shows a gateway result three ways: a readable table for rows, the raw JSON,
 * and what was actually sent (with secrets already masked server-side).
 */
export function ResponseViewer({ result }: { result: ExecuteResponseBody }) {
  const [tab, setTab] = useState<Tab>("preview");

  const rows = result.rows ?? [];
  const hasRows = rows.length > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-3 py-2">
        {result.ok ? (
          <CheckCircle2 className="size-4 text-positive" />
        ) : (
          <AlertTriangle className="size-4 text-danger" />
        )}
        <Badge tone={result.ok ? "positive" : "danger"}>
          {result.status ?? "no response"}
        </Badge>
        <span className="text-xs text-ink-soft">
          {formatDuration(result.durationMs)}
        </span>
        {result.rowCount !== undefined ? (
          <span className="text-xs text-ink-soft">
            {result.rowCount} {result.rowCount === 1 ? "record" : "records"}
          </span>
        ) : null}
        {result.cached ? <Badge tone="neutral">from cache</Badge> : null}

        <div className="ml-auto flex gap-1">
          {(
            [
              ["preview", "Preview"],
              ["raw", "Raw"],
              ["request", "Sent"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium",
                tab === id
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {result.error ? (
        <div className="border-b border-line bg-danger-soft px-3 py-2.5">
          <p className="text-xs font-medium text-danger">
            {result.error.message}
          </p>
          {result.error.detail ? (
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-danger/80">
              {result.error.detail}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "preview" ? (
        hasRows ? (
          <PreviewTable rows={rows} />
        ) : result.data !== undefined && result.data !== null ? (
          <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
            {stringify(result.data)}
          </pre>
        ) : (
          <p className="p-4 text-center text-xs text-ink-faint">
            The response had no content.
          </p>
        )
      ) : null}

      {tab === "raw" ? (
        <div className="relative">
          <div className="absolute right-2 top-2">
            <CopyButton value={stringify(result.data)} />
          </div>
          <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
            {stringify(result.data)}
          </pre>
        </div>
      ) : null}

      {tab === "request" && result.requestPreview ? (
        <div className="space-y-3 p-3 text-[11px]">
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-ink-faint">
              URL
            </p>
            <code className="block break-all font-mono text-ink-soft">
              {result.requestPreview.method} {result.requestPreview.url}
            </code>
          </div>
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-ink-faint">
              Headers
            </p>
            <div className="space-y-0.5 font-mono text-ink-soft">
              {Object.entries(result.requestPreview.headers).map(
                ([key, value]) => (
                  <div key={key}>
                    {key}: {value}
                  </div>
                ),
              )}
            </div>
          </div>
          {result.requestPreview.body ? (
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide text-ink-faint">
                Body
              </p>
              <pre className="overflow-auto font-mono text-ink-soft">
                {result.requestPreview.body}
              </pre>
            </div>
          ) : null}
          <p className="text-ink-faint">
            Credential values are replaced with *** before they reach your
            browser.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PreviewTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(
    0,
    12,
  );
  const shown = rows.slice(0, 25);

  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-canvas text-ink-soft">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-3 py-1.5 font-medium"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td
                  key={column}
                  className="max-w-[16rem] truncate px-3 py-1.5 text-ink-soft"
                  title={cellText(row[column])}
                >
                  {cellText(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? (
        <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink-faint">
          Showing the first {shown.length} of {rows.length} records.
        </p>
      ) : null}
    </div>
  );
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
