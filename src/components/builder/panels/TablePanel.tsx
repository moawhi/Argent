"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical } from "lucide-react";
import { Checkbox, Field, Input, Select } from "@/components/ui/primitives";
import { FORMAT_LABEL } from "@/lib/objects/format";
import { RowActionsEditor } from "./RowActionsEditor";
import { cn } from "@/lib/utils";
import type { FormatKind, TableConfig } from "@/lib/objects/types";
import type { FieldDescriptor } from "@/lib/openapi/types";
import type { OperationListItem } from "@/server/operations/queries";

const FORMATS: FormatKind[] = [
  "text",
  "number",
  "currency",
  "percent",
  "date",
  "datetime",
  "boolean",
  "badge",
  "link",
  "json",
];

export function TablePanel({
  config,
  onChange,
  fields,
  operations,
}: {
  config: TableConfig;
  onChange: (next: TableConfig) => void;
  fields: FieldDescriptor[];
  /** Every endpoint on this connection, for row buttons to call. */
  operations: OperationListItem[];
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function update(patch: Partial<TableConfig>) {
    onChange({ ...config, ...patch });
  }

  function updateColumn(index: number, patch: Partial<TableConfig["columns"][number]>) {
    const columns = [...config.columns];
    columns[index] = { ...columns[index], ...patch };
    update({ columns });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= config.columns.length) return;
    const columns = [...config.columns];
    [columns[index], columns[target]] = [columns[target], columns[index]];
    update({ columns });
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= config.columns.length) return;
    const columns = [...config.columns];
    const [item] = columns.splice(from, 1);
    columns.splice(to, 0, item);
    update({ columns });
  }

  const visibleCount = config.columns.filter((column) => column.visible).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Rows per page">
          <Select
            value={String(config.pageSize)}
            onChange={(event) => update({ pageSize: Number(event.target.value) })}
            className="h-8 text-xs"
          >
            {[5, 10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Row height">
          <Select
            value={config.density}
            onChange={(event) =>
              update({ density: event.target.value as TableConfig["density"] })
            }
            className="h-8 text-xs"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </Select>
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
        <Checkbox
          checked={config.serverPagination !== false}
          onChange={(event) =>
            update({ serverPagination: event.target.checked })
          }
        />
        Load one page at a time from the API or database
      </label>
      <p className="text-[11px] leading-snug text-ink-faint">
        Keeps large result sets (thousands or millions of rows) from freezing
        the dashboard. Turn off only for small lists you want to search in
        memory.
      </p>

      <Field
        label="Fetch limit (optional)"
        hint="Caps how many rows each request may return. Defaults to rows per page."
      >
        <Input
          type="number"
          min={1}
          max={500}
          value={config.fetchLimit ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            update({
              fetchLimit: raw === "" ? undefined : Number(raw),
            });
          }}
          placeholder={String(config.pageSize)}
          className="h-8 text-xs"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
        <Checkbox
          checked={config.searchable}
          onChange={(event) => update({ searchable: event.target.checked })}
        />
        Show a search box
      </label>

      <Field
        label="Field that identifies a row"
        hint="Used by row buttons and by tiles that follow the selected row."
      >
        <Select
          value={config.rowIdField ?? ""}
          onChange={(event) =>
            update({ rowIdField: event.target.value || null })
          }
          className="h-8 text-xs"
        >
          <option value="">Nothing in particular</option>
          {fields.map((field) => (
            <option key={field.path} value={field.path}>
              {field.label} ({field.path})
            </option>
          ))}
        </Select>
      </Field>

      <RowActionsEditor
        variant="toolbar"
        actions={config.toolbarActions ?? []}
        onChange={(toolbarActions) => update({ toolbarActions })}
        fields={fields}
        rowIdField={config.rowIdField ?? null}
        operations={operations}
      />

      <RowActionsEditor
        actions={config.rowActions ?? []}
        onChange={(rowActions) => update({ rowActions })}
        rowClickActionId={config.rowClickActionId ?? null}
        onRowClickActionChange={(rowClickActionId) =>
          update({ rowClickActionId })
        }
        fields={fields}
        rowIdField={config.rowIdField ?? null}
        operations={operations}
      />

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-ink-soft">
            Columns ({visibleCount} of {config.columns.length} shown)
          </p>
          <button
            type="button"
            onClick={() =>
              update({
                columns: config.columns.map((column) => ({
                  ...column,
                  visible: visibleCount < config.columns.length,
                })),
              })
            }
            className="text-[11px] text-brand hover:underline"
          >
            {visibleCount < config.columns.length ? "Show all" : "Hide all"}
          </button>
        </div>
        <p className="text-[11px] text-ink-faint">
          Drag the handle to change column order.
        </p>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {config.columns.map((column, index) => (
            <div
              key={column.path}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (overIndex !== index) setOverIndex(index);
              }}
              onDragLeave={() => {
                if (overIndex === index) setOverIndex(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = Number(event.dataTransfer.getData("text/plain"));
                reorder(Number.isFinite(from) ? from : (dragIndex ?? -1), index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                "rounded-md border bg-surface p-2 transition-colors",
                dragIndex === index
                  ? "border-brand opacity-60"
                  : overIndex === index
                    ? "border-brand bg-brand-soft/40"
                    : "border-line",
              )}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  draggable
                  title="Drag to reorder"
                  aria-label={`Drag to reorder ${column.label}`}
                  onDragStart={(event) => {
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className="cursor-grab text-ink-faint hover:text-ink active:cursor-grabbing"
                >
                  <GripVertical className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => updateColumn(index, { visible: !column.visible })}
                  title={column.visible ? "Hide this column" : "Show this column"}
                  className="text-ink-faint hover:text-ink"
                >
                  {column.visible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>

                <Input
                  value={column.label}
                  onChange={(event) =>
                    updateColumn(index, { label: event.target.value })
                  }
                  className="h-7 flex-1 text-xs"
                />

                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-ink-faint hover:text-ink disabled:opacity-25"
                    title="Move up"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === config.columns.length - 1}
                    className="text-ink-faint hover:text-ink disabled:opacity-25"
                    title="Move down"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
              </div>

              {column.visible ? (
                <div className="mt-1.5 flex items-center gap-1.5 pl-5">
                  <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-faint">
                    {column.path}
                  </code>
                  <Select
                    value={column.format}
                    onChange={(event) =>
                      updateColumn(index, {
                        format: event.target.value as FormatKind,
                      })
                    }
                    className="h-6 w-32 text-[11px]"
                  >
                    {FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {FORMAT_LABEL[format]}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
