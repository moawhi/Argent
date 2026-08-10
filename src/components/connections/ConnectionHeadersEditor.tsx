"use client";

import { Lock, LockOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/primitives";
import {
  emptyHeader,
  validateHeader,
  type ConnectionHeader,
} from "@/lib/connections/headers";

export interface HeaderRow extends ConnectionHeader {
  /** True when a secret value is already in the vault for this header. */
  hasValue: boolean;
}

export function newRow(): HeaderRow {
  return { ...emptyHeader(), hasValue: false };
}

const COMMON = [
  "Authorization",
  "X-Api-Key",
  "X-Tenant-Id",
  "Accept-Language",
  "User-Agent",
];

/**
 * Key/value grid for the headers a connection attaches to every request. Each
 * row can be locked, which moves the value into the encrypted vault so it is
 * never sent back to the browser again.
 */
export function ConnectionHeadersEditor({
  rows,
  onChange,
}: {
  rows: HeaderRow[];
  onChange: (next: HeaderRow[]) => void;
}) {
  function update(index: number, patch: Partial<HeaderRow>) {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="hidden gap-1.5 px-1 text-[11px] font-medium text-ink-faint sm:flex">
        <span className="w-4" />
        <span className="flex-1">Header name</span>
        <span className="flex-[1.6]">Value</span>
        <span className="w-14" />
      </div>

      <div className="space-y-1.5">
        {rows.map((row, index) => {
          const problem = validateHeader(row);

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={row.enabled}
                  onChange={(event) =>
                    update(index, { enabled: event.target.checked })
                  }
                  title={row.enabled ? "Sent with requests" : "Paused"}
                />
                <Input
                  value={row.key}
                  onChange={(event) => update(index, { key: event.target.value })}
                  placeholder="X-Api-Key"
                  list="connection-header-names"
                  className="h-8 flex-1 font-mono text-xs"
                />
                <Input
                  value={row.value}
                  type={row.secret ? "password" : "text"}
                  autoComplete="off"
                  onChange={(event) =>
                    update(index, { value: event.target.value })
                  }
                  placeholder={
                    row.secret
                      ? row.hasValue
                        ? "•••••••• saved"
                        : "Hidden once saved"
                      : "Value"
                  }
                  className="h-8 flex-[1.6] font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    update(index, { secret: !row.secret, value: "" })
                  }
                  title={
                    row.secret
                      ? "Kept secret. Click to show this value in plain text."
                      : "Visible to anyone with access. Click to keep it secret."
                  }
                  aria-label="Toggle secret"
                  aria-pressed={row.secret}
                  className={
                    row.secret
                      ? "rounded p-1 text-accent hover:bg-surface-2"
                      : "rounded p-1 text-ink-faint hover:bg-surface-2 hover:text-ink"
                  }
                >
                  {row.secret ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <LockOpen className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  className="rounded p-1 text-ink-faint hover:text-danger"
                  aria-label="Remove this header"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {problem ? (
                <p className="pl-6 text-[11px] text-danger">{problem}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <datalist id="connection-header-names">
        {COMMON.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <Button size="sm" variant="ghost" onClick={() => onChange([...rows, newRow()])}>
        <Plus /> Add a header
      </Button>
    </div>
  );
}
