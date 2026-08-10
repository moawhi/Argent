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
  addWidgetAction,
  removeWidgetAction,
  saveLayoutAction,
  updateWidgetAction,
} from "@/app/dashboards/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ObjectRenderer } from "@/components/objects/ObjectRenderer";
import { FilterBar, initialFilterValues, type FilterValues } from "./FilterBar";
import { AddWidgetDialog } from "./AddWidgetDialog";
import { openHelp } from "@/lib/help-store";
import { cn, getByPath } from "@/lib/utils";
import type { FilterDefinition, WidgetView } from "@/server/dashboards/service";
import type { RowAction, TableConfig } from "@/lib/objects/types";

const ROW_HEIGHT = 28;
const MARGIN: readonly [number, number] = [12, 12];
const COMPACT_MARGIN: readonly [number, number] = [8, 8];
/** Stack tiles into one column below this container width (px). */
const COMPACT_BREAKPOINT = 768;

/** Derive a single-column layout from the saved 12-col desktop layout. */
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
  filters,
  filtersVisible = true,
  widgets,
  availableObjects,
}: {
  dashboardId: string;
  filters: FilterDefinition[];
  filtersVisible?: boolean;
  widgets: WidgetView[];
  availableObjects: AvailableObject[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { width, containerRef, mounted } = useContainerWidth();
  const isCompact = mounted && width > 0 && width < COMPACT_BREAKPOINT;

  const [editing, setEditing] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>(() =>
    initialFilterValues(filters),
  );
  const [selection, setSelection] = useState<
    Record<string, Record<string, unknown> | null>
  >({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<WidgetView | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const layoutRef = useRef<Layout>([]);
  const didAutoCollapseFilters = useRef(false);

  // On phones, start with filters tucked away so tiles get the first screen.
  useEffect(() => {
    if (isCompact && !didAutoCollapseFilters.current) {
      setFiltersCollapsed(true);
      didAutoCollapseFilters.current = true;
    }
  }, [isCompact]);

  // Arranging on a stacked layout would overwrite the desktop grid — bail out.
  useEffect(() => {
    if (isCompact && editing) {
      setEditing(false);
      setLinking(null);
    }
  }, [isCompact, editing]);

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
      // Never capture the stacked mobile layout for persistence.
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

  if (widgets.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={<Plus className="size-5" />}
          title="This dashboard is empty"
          description="Add an object you have already built, or create a new one from any endpoint."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => setAdding(true)}
                disabled={availableObjects.length === 0}
              >
                <Plus /> Add an object
              </Button>
              <Link href="/objects/new">
                <Button variant="secondary">Build a new object</Button>
              </Link>
            </div>
          }
        />

        <AddWidgetDialog
          open={adding}
          objects={availableObjects}
          onClose={() => setAdding(false)}
          onAdd={(objectId) =>
            startTransition(async () => {
              await addWidgetAction(dashboardId, objectId);
              setAdding(false);
              router.refresh();
            })
          }
        />
      </div>
    );
  }

  const canArrange = !isCompact;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {filtersVisible && filters.length > 0 ? (
        <FilterBar
          filters={filters}
          values={filterValues}
          onChange={setFilterValues}
          collapsed={filtersCollapsed}
          onToggleCollapsed={() => setFiltersCollapsed((value) => !value)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 sm:gap-3 sm:px-6">
        <p className="min-w-0 text-xs text-ink-soft">
          {editing
            ? "Drag the handle on each tile to move it, pull the corner to resize, or use the pencil to edit."
            : isCompact
              ? `${widgets.length} tile${widgets.length === 1 ? "" : "s"} · stacked for this screen`
              : `${widgets.length} tile${widgets.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus />
            <span className="hidden sm:inline">Add object</span>
            <span className="sm:hidden">Add</span>
          </Button>
          {canArrange ? (
            <Button
              size="sm"
              variant={editing ? "primary" : "ghost"}
              onClick={() => {
                if (editing) persistLayout();
                setEditing(!editing);
              }}
            >
              {editing ? <Check /> : <Settings2 />}
              <span className="hidden sm:inline">
                {editing ? "Done arranging" : "Arrange"}
              </span>
              <span className="sm:hidden">{editing ? "Done" : "Arrange"}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4"
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
              enabled: editing && canArrange,
              handle: ".widget-drag-handle",
            }}
            resizeConfig={{
              enabled: editing && canArrange,
              handles: ["se"],
            }}
            onLayoutChange={handleLayoutChange}
            onDragStop={canArrange ? persistLayout : undefined}
            onResizeStop={canArrange ? persistLayout : undefined}
          >
            {widgets.map((widget) => {
              const isTable = widget.object.kind === "table";
              const isKpi = widget.object.kind === "kpi";
              const selected = selection[widget.id];
              const rowIdField = isTable
                ? (widget.object.config as TableConfig).rowIdField
                : null;

              return (
                <div key={widget.id} className="min-w-0">
                  <Card
                    className={cn(
                      "relative flex h-full flex-col overflow-hidden",
                      isKpi && "border-0 bg-transparent p-0 shadow-none",
                      editing && "ring-2 ring-brand/25",
                    )}
                  >
                    {isKpi && editing ? (
                      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface/95 p-0.5 shadow-sm backdrop-blur-sm">
                        <span
                          className="widget-drag-handle cursor-move rounded p-1 text-ink-faint hover:bg-canvas hover:text-ink"
                          title="Drag to move"
                        >
                          <GripVertical className="size-3.5" />
                        </span>
                        <Link
                          href={`/objects/${widget.object.id}`}
                          title="Edit this number card"
                          className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-ink"
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                        <button
                          onClick={() => setRemoving(widget)}
                          title="Remove from this dashboard"
                          className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-danger"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {!isKpi ? (
                      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                        {editing ? (
                          <span className="widget-drag-handle cursor-move text-ink-faint hover:text-ink">
                            <GripVertical className="size-3.5" />
                          </span>
                        ) : null}

                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {widget.title ?? widget.object.name}
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
                            <Link
                              href={`/objects/${widget.object.id}`}
                              title="Edit this object"
                              className="text-ink-faint hover:text-ink"
                            >
                              <Pencil className="size-3.5" />
                            </Link>
                            <button
                              onClick={() => setRemoving(widget)}
                              title="Remove from this dashboard"
                              className="text-ink-faint hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        ) : widget.object.operationKey ? (
                          <button
                            onClick={() =>
                              openHelp({
                                connectionId: widget.object.connectionId,
                                operationKey: widget.object.operationKey!,
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
                                candidate.object.kind === "table",
                            )
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.title ?? candidate.object.name}
                              </option>
                            ))}
                        </Select>
                      </div>
                    ) : null}

                    <div className={cn("min-h-0 flex-1", isKpi && "h-full")}>
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
                    </div>
                  </Card>
                </div>
              );
            })}
          </GridLayout>
        ) : null}
      </div>

      <AddWidgetDialog
        open={adding}
        objects={availableObjects}
        onClose={() => setAdding(false)}
        onAdd={(objectId) =>
          startTransition(async () => {
            await addWidgetAction(dashboardId, objectId);
            setAdding(false);
            router.refresh();
          })
        }
      />

      <ConfirmDialog
        open={removing !== null}
        title="Remove this tile?"
        description={`“${removing?.title ?? removing?.object.name}” is taken off this dashboard. The object itself is kept, so you can add it back later.`}
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
