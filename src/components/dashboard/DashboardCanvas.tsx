"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GridLayout, {
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import {
  Check,
  GripVertical,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  removeWidgetAction,
  saveLayoutAction,
  updateWidgetAction,
} from "@/app/dashboards/actions";
import {
  addContentWidgetAction,
  addObjectWidgetAction,
} from "@/app/sites/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ObjectRenderer } from "@/components/objects/ObjectRenderer";
import { AddWidgetDialog } from "./AddWidgetDialog";
import { ContentBlock } from "@/components/sites/ContentBlock";
import { SiteObjectEditor } from "@/components/sites/SiteObjectEditor";
import { openHelp } from "@/lib/help-store";
import { cn, getByPath } from "@/lib/utils";
import type { WidgetView } from "@/server/dashboards/service";
import type { FilterValues } from "./FilterBar";
import type { RowAction, TableConfig } from "@/lib/objects/types";
import type { BlockKind } from "@/lib/sites/types";

const ROW_HEIGHT = 28;
const MARGIN: readonly [number, number] = [12, 12];
const COMPACT_MARGIN: readonly [number, number] = [8, 8];
const COMPACT_BREAKPOINT = 768;

function toCompactLayout(items: Layout): Layout {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  let y = 0;
  return sorted.map((item) => {
    const h = Math.max(item.h, item.minH ?? 3);
    const next: LayoutItem = {
      ...item,
      x: 0,
      y,
      w: 1,
      minW: 1,
      static: true,
      h,
    };
    y += h;
    return next;
  });
}

export interface AvailableObject {
  id: string;
  name: string;
  kind: string;
  connectionName: string;
  summary: string | null;
}

export function DashboardCanvas({
  dashboardId,
  tabId,
  widgets,
  availableObjects,
  filterValues,
  onEditingChange,
  preview = false,
}: {
  dashboardId: string;
  tabId: string;
  filterValues: FilterValues;
  widgets: WidgetView[];
  availableObjects: AvailableObject[];
  onEditingChange?: (editing: boolean) => void;
  preview?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { width, containerRef, mounted } = useContainerWidth();
  const isCompact = mounted && width > 0 && width < COMPACT_BREAKPOINT;

  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<
    Record<string, Record<string, unknown> | null>
  >({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<WidgetView | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const layoutRef = useRef<Layout>([]);

  useEffect(() => {
    if (isCompact && editing) {
      setEditing(false);
      setLinking(null);
      setEditingObjectId(null);
      onEditingChange?.(false);
    }
  }, [isCompact, editing, onEditingChange]);

  const desktopLayout = useMemo<Layout>(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        minW: 2,
        minH: 3,
      })),
    [widgets],
  );

  const displayLayout = useMemo(
    () => (isCompact ? toCompactLayout(desktopLayout) : desktopLayout),
    [desktopLayout, isCompact],
  );

  const handleLayoutChange = useCallback(
    (next: Layout) => {
      if (isCompact) return;
      layoutRef.current = next;
    },
    [isCompact],
  );

  function persistLayout() {
    if (isCompact) return;
    const next = layoutRef.current;
    if (next.length === 0) return;

    startTransition(async () => {
      await saveLayoutAction(
        dashboardId,
        next.map((item) => ({
          id: String(item.i),
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
      );
      router.refresh();
    });
  }

  function setEditingMode(next: boolean) {
    setEditing(next);
    if (!next) setEditingObjectId(null);
    onEditingChange?.(next);
  }

  function selectionFor(widget: WidgetView): Record<string, unknown> | null {
    if (!widget.linkedWidgetId) return null;
    return selection[widget.linkedWidgetId] ?? null;
  }

  function handleRowAction(
    widget: WidgetView,
    _action: RowAction,
    row: Record<string, unknown>,
  ) {
    setSelection((current) => ({ ...current, [widget.id]: row }));
  }

  function widgetLabel(widget: WidgetView) {
    if (widget.title) return widget.title;
    if (widget.object) return widget.object.name;
    if (widget.blockKind === "heading") return "Heading";
    if (widget.blockKind === "image") return "Image";
    return "Text";
  }

  const addDialog = (
    <AddWidgetDialog
      open={adding}
      objects={availableObjects}
      onClose={() => setAdding(false)}
      onAddObject={(objectId) =>
        startTransition(async () => {
          await addObjectWidgetAction(tabId, objectId);
          setAdding(false);
          router.refresh();
        })
      }
      onAddContent={(kind) =>
        startTransition(async () => {
          await addContentWidgetAction(tabId, kind);
          setAdding(false);
          router.refresh();
        })
      }
    />
  );

  if (widgets.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={<Plus className="size-5" />}
          title="This page is empty"
          description={
            preview
              ? "Nothing has been added to this page yet."
              : "Add a heading or some text, or drop in an object you have already built."
          }
          action={
            preview ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setAdding(true)}>
                  <Plus /> Add a tile
                </Button>
                <Link href="/objects/new">
                  <Button variant="secondary">Build a new object</Button>
                </Link>
              </div>
            )
          }
        />
        {preview ? null : addDialog}
      </div>
    );
  }

  const canDesign = !isCompact && !preview;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {preview ? null : (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 sm:gap-3 sm:px-6">
        <p className="min-w-0 text-xs text-ink-soft">
          {editing
            ? "Drag the handle to move a tile, pull the corner to resize, or click an object to edit it here."
            : isCompact
              ? `${widgets.length} tile${widgets.length === 1 ? "" : "s"} · stacked for this screen`
              : `${widgets.length} tile${widgets.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus />
            <span className="hidden sm:inline">Add tile</span>
            <span className="sm:hidden">Add</span>
          </Button>
          {canDesign ? (
            <Button
              size="sm"
              variant={editing ? "primary" : "ghost"}
              onClick={() => {
                if (editing) persistLayout();
                setEditingMode(!editing);
              }}
            >
              {editing ? <Check /> : <Settings2 />}
              <span className="hidden sm:inline">
                {editing ? "Done" : "Design"}
              </span>
              <span className="sm:hidden">{editing ? "Done" : "Design"}</span>
            </Button>
          ) : null}
        </div>
      </div>
      )}

      <div className="flex min-h-0 flex-1">
      <div
        ref={containerRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4"
      >
        {mounted ? (
          <GridLayout
            width={width}
            layout={displayLayout}
            gridConfig={{
              cols: isCompact ? 1 : 12,
              rowHeight: ROW_HEIGHT,
              margin: isCompact ? COMPACT_MARGIN : MARGIN,
            }}
            dragConfig={{
              enabled: editing && canDesign,
              handle: ".widget-drag-handle",
            }}
            resizeConfig={{
              enabled: editing && canDesign,
              handles: ["se"],
            }}
            onLayoutChange={handleLayoutChange}
            onDragStop={canDesign ? persistLayout : undefined}
            onResizeStop={canDesign ? persistLayout : undefined}
          >
            {widgets.map((widget) => {
              const isContent = widget.blockKind !== "object";
              const isTable = widget.object?.kind === "table";
              const isKpi = widget.object?.kind === "kpi";
              const hideChrome = isContent || isKpi;
              const selected = selection[widget.id];
              const rowIdField = isTable
                ? (widget.object?.config as TableConfig).rowIdField
                : null;
              const editingThisObject =
                widget.object != null && widget.object.id === editingObjectId;

              return (
                <div key={widget.id} className="min-w-0">
                  <Card
                    className={cn(
                      "relative flex h-full flex-col overflow-hidden",
                      isKpi && "border-0 bg-transparent p-0 shadow-none",
                      editing && "ring-2 ring-brand/25",
                      editingThisObject && "ring-2 ring-brand",
                      editing && widget.object && "cursor-pointer",
                    )}
                    onClick={(event) => {
                      if (!editing) return;
                      if (
                        widget.object &&
                        (event.target as HTMLElement).closest(
                          "button, a, input, select, textarea, label, table",
                        )
                      ) {
                        return;
                      }
                      setEditingObjectId(widget.object?.id ?? null);
                    }}
                  >
                    {editing && hideChrome ? (
                      <div
                        className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface/95 p-0.5 shadow-sm backdrop-blur-sm"
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <span
                          className="widget-drag-handle cursor-move rounded p-1 text-ink-faint hover:bg-canvas hover:text-ink"
                          title="Drag to move"
                        >
                          <GripVertical className="size-3.5" />
                        </span>
                        {widget.object ? (
                          <button
                            type="button"
                            onClick={() => setEditingObjectId(widget.object!.id)}
                            title="Edit this object"
                            className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-ink"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setRemoving(widget)}
                          title="Remove from this page"
                          className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-danger"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {!hideChrome ? (
                      <div
                        className="flex items-center gap-1.5 border-b border-line px-3 py-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {editing ? (
                          <span className="widget-drag-handle cursor-move text-ink-faint hover:text-ink">
                            <GripVertical className="size-3.5" />
                          </span>
                        ) : null}

                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {widgetLabel(widget)}
                        </h3>

                        {widget.linkedWidgetId ? (
                          <Badge
                            tone="brand"
                            title="Filled in from another tile"
                          >
                            <Link2 className="size-2.5" />
                            <span className="hidden sm:inline">Linked</span>
                          </Badge>
                        ) : null}

                        {selected ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelection((current) => ({
                                ...current,
                                [widget.id]: null,
                              }))
                            }
                            className="flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand-ink"
                          >
                            <span className="hidden sm:inline">
                              Row selected
                            </span>
                            <span className="sm:hidden">Selected</span>
                            <X className="size-2.5" />
                          </button>
                        ) : null}

                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setLinking(
                                  linking === widget.id ? null : widget.id,
                                )
                              }
                              title="Link to another tile"
                              className="text-ink-faint hover:text-ink"
                            >
                              {widget.linkedWidgetId ? (
                                <Link2Off className="size-3.5" />
                              ) : (
                                <Link2 className="size-3.5" />
                              )}
                            </button>
                            {widget.object ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingObjectId(widget.object!.id)
                                }
                                title="Edit this object"
                                className="text-ink-faint hover:text-ink"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setRemoving(widget)}
                              title="Remove from this page"
                              className="text-ink-faint hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        ) : widget.object?.operationKey ? (
                          <button
                            type="button"
                            onClick={() =>
                              openHelp({
                                connectionId: widget.object!.connectionId,
                                operationKey: widget.object!.operationKey!,
                              })
                            }
                            title="Where does this data come from?"
                            className="text-[11px] text-ink-faint hover:text-brand"
                          >
                            ?
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {editing && linking === widget.id ? (
                      <div className="border-b border-line bg-brand-soft/50 p-2">
                        <p className="mb-1 text-[11px] text-ink">
                          Fill this tile in from the row selected in:
                        </p>
                        <Select
                          value={widget.linkedWidgetId ?? ""}
                          onChange={(event) =>
                            startTransition(async () => {
                              await updateWidgetAction(widget.id, {
                                linkedWidgetId: event.target.value || null,
                              });
                              setLinking(null);
                              router.refresh();
                            })
                          }
                          className="h-7 text-xs"
                        >
                          <option value="">Nothing</option>
                          {widgets
                            .filter(
                              (candidate) =>
                                candidate.id !== widget.id &&
                                candidate.object?.kind === "table",
                            )
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {widgetLabel(candidate)}
                              </option>
                            ))}
                        </Select>
                      </div>
                    ) : null}

                    <div className={cn("min-h-0 flex-1", isKpi && "h-full")}>
                      {isContent ? (
                        <ContentBlock
                          widgetId={widget.id}
                          blockKind={widget.blockKind as Exclude<BlockKind, "object">}
                          blockConfig={widget.blockConfig}
                          editing={editing}
                        />
                      ) : widget.object ? (
                        <ObjectRenderer
                          key={`${widget.id}-${dataVersion}`}
                          object={{
                            id: widget.object.id,
                            name: widget.object.name,
                            kind: widget.object.kind,
                            config: widget.object.config,
                            method: widget.object.method ?? undefined,
                          }}
                          filters={filterValues}
                          selection={selectionFor(widget)}
                          readOnly={widget.object.connectionReadOnly}
                          title={widget.title ?? widget.object.name}
                          onRowSelect={
                            isTable
                              ? (row) =>
                                  setSelection((current) => ({
                                    ...current,
                                    [widget.id]: row,
                                  }))
                              : undefined
                          }
                          selectedRowId={
                            isTable && selected && rowIdField
                              ? String(getByPath(selected, rowIdField) ?? "")
                              : null
                          }
                          onRowAction={
                            isTable
                              ? (action, row) =>
                                  handleRowAction(widget, action, row)
                              : undefined
                          }
                          onDataChanged={() => setDataVersion((v) => v + 1)}
                        />
                      ) : null}
                    </div>
                  </Card>
                </div>
              );
            })}
          </GridLayout>
        ) : null}
      </div>
      {editingObjectId ? (
        <div className="flex w-[26rem] shrink-0 flex-col overflow-hidden border-l border-line bg-surface">
          <SiteObjectEditor
            key={editingObjectId}
            objectId={editingObjectId}
            onClose={() => setEditingObjectId(null)}
            onSaved={() => {
              setDataVersion((version) => version + 1);
              router.refresh();
            }}
          />
        </div>
      ) : null}
      </div>

      {preview ? null : addDialog}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this tile?"
        description={`“${removing ? widgetLabel(removing) : ""}” is taken off this page. Objects themselves are kept.`}
        confirmLabel="Remove tile"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (!target) return;
          startTransition(async () => {
            await removeWidgetAction(target.id);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
