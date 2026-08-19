"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  Home,
  Loader2,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteDashboardAction,
  deleteFilterAction,
  saveFilterAction,
  updateDashboardAction,
} from "@/app/dashboards/actions";
import {
  createMenuItemAction,
  createPageAction,
  deleteMenuItemAction,
  deletePageAction,
  reorderPagesAction,
  updateMenuItemAction,
  updatePageAction,
  setSitePublishedAction,
} from "@/app/sites/actions";
import { hideDemoAction } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DashboardAccess } from "@/components/dashboard/DashboardAccess";
import { slugify } from "@/lib/utils";
import { siteLivePath } from "@/lib/sites/paths";
import Link from "next/link";
import type { FilterDefinition, MenuItemView, PageSummary } from "@/server/dashboards/service";

const FILTER_KINDS = [
  { value: "dateRange", label: "Date range" },
  { value: "date", label: "Single date" },
  { value: "select", label: "Dropdown" },
  { value: "text", label: "Text box" },
  { value: "number", label: "Number" },
];

type SettingsTab = "site" | "pages" | "menu" | "filters";

export function SiteSettings({
  dashboardId,
  name,
  description,
  filters,
  filtersVisible,
  published = false,
  slug,
  pages,
  menuId,
  menuItems,
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
  published?: boolean;
  slug: string;
  pages: PageSummary[];
  menuId: string | null;
  menuItems: MenuItemView[];
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
  const [tab, setTab] = useState<SettingsTab>("site");

  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftFiltersVisible, setDraftFiltersVisible] = useState(filtersVisible);

  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState("text");
  const [newOptions, setNewOptions] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newMenuLabel, setNewMenuLabel] = useState("");
  const [newMenuPageId, setNewMenuPageId] = useState(pages[0]?.id ?? "");

  function addFilter() {
    const label = newLabel.trim();
    const key =
      newKey.trim() || slugify(label).replace(/-/g, "_") || `filter_${filters.length}`;
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
        <SlidersHorizontal /> Site settings
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
              <h3 className="text-sm font-semibold">Site settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X />
              </Button>
            </header>

            <div className="flex gap-1 border-b border-line px-3 py-2">
              {(
                [
                  ["site", "Site"],
                  ["pages", "Pages"],
                  ["menu", "Menu"],
                  ["filters", "Filters"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={
                    tab === id
                      ? "rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand-ink"
                      : "rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-canvas"
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {tab === "site" ? (
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
                    Show filter section on this site
                  </label>
                  <div className="rounded-lg border border-line p-3">
                    <p className="text-sm font-medium">
                      {published ? "This site is published" : "Not published yet"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      Publishing opens a full-screen live view without the Argent
                      sidebar or builder tools. Unpublished sites can still be
                      previewed by people who can edit them.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={published ? "secondary" : "primary"}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await setSitePublishedAction(dashboardId, !published);
                            router.refresh();
                          })
                        }
                      >
                        {pending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Upload />
                        )}
                        {published ? "Unpublish" : "Publish"}
                      </Button>
                      <Link href={`${siteLivePath(slug)}?fs=1`}>
                        <Button size="sm" variant="ghost">
                          View fullscreen
                        </Button>
                      </Link>
                    </div>
                  </div>
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
              ) : null}

              {tab === "pages" ? (
                <section className="space-y-3">
                  <p className="text-[11px] text-ink-faint">
                    Pages appear in the site menu once you add a menu item that
                    points at them.
                  </p>
                  {pages.map((page, index) => (
                    <div
                      key={page.id}
                      className="space-y-2 rounded-lg border border-line p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          defaultValue={page.name}
                          className="h-8 text-xs"
                          onBlur={(event) => {
                            const next = event.target.value.trim();
                            if (!next || next === page.name) return;
                            startTransition(async () => {
                              await updatePageAction(dashboardId, page.id, {
                                name: next,
                              });
                              router.refresh();
                            });
                          }}
                        />
                        {page.isHome ? (
                          <span className="text-[10px] font-medium text-brand-ink">
                            Home
                          </span>
                        ) : (
                          <button
                            type="button"
                            title="Make home page"
                            className="text-ink-faint hover:text-ink"
                            onClick={() =>
                              startTransition(async () => {
                                await updatePageAction(dashboardId, page.id, {
                                  isHome: true,
                                });
                                router.refresh();
                              })
                            }
                          >
                            <Home className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            className="rounded p-1 text-ink-faint hover:text-ink disabled:opacity-30"
                            onClick={() => {
                              const ids = pages.map((entry) => entry.id);
                              [ids[index - 1], ids[index]] = [
                                ids[index],
                                ids[index - 1],
                              ];
                              startTransition(async () => {
                                await reorderPagesAction(dashboardId, ids);
                                router.refresh();
                              });
                            }}
                          >
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === pages.length - 1}
                            className="rounded p-1 text-ink-faint hover:text-ink disabled:opacity-30"
                            onClick={() => {
                              const ids = pages.map((entry) => entry.id);
                              [ids[index + 1], ids[index]] = [
                                ids[index],
                                ids[index + 1],
                              ];
                              startTransition(async () => {
                                await reorderPagesAction(dashboardId, ids);
                                router.refresh();
                              });
                            }}
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </div>
                        {pages.length > 1 ? (
                          <button
                            type="button"
                            className="text-xs text-ink-faint hover:text-danger"
                            onClick={() =>
                              startTransition(async () => {
                                await deletePageAction(dashboardId, page.id);
                                router.refresh();
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newPageName}
                      onChange={(event) => setNewPageName(event.target.value)}
                      placeholder="New page name"
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending || !newPageName.trim()}
                      onClick={() =>
                        startTransition(async () => {
                          await createPageAction(dashboardId, newPageName);
                          setNewPageName("");
                          router.refresh();
                        })
                      }
                    >
                      <Plus /> Add
                    </Button>
                  </div>
                </section>
              ) : null}

              {tab === "menu" ? (
                <section className="space-y-3">
                  <p className="text-[11px] text-ink-faint">
                    Header links. Nested items become a dropdown.
                  </p>
                  {!menuId ? (
                    <p className="text-xs text-ink-soft">
                      This site has no header menu yet.
                    </p>
                  ) : (
                    <>
                      {menuItems.map((item) => (
                        <MenuItemEditor
                          key={item.id}
                          dashboardId={dashboardId}
                          item={item}
                          pages={pages}
                          pending={pending}
                          onRefresh={() => router.refresh()}
                        />
                      ))}
                      <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
                        <Field label="Label">
                          <Input
                            value={newMenuLabel}
                            onChange={(event) =>
                              setNewMenuLabel(event.target.value)
                            }
                            className="h-8 text-xs"
                          />
                        </Field>
                        <Field label="Page">
                          <Select
                            value={newMenuPageId}
                            onChange={(event) =>
                              setNewMenuPageId(event.target.value)
                            }
                            className="h-8 text-xs"
                          >
                            {pages.map((page) => (
                              <option key={page.id} value={page.id}>
                                {page.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          disabled={pending || !newMenuLabel.trim()}
                          onClick={() =>
                            startTransition(async () => {
                              await createMenuItemAction(dashboardId, menuId, {
                                label: newMenuLabel,
                                pageId: newMenuPageId || null,
                              });
                              setNewMenuLabel("");
                              router.refresh();
                            })
                          }
                        >
                          <Plus /> Add item
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              ) : null}

              {tab === "filters" ? (
                <section className="space-y-3">
                  <p className="text-[11px] text-ink-faint">
                    Each filter has a display name and a parameter name that
                    objects bind to (for example{" "}
                    <code className="font-mono">dateRange.from</code>).
                  </p>
                  {filters.map((filter) => (
                    <FilterEditor
                      key={`${filter.id}:${filter.key}`}
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
                  <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
                    <p className="text-xs font-medium text-ink-soft">Add filter</p>
                    <Field label="Display name">
                      <Input
                        value={newLabel}
                        onChange={(event) => {
                          const label = event.target.value;
                          setNewLabel(label);
                          if (!keyTouched) {
                            setNewKey(slugify(label).replace(/-/g, "_"));
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </Field>
                    <Field label="Parameter name">
                      <Input
                        value={newKey}
                        onChange={(event) => {
                          setKeyTouched(true);
                          setNewKey(event.target.value);
                        }}
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
                  {error ? <p className="text-xs text-danger">{error}</p> : null}
                </section>
              ) : null}

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

              <section className="space-y-2 border-t border-line pt-5">
                {canHideDemo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await hideDemoAction();
                        router.push("/sites");
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
                    <Trash2 /> {isDemo ? "Remove the demo" : "Delete this site"}
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
            ? "This deletes the example connection, its objects and this site. You can load it again later from the home page."
            : "The site, pages and layout are removed. The objects on it are kept."
        }
        confirmLabel={isDemo ? "Remove the demo" : "Delete site"}
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
            router.push("/sites");
          })
        }
      />
    </>
  );
}

function MenuItemEditor({
  dashboardId,
  item,
  pages,
  pending,
  onRefresh,
}: {
  dashboardId: string;
  item: MenuItemView;
  pages: PageSummary[];
  pending: boolean;
  onRefresh: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => {
          if (label.trim() === item.label) return;
          void updateMenuItemAction(dashboardId, item.id, {
            label: label.trim(),
          }).then(onRefresh);
        }}
        className="h-8 text-xs"
      />
      <Select
        value={item.pageId ?? ""}
        onChange={(event) =>
          void updateMenuItemAction(dashboardId, item.id, {
            pageId: event.target.value || null,
          }).then(onRefresh)
        }
        className="h-8 text-xs"
      >
        <option value="">No page</option>
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {page.name}
          </option>
        ))}
      </Select>
      {item.children.length > 0 ? (
        <ul className="space-y-1 border-l border-line pl-2">
          {item.children.map((child) => (
            <li key={child.id} className="text-xs text-ink-soft">
              {child.label}
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          void deleteMenuItemAction(dashboardId, item.id).then(onRefresh)
        }
        className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-danger"
      >
        <Trash2 className="size-3.5" />
        Remove
      </button>
    </div>
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
