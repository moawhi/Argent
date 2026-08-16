"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useGatewayData } from "@/lib/gateway/client";
import {
  FETCH_LIMITS,
  clampLimit,
  defaultFetchLimitForKind,
} from "@/lib/gateway/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton, Spinner } from "@/components/ui/primitives";
import { getByPath } from "@/lib/utils";
import { RowActionModal, type RowActionTarget } from "./RowActionModal";
import { TableObject } from "./TableObject";
import { ChartObject } from "./ChartObject";
import { KpiObject } from "./KpiObject";
import { FormObject } from "./FormObject";
import { ActionObject } from "./ActionObject";
import type {
  ActionConfig,
  ChartConfig,
  FormConfig,
  KpiConfig,
  ObjectKind,
  TableConfig,
} from "@/lib/objects/types";
import type { RowAction } from "@/lib/objects/types";

export interface RenderableObject {
  id?: string;
  operationId?: string;
  name: string;
  kind: ObjectKind;
  config: unknown;
  method?: string;
}

export interface ObjectRendererProps {
  object: RenderableObject;
  /** Dashboard filter values that bound parameters read from. */
  filters?: Record<string, unknown>;
  /** Explicit parameter values, used by the builder preview. */
  params?: Record<string, unknown>;
  /** The row selected in a linked table, prefilling a form. */
  selection?: Record<string, unknown> | null;
  readOnly?: boolean;
  previewOnly?: boolean;
  title?: string;
  onRowSelect?: (row: Record<string, unknown> | null) => void;
  selectedRowId?: string | null;
  onRowAction?: (action: RowAction, row: Record<string, unknown>) => void;
  onDataChanged?: () => void;
}

const READS: ObjectKind[] = ["table", "chart", "kpi"];

export function ObjectRenderer({
  object,
  filters,
  params,
  selection,
  readOnly,
  previewOnly,
  title,
  onRowSelect,
  selectedRowId,
  onRowAction,
  onDataChanged,
}: ObjectRendererProps) {
  const needsData = READS.includes(object.kind);
  const [actionTarget, setActionTarget] = useState<RowActionTarget | null>(null);

  const tableConfig =
    object.kind === "table" ? (object.config as TableConfig) : null;
  const chartConfig =
    object.kind === "chart" ? (object.config as ChartConfig) : null;
  const kpiConfig =
    object.kind === "kpi" ? (object.config as KpiConfig) : null;

  const serverPagination = tableConfig?.serverPagination !== false;
  const initialPageSize = clampLimit(
    tableConfig?.pageSize ?? FETCH_LIMITS.tableDefaultPage,
    FETCH_LIMITS.tablePageMax,
  );

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPageIndex(0);
    setPageSize(initialPageSize);
  }, [object.id, object.operationId, initialPageSize, filters, params]);

  const pagination = useMemo(() => {
    if (object.kind === "table") {
      const limit = clampLimit(
        tableConfig?.fetchLimit ?? pageSize,
        FETCH_LIMITS.tablePageMax,
      );
      if (serverPagination) {
        return { limit, offset: pageIndex * limit };
      }
      return {
        limit: clampLimit(
          tableConfig?.fetchLimit ?? FETCH_LIMITS.hardMax,
          FETCH_LIMITS.hardMax,
        ),
        offset: 0,
      };
    }

    if (object.kind === "chart") {
      return {
        limit: clampLimit(
          chartConfig?.fetchLimit ?? defaultFetchLimitForKind("chart"),
          FETCH_LIMITS.chartMax,
        ),
        offset: 0,
      };
    }

    if (object.kind === "kpi") {
      return {
        limit: clampLimit(
          kpiConfig?.fetchLimit ?? defaultFetchLimitForKind("kpi"),
          FETCH_LIMITS.kpiMax,
        ),
        offset: 0,
      };
    }

    return undefined;
  }, [
    object.kind,
    tableConfig?.fetchLimit,
    chartConfig?.fetchLimit,
    kpiConfig?.fetchLimit,
    serverPagination,
    pageIndex,
    pageSize,
  ]);

  const query = useGatewayData(
    [
      object.id ?? object.operationId,
      object.kind,
      filters,
      params,
      pagination,
    ],
    {
      objectId: object.id,
      operationId: object.id ? undefined : object.operationId,
      filters,
      params,
      pagination,
      origin: "gateway",
    },
    { enabled: needsData && Boolean(object.id || object.operationId) },
  );

  // If a "next" page was empty, step back so the footer stays usable.
  useEffect(() => {
    if (
      object.kind !== "table" ||
      !serverPagination ||
      pageIndex <= 0 ||
      query.isFetching ||
      !query.data?.ok
    ) {
      return;
    }
    if ((query.data.rows?.length ?? 0) === 0) {
      setPageIndex((current) => Math.max(0, current - 1));
    }
  }, [
    object.kind,
    serverPagination,
    pageIndex,
    query.isFetching,
    query.data?.ok,
    query.data?.rows?.length,
  ]);

  if (object.kind === "form") {
    return (
      <FormObject
        config={object.config as FormConfig}
        objectId={object.id}
        operationId={object.id ? undefined : object.operationId}
        initialValues={selection ?? undefined}
        params={{ ...params, ...(selection ?? {}) }}
        readOnly={readOnly}
        method={object.method}
        previewOnly={previewOnly}
        onSuccess={onDataChanged}
      />
    );
  }

  if (object.kind === "action") {
    return (
      <ActionObject
        config={object.config as ActionConfig}
        objectId={object.id}
        operationId={object.id ? undefined : object.operationId}
        params={{ ...params, ...(selection ?? {}) }}
        readOnly={readOnly}
        previewOnly={previewOnly}
        onSuccess={onDataChanged}
      />
    );
  }

  if (query.isLoading) {
    return <LoadingState kind={object.kind} />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message="Argent could not load this data."
        detail={(query.error as Error)?.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const result = query.data;

  if (result && !result.ok) {
    return (
      <ErrorState
        message={result.error?.message ?? "That request did not work."}
        detail={result.error?.detail}
        onRetry={() => query.refetch()}
      />
    );
  }

  const rows = result?.rows ?? [];
  const envelope = result?.envelope;
  const truncated = Boolean(result?.truncated);
  const hasMore = Boolean(result?.hasMore);

  switch (object.kind) {
    case "table": {
      const config = object.config as TableConfig;

      return (
        <>
          {truncated ? (
            <LimitBanner limit={result?.limit ?? pageSize} />
          ) : null}
          <TableObject
            config={config}
            rows={rows}
            onRowSelect={onRowSelect}
            selectedRowId={selectedRowId}
            readOnly={readOnly}
            serverPagination={serverPagination}
            pageIndex={pageIndex}
            pageSize={pageSize}
            hasMore={hasMore}
            loading={query.isFetching}
            onPageChange={setPageIndex}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
            onRowAction={(action, row) => {
              if (action.kind === "select") {
                onRowSelect?.(row);
                onRowAction?.(action, row);
                return;
              }

              if (action.kind === "link") {
                const fromField = action.urlField
                  ? getByPath(row, action.urlField)
                  : null;
                const fromFixed = action.inputs.find(
                  (input) =>
                    input.target === "url" && input.source === "fixed",
                )?.value;
                const url =
                  typeof fromField === "string"
                    ? fromField
                    : typeof fromFixed === "string"
                      ? fromFixed
                      : null;
                if (typeof url === "string" && /^https?:\/\//i.test(url)) {
                  window.open(url, "_blank", "noopener");
                }
                return;
              }

              setActionTarget({ action, row });
            }}
          />

          <RowActionModal
            target={actionTarget}
            rowIdField={config.rowIdField ?? null}
            readOnly={readOnly}
            previewOnly={previewOnly}
            onClose={() => setActionTarget(null)}
            onDataChanged={() => {
              void query.refetch();
              onDataChanged?.();
            }}
          />
        </>
      );
    }
    case "chart":
      return (
        <div className="flex h-full min-h-0 flex-col">
          {truncated ? (
            <LimitBanner
              limit={result?.limit ?? FETCH_LIMITS.chartMax}
              noun="points"
            />
          ) : null}
          <div className="min-h-0 flex-1">
            <ChartObject config={object.config as ChartConfig} rows={rows} />
          </div>
        </div>
      );
    case "kpi":
      return (
        <KpiObject
          config={object.config as KpiConfig}
          rows={rows}
          envelope={envelope}
          title={title ?? object.name}
        />
      );
    default:
      return null;
  }
}

function LimitBanner({
  limit,
  noun = "rows",
}: {
  limit: number;
  noun?: string;
}) {
  return (
    <p className="border-b border-line bg-canvas px-3 py-1.5 text-[11px] text-ink-soft">
      Showing the first {limit.toLocaleString()} {noun}. Narrow filters or raise
      the fetch limit in object settings for more.
    </p>
  );
}

function LoadingState({ kind }: { kind: ObjectKind }) {
  if (kind === "kpi") {
    return (
      <div className="flex h-full flex-col justify-between rounded-xl bg-canvas p-4">
        <Skeleton className="h-3 w-20 bg-line" />
        <Skeleton className="h-8 w-28 bg-line" />
        <Skeleton className="h-2.5 w-24 bg-line" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-xs text-ink-faint">
        <Spinner /> Loading…
      </div>
      {Array.from({ length: kind === "chart" ? 1 : 5 }).map((_, index) => (
        <Skeleton
          key={index}
          className={kind === "chart" ? "flex-1" : "h-6"}
        />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
      <AlertTriangle className="size-5 text-warning" />
      <p className="text-xs font-medium text-ink">{message}</p>
      {detail ? (
        <details className="max-w-full">
          <summary className="cursor-pointer text-[11px] text-ink-faint">
            Technical detail
          </summary>
          <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-left text-[10px] text-ink-faint">
            {detail}
          </p>
        </details>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onRetry}>
        <RefreshCw /> Try again
      </Button>
    </div>
  );
}
