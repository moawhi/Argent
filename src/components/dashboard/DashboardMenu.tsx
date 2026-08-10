"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  deleteDashboardAction,
  deleteFilterAction,
  saveFilterAction,
  updateDashboardAction,
} from "@/app/dashboards/actions";
import { hideDemoAction } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DashboardAccess } from "@/components/dashboard/DashboardAccess";
import { slugify } from "@/lib/utils";
import type { FilterDefinition } from "@/server/dashboards/service";

const FILTER_KINDS = [
  { value: "dateRange", label: "Date range" },
  { value: "date", label: "Single date" },
  { value: "select", label: "Dropdown" },
  { value: "text", label: "Text box" },
  { value: "number", label: "Number" },
];

/**
 * Dashboard-level settings: rename, manage the global filters that widget
 * parameters bind to, and delete.
 */
export function DashboardMenu({
  dashboardId,
  name,
  description,
  filters,
  filtersVisible,
  access,
  isDemo = false,
  canDelete = true,
  canHideDemo = false,
}: {
  dashboardId: string;
  name: string;
  description: string | null;
  filters: FilterDefinition[];
  filtersVisible: boolean;
  access?: {
    roles: { id: string; label: string; key: string }[];
    users: { id: string; name: string; email: string }[];
    selectedRoleIds: string[];
    selectedUserIds: string[];
  } | null;
  isDemo?: boolean;
  canDelete?: boolean;
  canHideDemo?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftFiltersVisible, setDraftFiltersVisible] = useState(filtersVisible);

  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState("text");
  const [newOptions, setNewOptions] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);

  function addFilter() {
    const label = newLabel.trim();
    const key =
      (newKey.trim() || slugify(label).replace(/-/g, "_") || `filter_${filters.length}`);
    if (!label) return;

    setError(null);
    startTransition(async () => {
      const result = await saveFilterAction(dashboardId, {
        key,
        label,
        kind: newKind,
        defaultValue: newKind === "dateRange" ? null : "",
        options:
          newKind === "select"
            ? {
                values: newOptions
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              }
            : {},
        sortOrder: filters.length,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not add filter.");
        return;
      }
      setNewLabel("");
      setNewKey("");
      setNewOptions("");
      setKeyTouched(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Dashboard settings
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Close settings"
            className="flex-1 bg-ink/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          <aside className="flex w-full max-w-md flex-col overflow-hidden border-l border-line bg-surface shadow-2xl">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold">Dashboard settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X />
              </Button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="space-y-3">
                <Field label="Name">
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    rows={2}
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                  />
                </Field>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <Checkbox
                    checked={draftFiltersVisible}
                    onChange={(event) =>
                      setDraftFiltersVisible(event.target.checked)
                    }
                  />
                  Show filter section on this dashboard
                </label>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateDashboardAction(dashboardId, {
                        name: draftName,
                        description: draftDescription || null,
                        filtersVisible: draftFiltersVisible,
                      });
                      router.refresh();
                    })
                  }
                >
                  {pending ? <Loader2 className="animate-spin" /> : null}
                  Save
                </Button>
              </section>

              <section className="space-y-3 border-t border-line pt-5">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Filters
                  </h4>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    Each filter has a display name and a parameter name that
                    objects bind to (for example{" "}
                    <code className="font-mono">dateRange.from</code>).
                  </p>
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto pr-0.5">
                  {filters.map((filter) => (
                    <FilterEditor
                      key={`${filter.id}:${filter.key}:${filter.label}:${filter.kind}:${filter.sortOrder}`}
                      filter={filter}
                      pending={pending}
                      onSave={(draft) => {
                        setError(null);
                        startTransition(async () => {
                          const result = await saveFilterAction(dashboardId, {
                            id: filter.id,
                            key: draft.key,
                            label: draft.label,
                            kind: draft.kind,
                            defaultValue: filter.defaultValue,
                            options: draft.options,
                            sortOrder: filter.sortOrder,
                          });
                          if (!result.ok) {
                            setError(result.error ?? "Could not save filter.");
                            return;
                          }
                          router.refresh();
                        });
                      }}
                      onDelete={() =>
                        startTransition(async () => {
                          await deleteFilterAction(filter.id);
                          router.refresh();
                        })
                      }
                    />
                  ))}
                  {filters.length === 0 ? (
                    <p className="text-xs text-ink-faint">No filters yet.</p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
                  <p className="text-xs font-medium text-ink-soft">Add filter</p>
                  <Field label="Display name">
                    <Input
                      value={newLabel}
                      onChange={(event) => {
                        const label = event.target.value;
                        setNewLabel(label);
                        if (!keyTouched) {
                          setNewKey(
                            slugify(label).replace(/-/g, "_"),
                          );
                        }
                      }}
                      placeholder="e.g. Account"
                      className="h-8 text-xs"
                    />
                  </Field>
                  <Field
                    label="Parameter name"
                    hint="Used when binding object parameters to this filter."
                  >
                    <Input
                      value={newKey}
                      onChange={(event) => {
                        setKeyTouched(true);
                        setNewKey(event.target.value);
                      }}
                      placeholder="e.g. account_id"
                      className="h-8 font-mono text-xs"
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={newKind}
                      onChange={(event) => setNewKind(event.target.value)}
                      className="h-8 text-xs"
                    >
                      {FILTER_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {newKind === "select" ? (
                    <Field label="Choices">
                      <Input
                        value={newOptions}
                        onChange={(event) => setNewOptions(event.target.value)}
                        placeholder="Comma-separated values"
                        className="h-8 text-xs"
                      />
                    </Field>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={addFilter}
                    disabled={pending || !newLabel.trim()}
                    className="w-full"
                  >
                    <Plus /> Add filter
                  </Button>
                </div>

                {error ? (
                  <p className="text-xs text-danger">{error}</p>
                ) : null}
              </section>

              {access ? (
                <section className="border-t border-line pt-5">
                  <DashboardAccess
                    dashboardId={dashboardId}
                    roles={access.roles}
                    users={access.users}
                    selectedRoleIds={access.selectedRoleIds}
                    selectedUserIds={access.selectedUserIds}
                  />
                </section>
              ) : null}

              <section className="border-t border-line pt-5 space-y-2">
                {canHideDemo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await hideDemoAction();
                        router.push("/dashboards");
                      });
                    }}
                  >
                    {pending ? <Loader2 className="animate-spin" /> : <EyeOff />}
                    Hide this example
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 />{" "}
                    {isDemo ? "Remove the demo" : "Delete this dashboard"}
                  </Button>
                ) : null}
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        destructive
        title={isDemo ? "Remove the bundled demo?" : `Delete “${name}”?`}
        description={
          isDemo
            ? "This deletes the example connection, its objects and this dashboard. You can load it again later from the home page."
            : "The dashboard and its layout are removed. The objects on it are kept and stay available for other dashboards."
        }
        confirmLabel={isDemo ? "Remove the demo" : "Delete dashboard"}
        confirmWord={isDemo ? undefined : name}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          startTransition(async () => {
            if (isDemo) {
              const { removeDemoAction } = await import("@/app/demo/actions");
              await removeDemoAction();
            } else {
              await deleteDashboardAction(dashboardId);
            }
            router.push("/dashboards");
          })
        }
      />
    </>
  );
}

function FilterEditor({
  filter,
  pending,
  onSave,
  onDelete,
}: {
  filter: FilterDefinition;
  pending: boolean;
  onSave: (draft: {
    label: string;
    key: string;
    kind: string;
    options: unknown;
  }) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(filter.label);
  const [key, setKey] = useState(filter.key);
  const [kind, setKind] = useState(filter.kind);
  const selectValues =
    ((filter.options as { values?: string[] })?.values ?? []).join(", ");
  const [optionsText, setOptionsText] = useState(selectValues);

  const dirty =
    label !== filter.label ||
    key !== filter.key ||
    kind !== filter.kind ||
    (kind === "select" && optionsText !== selectValues);

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <Field label="Display name">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="h-8 text-xs"
        />
      </Field>
      <Field label="Parameter name">
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="h-8 font-mono text-xs"
        />
      </Field>
      <Field label="Type">
        <Select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="h-8 text-xs"
        >
          {FILTER_KINDS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Field>
      {kind === "select" ? (
        <Field label="Choices">
          <Input
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            className="h-8 text-xs"
            placeholder="Comma-separated values"
          />
        </Field>
      ) : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-danger"
        >
          <Trash2 className="size-3.5" />
          Remove
        </button>
        <Button
          size="sm"
          disabled={pending || !dirty || !label.trim() || !key.trim()}
          onClick={() =>
            onSave({
              label: label.trim(),
              key: key.trim(),
              kind,
              options:
                kind === "select"
                  ? {
                      values: optionsText
                        .split(",")
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    }
                  : filter.options ?? {},
            })
          }
        >
          Save filter
        </Button>
      </div>
    </div>
  );
}
