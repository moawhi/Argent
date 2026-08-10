"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";
import { CellValue } from "@/lib/objects/format";
import {
  ROW_ACTION_ICON,
  isWriteAction,
  normalizeRowAction,
} from "@/lib/objects/row-actions";
import { cn, getByPath } from "@/lib/utils";
import type { RowAction, TableConfig } from "@/lib/objects/types";

export interface TableObjectProps {
  config: TableConfig;
  rows: Record<string, unknown>[];
  onRowSelect?: (row: Record<string, unknown> | null) => void;
  selectedRowId?: string | null;
  onRowAction?: (action: RowAction, row: Record<string, unknown>) => void;
  /** Greys out actions that would change data. */
  readOnly?: boolean;
  compact?: boolean;
  /** Load each page from the gateway instead of paging in memory. */
  serverPagination?: boolean;
  pageIndex?: number;
  pageSize?: number;
  hasMore?: boolean;
  loading?: boolean;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * The generic list renderer. Column definitions come from the object's saved
 * config, which was itself generated from the endpoint's response schema.
 */
export function TableObject({
  config,
  rows,
  onRowSelect,
  selectedRowId,
  onRowAction,
  readOnly,
  compact,
  serverPagination = false,
  pageIndex = 0,
  pageSize,
  hasMore = false,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: TableObjectProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const effectivePageSize = pageSize ?? config.pageSize;

  const visibleColumns = useMemo(
    () => config.columns.filter((column) => column.visible),
    [config.columns],
  );

  const actions = useMemo(
    () => (config.rowActions ?? []).map(normalizeRowAction),
    [config.rowActions],
  );

  const toolbarActions = useMemo(
    () => (config.toolbarActions ?? []).map(normalizeRowAction),
    [config.toolbarActions],
  );

  // Clicking anywhere on the row can open an action instead of selecting it.
  const clickAction = useMemo(
    () =>
      config.rowClickActionId
        ? (actions.find((action) => action.id === config.rowClickActionId) ??
          null)
        : null,
    [actions, config.rowClickActionId],
  );

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const base: ColumnDef<Record<string, unknown>>[] = visibleColumns.map(
      (column) => ({
        id: column.path,
        accessorFn: (row) => getByPath(row, column.path),
        header: column.label,
        cell: (info) => (
          <CellValue
            value={info.getValue()}
            format={column.format}
            compact={compact}
          />
        ),
        sortingFn: (a, b, columnId) => {
          const left = a.getValue(columnId);
          const right = b.getValue(columnId);
          const leftNum = Number(left);
          const rightNum = Number(right);
          if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
            return leftNum - rightNum;
          }
          return String(left ?? "").localeCompare(String(right ?? ""));
        },
        meta: { align: column.align },
      }),
    );

    if (actions.length > 0 && onRowAction) {
      base.push({
        id: "__actions",
        header: "Options",
        enableSorting: false,
        cell: (info) => (
          <div className="flex justify-end gap-0.5">
            {actions.map((action) => {
              const Icon = ROW_ACTION_ICON[action.icon] ?? ROW_ACTION_ICON.settings;
              const blocked = Boolean(readOnly) && isWriteAction(action);

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={blocked}
                  title={
                    blocked
                      ? `${action.label} — turned off while this connection is read-only`
                      : action.label
                  }
                  aria-label={action.label}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRowAction(action, info.row.original);
                  }}
                  className={cn(
                    "rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                    action.danger
                      ? "text-ink-faint hover:bg-danger-soft hover:text-danger"
                      : "text-ink-faint hover:bg-brand-soft hover:text-brand",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        ),
        meta: { align: "right" },
      });
    }

    return base;
  }, [visibleColumns, actions, onRowAction, readOnly, compact]);

  const table = useReactTable({
    data: rows,
    columns,
    state: serverPagination
      ? { globalFilter, sorting }
      : { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(serverPagination
      ? { manualPagination: true }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize: effectivePageSize } },
        }),
  });

  const rowId = config.rowIdField;
  const cellPadding = config.density === "compact" ? "px-2.5 py-1" : "px-3 py-2";
  const showToolbar =
    config.searchable ||
    serverPagination ||
    (toolbarActions.length > 0 && Boolean(onRowAction));

  function renderToolbarActions() {
    if (!onRowAction || toolbarActions.length === 0) return null;

    return (
      <div className="flex shrink-0 items-center gap-0.5">
        {toolbarActions.map((action) => {
          const Icon = ROW_ACTION_ICON[action.icon] ?? ROW_ACTION_ICON.settings;
          const blocked = Boolean(readOnly) && isWriteAction(action);

          return (
            <button
              key={action.id}
              type="button"
              disabled={blocked}
              title={
                blocked
                  ? `${action.label} — turned off while this connection is read-only`
                  : action.label
              }
              onClick={() => onRowAction(action, {})}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md transition-colors",
                blocked
                  ? "cursor-not-allowed text-ink-faint opacity-40"
                  : action.danger
                    ? "text-danger hover:bg-danger/10"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="size-3.5" />
              <span className="sr-only">{action.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {showToolbar ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            {renderToolbarActions()}
            <div className="min-w-0 flex-1" />
          </div>
        ) : null}
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-xs text-ink-faint">
            {config.emptyMessage ?? "No records came back for these filters."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {showToolbar ? (
        <div className="flex items-center gap-2 px-3 py-2">
          {renderToolbarActions()}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {config.searchable ? (
              <div className="relative w-56 max-w-full">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
                <Input
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder={
                    serverPagination ? "Search this page" : "Search"
                  }
                  className="h-7 pl-8 text-xs"
                />
              </div>
            ) : null}
            <Select
              value={String(effectivePageSize)}
              onChange={(event) => {
                const size = Number(event.target.value);
                if (serverPagination) {
                  onPageSizeChange?.(size);
                } else {
                  table.setPageSize(size);
                }
              }}
              className="h-7 w-auto text-xs"
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  Show {size}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-canvas">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const align = (
                    header.column.columnDef.meta as
                      | { align?: string }
                      | undefined
                  )?.align;
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap font-medium text-ink-soft",
                        cellPadding,
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-ink"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-30" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-line">
            {table.getRowModel().rows.map((row) => {
              // The chosen id field is whatever the API returns, so it may
              // repeat. React needs `row.id`, which is unique by construction.
              const identity = rowId
                ? String(getByPath(row.original, rowId) ?? row.id)
                : row.id;
              const selected =
                selectedRowId != null && selectedRowId === identity;

              const openable = clickAction && onRowAction;

              return (
                <tr
                  key={row.id}
                  title={openable ? clickAction.label : undefined}
                  onClick={() => {
                    if (openable) {
                      onRowAction(clickAction, row.original);
                      return;
                    }
                    onRowSelect?.(selected ? null : row.original);
                  }}
                  className={cn(
                    (onRowSelect || openable) && "cursor-pointer",
                    selected ? "bg-brand-soft" : "hover:bg-canvas",
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (
                      cell.column.columnDef.meta as
                        | { align?: string }
                        | undefined
                    )?.align;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "max-w-[18rem] truncate",
                          cellPadding,
                          align === "right" && "text-right",
                          align === "center" && "text-center",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {serverPagination || table.getPageCount() > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-ink-soft">
          <span>
            {serverPagination ? (
              <>
                Page {pageIndex + 1}
                {loading ? " · Loading…" : null}
                {" · "}
                {rows.length} record{rows.length === 1 ? "" : "s"}
                {hasMore ? " · more available" : ""}
              </>
            ) : (
              <>
                Showing{" "}
                {table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  1}
                {" to "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length,
                )}
                {" of "}
                {table.getFilteredRowModel().rows.length} records
              </>
            )}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                serverPagination
                  ? onPageChange?.(Math.max(0, pageIndex - 1))
                  : table.previousPage()
              }
              disabled={
                serverPagination
                  ? pageIndex <= 0 || loading
                  : !table.getCanPreviousPage()
              }
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                serverPagination
                  ? onPageChange?.(pageIndex + 1)
                  : table.nextPage()
              }
              disabled={
                serverPagination
                  ? !hasMore || loading
                  : !table.getCanNextPage()
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
