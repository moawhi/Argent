"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { rowActionTargetAction } from "@/app/objects/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Checkbox,
  Field,
  Input,
  MethodBadge,
  Select,
} from "@/components/ui/primitives";
import {
  ROW_ACTION_ICON,
  ROW_ACTION_ICON_LABEL,
  ROW_ACTION_KIND_HINT,
  ROW_ACTION_KIND_LABEL,
  ROW_ACTION_TEMPLATES,
  TOOLBAR_ACTION_TEMPLATES,
  isWriteMethod,
  toBodyTarget,
} from "@/lib/objects/row-actions";
import type {
  RowAction,
  RowActionIcon,
  RowActionInput,
  RowActionKind,
} from "@/lib/objects/types";
import type { RowActionTarget } from "@/server/objects/service";
import type { FieldDescriptor } from "@/lib/openapi/types";
import type { OperationListItem } from "@/server/operations/queries";

const ICONS = Object.keys(ROW_ACTION_ICON) as RowActionIcon[];
const ROW_KINDS: RowActionKind[] = ["details", "form", "run", "link", "select"];
const TOOLBAR_KINDS: RowActionKind[] = ["details", "form", "run", "link"];

/** Endpoint-backed kinds, which need a target operation and input mapping. */
const CALLS_AN_ENDPOINT: RowActionKind[] = ["details", "form", "run"];

export function RowActionsEditor({
  actions,
  onChange,
  rowClickActionId = null,
  onRowClickActionChange,
  fields,
  rowIdField,
  operations,
  variant = "row",
}: {
  actions: RowAction[];
  onChange: (next: RowAction[]) => void;
  rowClickActionId?: string | null;
  onRowClickActionChange?: (next: string | null) => void;
  fields: FieldDescriptor[];
  rowIdField: string | null;
  operations: OperationListItem[];
  /** Row buttons vs header toolbar (Create, etc.). */
  variant?: "row" | "toolbar";
}) {
  const isToolbar = variant === "toolbar";
  const templates = isToolbar ? TOOLBAR_ACTION_TEMPLATES : ROW_ACTION_TEMPLATES;
  const kinds = isToolbar ? TOOLBAR_KINDS : ROW_KINDS;

  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [targets, setTargets] = useState<Record<string, RowActionTarget>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function loadTarget(operationId: string) {
    if (targets[operationId]) return targets[operationId];

    setLoading(operationId);
    const target = await rowActionTargetAction(operationId);
    setLoading(null);

    if (target) setTargets((current) => ({ ...current, [operationId]: target }));
    return target;
  }

  function update(id: string, patch: Partial<RowAction>) {
    onChange(
      actions.map((action) =>
        action.id === id ? { ...action, ...patch } : action,
      ),
    );
  }

  function remove(id: string) {
    onChange(actions.filter((action) => action.id !== id));
    if (!isToolbar && rowClickActionId === id) {
      onRowClickActionChange?.(null);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  /** Picking an endpoint maps its parameters to row fields where it can. */
  async function chooseEndpoint(action: RowAction, operationId: string) {
    if (!operationId) {
      update(action.id, { operationId: undefined, method: undefined, inputs: [] });
      return;
    }

    const target = await loadTarget(operationId);
    if (!target) return;

    update(action.id, {
      operationId,
      method: target.method,
      inputs: autoMapInputs(target, fields, rowIdField),
      formFields: action.kind === "form" ? target.formFields : undefined,
      confirm: action.confirm || isWriteMethod(target.method),
      refreshAfter: action.refreshAfter || isWriteMethod(target.method),
    });
  }

  async function expand(action: RowAction) {
    setOpenId(openId === action.id ? null : action.id);
    if (action.operationId) await loadTarget(action.operationId);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-ink-soft">
          {isToolbar
            ? `Toolbar buttons (${actions.length})`
            : `Buttons on every row (${actions.length})`}
        </p>
        {actions.length > 0 ? (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] text-brand hover:underline"
          >
            Add another
          </button>
        ) : null}
      </div>

      {actions.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed border-line p-3 text-center">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            {isToolbar
              ? "Add a Plus button to create a new record in a modal, or any other action that does not need a selected row."
              : "Add a magnifier to inspect a record, a pencil to edit it, a bin to delete it — each one calling any endpoint on this connection."}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => setAdding(true)}
          >
            <Plus /> {isToolbar ? "Add a toolbar button" : "Add a row button"}
          </Button>
        </div>
      ) : null}

      {adding ? (
        <div className="space-y-1 rounded-lg border border-brand/30 bg-brand-soft/40 p-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-ink">
              What should the button do?
            </p>
            <button
              onClick={() => setAdding(false)}
              className="text-ink-faint hover:text-ink"
              aria-label="Cancel"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {templates.map((template) => {
            const Icon = ROW_ACTION_ICON[template.icon];
            return (
              <button
                key={template.id}
                onClick={() => {
                  const action = template.build();
                  onChange([...actions, action]);
                  setOpenId(action.id);
                  setAdding(false);
                }}
                className="flex w-full items-start gap-2 rounded-md border border-line bg-surface p-2 text-left hover:border-brand"
              >
                <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-soft" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">
                    {template.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-ink-faint">
                    {template.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {actions.map((action, index) => {
        const Icon = ROW_ACTION_ICON[action.icon] ?? ROW_ACTION_ICON.settings;
        const open = openId === action.id;
        const target = action.operationId ? targets[action.operationId] : null;

        return (
          <div
            key={action.id}
            className="rounded-lg border border-line bg-surface"
          >
            <div className="flex items-center gap-1.5 p-2">
              <Icon
                className={`size-4 shrink-0 ${action.danger ? "text-danger" : "text-ink-soft"}`}
              />
              <button
                onClick={() => void expand(action)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-xs font-medium text-ink">
                  {action.label}
                </span>
                <span className="block truncate text-[10px] text-ink-faint">
                  {action.kind === "link"
                    ? action.urlField
                      ? `Opens ${action.urlField}`
                      : "No field chosen"
                    : action.kind === "select"
                      ? "Feeds other tiles"
                      : (target?.path ??
                        (action.operationId
                          ? "Endpoint chosen"
                          : "No endpoint chosen"))}
                </span>
              </button>

              {loading === action.operationId ? (
                <Loader2 className="size-3 animate-spin text-ink-faint" />
              ) : null}

              <div className="flex flex-col">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="text-ink-faint hover:text-ink disabled:opacity-25"
                  aria-label="Move left"
                >
                  <ChevronUp className="size-3" />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === actions.length - 1}
                  className="text-ink-faint hover:text-ink disabled:opacity-25"
                  aria-label="Move right"
                >
                  <ChevronDown className="size-3" />
                </button>
              </div>

              <button
                onClick={() => remove(action.id)}
                className="text-ink-faint hover:text-danger"
                aria-label="Remove this button"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            {open ? (
              <div className="space-y-3 border-t border-line p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Button tooltip">
                    <Input
                      value={action.label}
                      onChange={(event) =>
                        update(action.id, { label: event.target.value })
                      }
                      className="h-7 text-xs"
                    />
                  </Field>
                  <Field label="Icon">
                    <Select
                      value={action.icon}
                      onChange={(event) =>
                        update(action.id, {
                          icon: event.target.value as RowActionIcon,
                        })
                      }
                      className="h-7 text-xs"
                    >
                      {ICONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {ROW_ACTION_ICON_LABEL[icon]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="What it does" hint={ROW_ACTION_KIND_HINT[action.kind]}>
                  <Select
                    value={action.kind}
                    onChange={(event) =>
                      update(action.id, {
                        kind: event.target.value as RowActionKind,
                      })
                    }
                    className="h-7 text-xs"
                  >
                    {kinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {ROW_ACTION_KIND_LABEL[kind]}
                      </option>
                    ))}
                  </Select>
                </Field>

                {action.kind === "link" ? (
                  isToolbar ? (
                    <Field
                      label="Web address"
                      hint="Opened in a new tab when the toolbar button is clicked."
                    >
                      <Input
                        value={
                          action.inputs.find(
                            (input) =>
                              input.target === "url" &&
                              input.source === "fixed",
                          )?.value ??
                          action.urlField ??
                          ""
                        }
                        onChange={(event) =>
                          update(action.id, {
                            urlField: undefined,
                            inputs: [
                              {
                                target: "url",
                                source: "fixed",
                                value: event.target.value,
                              },
                            ],
                          })
                        }
                        placeholder="https://"
                        className="h-7 text-xs"
                      />
                    </Field>
                  ) : (
                    <Field label="Field holding the address">
                      <Select
                        value={action.urlField ?? ""}
                        onChange={(event) =>
                          update(action.id, {
                            urlField: event.target.value || undefined,
                          })
                        }
                        className="h-7 text-xs"
                      >
                        <option value="">Choose a field</option>
                        {fields.map((field) => (
                          <option key={field.path} value={field.path}>
                            {field.label} ({field.path})
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )
                ) : null}

                {CALLS_AN_ENDPOINT.includes(action.kind) ? (
                  <>
                    <Field
                      label="Endpoint to call"
                      hint="Any endpoint on this connection, not just the one feeding the table."
                    >
                      <Select
                        value={action.operationId ?? ""}
                        onChange={(event) =>
                          void chooseEndpoint(action, event.target.value)
                        }
                        className="h-7 text-xs"
                      >
                        <option value="">Choose an endpoint</option>
                        {operations.map((operation) => (
                          <option key={operation.id} value={operation.id}>
                            {operation.method} {operation.path}
                            {operation.summary ? ` — ${operation.summary}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {target ? (
                      <div className="flex items-center gap-1.5">
                        <MethodBadge method={target.method} />
                        <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-faint">
                          {target.path}
                        </code>
                      </div>
                    ) : null}

                    {target ? (
                      <InputMapping
                        action={action}
                        target={target}
                        fields={fields}
                        onChange={(inputs) => update(action.id, { inputs })}
                      />
                    ) : null}

                    {action.kind === "form" && action.formFields?.length ? (
                      <FormFieldList
                        fields={action.formFields}
                        onChange={(formFields) =>
                          update(action.id, { formFields })
                        }
                      />
                    ) : null}
                  </>
                ) : null}

                {action.kind !== "select" && action.kind !== "details" ? (
                  <div className="space-y-2 rounded-md bg-canvas p-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink">
                      <Checkbox
                        checked={action.confirm}
                        onChange={(event) =>
                          update(action.id, { confirm: event.target.checked })
                        }
                        className="size-3.5"
                      />
                      Ask before sending
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink">
                      <Checkbox
                        checked={action.danger}
                        onChange={(event) =>
                          update(action.id, { danger: event.target.checked })
                        }
                        className="size-3.5"
                      />
                      Treat as destructive (red)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink">
                      <Checkbox
                        checked={action.refreshAfter}
                        onChange={(event) =>
                          update(action.id, {
                            refreshAfter: event.target.checked,
                          })
                        }
                        className="size-3.5"
                      />
                      Reload the table afterwards
                    </label>

                    <Input
                      value={action.successMessage ?? ""}
                      onChange={(event) =>
                        update(action.id, {
                          successMessage: event.target.value || undefined,
                        })
                      }
                      placeholder="Message shown when it works"
                      className="h-6 text-[11px]"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {!isToolbar && actions.length > 0 && onRowClickActionChange ? (
        <Field
          label="Clicking anywhere on a row"
          hint="Leave as selecting to keep feeding other tiles on a dashboard."
        >
          <Select
            value={rowClickActionId ?? ""}
            onChange={(event) =>
              onRowClickActionChange(event.target.value || null)
            }
            className="h-7 text-xs"
          >
            <option value="">Selects the row</option>
            {actions
              .filter((action) => action.kind !== "select")
              .map((action) => (
                <option key={action.id} value={action.id}>
                  Runs “{action.label}”
                </option>
              ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Parameter mapping
 * ------------------------------------------------------------------ */

function InputMapping({
  action,
  target,
  fields,
  onChange,
}: {
  action: RowAction;
  target: RowActionTarget;
  fields: FieldDescriptor[];
  onChange: (next: RowActionInput[]) => void;
}) {
  // A form collects the body itself, so only parameters are mapped here.
  const slots = target.params.map((param) => ({
    target: param.name,
    label: param.name,
    hint: `${param.in}${param.required ? " · required" : ""}`,
  }));

  if (action.kind !== "form" && target.hasBody) {
    for (const field of target.formFields) {
      slots.push({
        target: toBodyTarget(field.path),
        label: field.label,
        hint: "body",
      });
    }
  }

  if (slots.length === 0) {
    return (
      <p className="text-[11px] text-ink-faint">
        This endpoint needs nothing beyond the credentials seeIt already adds.
      </p>
    );
  }

  function set(
    slotTarget: string,
    patch: Partial<Omit<RowActionInput, "source">> & {
      source?: RowActionInput["source"] | "skip";
    },
  ) {
    const rest = action.inputs.filter((input) => input.target !== slotTarget);

    if (patch.source === "skip") {
      onChange(rest);
      return;
    }

    const existing = action.inputs.find((input) => input.target === slotTarget);
    onChange([
      ...rest,
      {
        target: slotTarget,
        source: "row",
        ...existing,
        ...patch,
      } as RowActionInput,
    ]);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-ink-soft">
        Where each value comes from
      </p>

      {slots.map((slot) => {
        const input = action.inputs.find((entry) => entry.target === slot.target);
        const source = input?.source ?? "skip";

        return (
          <div key={slot.target} className="rounded-md border border-line p-1.5">
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink">
                {slot.label}
              </span>
              <Badge tone="neutral">{slot.hint}</Badge>
              <Select
                value={source}
                onChange={(event) =>
                  set(slot.target, {
                    source: event.target.value as
                      | RowActionInput["source"]
                      | "skip",
                  })
                }
                className="h-6 w-28 text-[11px]"
              >
                <option value="skip">Leave out</option>
                <option value="row">From the row</option>
                <option value="fixed">Fixed value</option>
                <option value="ask">Ask each time</option>
              </Select>
            </div>

            {source === "row" ? (
              <Select
                value={input?.field ?? ""}
                onChange={(event) =>
                  set(slot.target, { field: event.target.value })
                }
                className="mt-1 h-6 text-[11px]"
              >
                <option value="">Choose a field</option>
                {fields.map((field) => (
                  <option key={field.path} value={field.path}>
                    {field.label} ({field.path})
                  </option>
                ))}
              </Select>
            ) : null}

            {source === "fixed" ? (
              <Input
                value={input?.value ?? ""}
                onChange={(event) =>
                  set(slot.target, { value: event.target.value })
                }
                placeholder="Value sent every time"
                className="mt-1 h-6 text-[11px]"
              />
            ) : null}

            {source === "ask" ? (
              <Input
                value={input?.label ?? ""}
                onChange={(event) =>
                  set(slot.target, { label: event.target.value })
                }
                placeholder="Question shown in the pop-up"
                className="mt-1 h-6 text-[11px]"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Compact visibility list for the boxes a form action shows. */
function FormFieldList({
  fields,
  onChange,
}: {
  fields: NonNullable<RowAction["formFields"]>;
  onChange: (next: NonNullable<RowAction["formFields"]>) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-ink-soft">
        Boxes in the pop-up ({fields.filter((field) => field.visible).length} of{" "}
        {fields.length})
      </p>
      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-line p-1.5">
        {fields.map((field, index) => (
          <div key={field.path} className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const next = [...fields];
                next[index] = { ...field, visible: !field.visible };
                onChange(next);
              }}
              className="text-ink-faint hover:text-ink"
              aria-label={field.visible ? "Hide" : "Show"}
            >
              {field.visible ? (
                <Eye className="size-3" />
              ) : (
                <EyeOff className="size-3" />
              )}
            </button>
            <Input
              value={field.label}
              onChange={(event) => {
                const next = [...fields];
                next[index] = { ...field, label: event.target.value };
                onChange(next);
              }}
              className="h-6 flex-1 text-[11px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Auto-mapping
 * ------------------------------------------------------------------ */

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Guesses where each parameter's value lives on the row, so a "Delete" button
 * usually works the moment its endpoint is chosen.
 */
function autoMapInputs(
  target: RowActionTarget,
  fields: FieldDescriptor[],
  rowIdField: string | null,
): RowActionInput[] {
  const inputs: RowActionInput[] = [];
  const pathParams = target.params.filter((param) => param.in === "path");

  for (const param of target.params) {
    const wanted = normalize(param.name);

    const exact = fields.find((field) => normalize(field.key) === wanted);
    const suffix =
      exact ??
      fields.find(
        (field) =>
          wanted.endsWith(normalize(field.key)) && normalize(field.key).length > 1,
      );

    const match =
      suffix ??
      // A lone path parameter is almost always the row's own id.
      (param.in === "path" && pathParams.length === 1 && rowIdField
        ? fields.find((field) => field.path === rowIdField)
        : undefined);

    if (match) {
      inputs.push({ target: param.name, source: "row", field: match.path });
    } else if (param.required) {
      inputs.push({
        target: param.name,
        source: "ask",
        label: param.description || param.name,
      });
    }
  }

  return inputs;
}
