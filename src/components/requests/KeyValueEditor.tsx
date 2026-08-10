"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/primitives";
import { emptyEntry, type KeyValueEntry } from "@/lib/requests/types";

/**
 * The familiar key/value grid with an enable checkbox per row. A blank trailing
 * row is added automatically so there is never a button to hunt for.
 */
export function KeyValueEditor({
  entries,
  onChange,
  keyPlaceholder = "Name",
  valuePlaceholder = "Value",
  emptyHint,
}: {
  entries: KeyValueEntry[];
  onChange: (next: KeyValueEntry[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyHint?: string;
}) {
  function update(index: number, patch: Partial<KeyValueEntry>) {
    const next = [...entries];
    next[index] = { ...next[index], ...patch };

    // Keep exactly one blank row at the end.
    const last = next[next.length - 1];
    if (last && (last.key.trim() || last.value.trim())) {
      next.push(emptyEntry());
    }

    onChange(next);
  }

  const rows = entries.length > 0 ? entries : [emptyEntry()];

  return (
    <div className="space-y-1.5">
      {emptyHint && rows.every((row) => !row.key.trim()) ? (
        <p className="text-[11px] text-ink-faint">{emptyHint}</p>
      ) : null}

      <div className="space-y-1">
        {rows.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Checkbox
              checked={entry.enabled}
              onChange={(event) => update(index, { enabled: event.target.checked })}
              title={entry.enabled ? "Included" : "Skipped"}
            />
            <Input
              value={entry.key}
              onChange={(event) => update(index, { key: event.target.value })}
              placeholder={keyPlaceholder}
              className="h-8 flex-1 font-mono text-xs"
            />
            <Input
              value={entry.value}
              onChange={(event) => update(index, { value: event.target.value })}
              placeholder={valuePlaceholder}
              className="h-8 flex-[1.6] font-mono text-xs"
            />
            <button
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              disabled={rows.length === 1}
              className="text-ink-faint hover:text-danger disabled:opacity-25"
              aria-label="Remove this row"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange([...rows, emptyEntry()])}
      >
        <Plus /> Add row
      </Button>
    </div>
  );
}
