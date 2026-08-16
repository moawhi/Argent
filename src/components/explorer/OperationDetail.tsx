"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Sparkles } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  MethodBadge,
  Spinner,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ParamTable } from "@/components/docs/ParamTable";
import { TryItPanel } from "./TryItPanel";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { OperationDoc } from "@/lib/docs/generate";
import type { OperationListItem } from "@/server/operations/queries";

interface OperationPayload {
  doc: OperationDoc;
  curl: string;
  connection: {
    id: string;
    name: string;
    baseUrl: string;
    readOnly: boolean;
  };
  recent: {
    id: string;
    status: number | null;
    ok: boolean;
    durationMs: number;
    createdAt: string;
    error: string | null;
  }[];
}

export function OperationDetail({
  operationId,
  connectionId,
  connectionName,
  baseUrl,
  readOnly,
  listItem,
}: {
  operationId: string;
  connectionId: string;
  connectionName: string;
  baseUrl: string;
  readOnly: boolean;
  listItem?: OperationListItem;
}) {
  const query = useQuery<OperationPayload>({
    queryKey: ["operation", operationId],
    queryFn: async () => {
      const response = await fetch(`/api/operations/${operationId}`);
      if (!response.ok) throw new Error("Could not load this endpoint.");
      return (await response.json()) as OperationPayload;
    },
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-ink-soft">
        <Spinner /> Loading endpoint…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p className="p-10 text-sm text-danger">
        {(query.error as Error)?.message ?? "Could not load this endpoint."}
      </p>
    );
  }

  const { doc, curl, recent } = query.data;
  const isWrite = doc.method !== "GET" && doc.method !== "HEAD";

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={doc.method} />
          <code className="font-mono text-sm text-ink">{doc.path}</code>
          {doc.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
          {doc.source === "manual" ? (
            <Badge tone="brand">Added by hand</Badge>
          ) : null}
          {isWrite ? (
            <Badge tone={readOnly ? "neutral" : "danger"}>
              {readOnly ? "Blocked by read-only" : "Changes data"}
            </Badge>
          ) : (
            <Badge tone="positive">Safe to run</Badge>
          )}
        </div>

        <h2 className="text-lg font-semibold tracking-tight">{doc.title}</h2>
        <p className="text-sm text-ink-soft">{doc.plainSummary}</p>
        {doc.description ? (
          <p className="text-xs leading-relaxed text-ink-soft">
            {doc.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/objects/new?connection=${connectionId}&operation=${operationId}`}
        >
          <Button size="sm">
            <Sparkles /> Turn this into an object
          </Button>
        </Link>
        <Link href={`/docs/${connectionId}#${doc.operationKey}`}>
          <Button size="sm" variant="ghost">
            <Boxes /> Open in docs
          </Button>
        </Link>
      </div>

      {doc.credentialParams.length > 0 ? (
        <p className="rounded-lg border border-line bg-surface p-3 text-xs text-ink-soft">
          Argent adds{" "}
          {doc.credentialParams.map((param, index) => (
            <span key={param.name}>
              {index > 0 ? " and " : ""}
              <code className="font-mono text-ink">{param.name}</code>
            </span>
          ))}{" "}
          automatically from {connectionName}&apos;s saved credentials, so you do
          not need to enter them below.
        </p>
      ) : null}

      <TryItPanel
        operationId={operationId}
        doc={doc}
        readOnly={readOnly}
        baseUrl={baseUrl}
      />

      {doc.pathParams.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Address parts</CardTitle>
          </CardHeader>
          <CardBody>
            <ParamTable params={doc.pathParams} />
          </CardBody>
        </Card>
      ) : null}

      {doc.queryParams.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
          </CardHeader>
          <CardBody>
            <ParamTable params={doc.queryParams} />
          </CardBody>
        </Card>
      ) : null}

      {doc.responseExample ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Example of what comes back
              {doc.successStatus ? ` (${doc.successStatus})` : ""}
            </CardTitle>
            <CopyButton value={doc.responseExample} />
          </CardHeader>
          <CardBody className="p-0">
            <pre className="max-h-80 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-ink-soft">
              {doc.responseExample}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Same request from a terminal</CardTitle>
          <CopyButton value={curl} />
        </CardHeader>
        <CardBody className="p-0">
          <pre className="overflow-auto p-4 font-mono text-[11px] leading-relaxed text-ink-soft">
            {curl}
          </pre>
        </CardBody>
      </Card>

      {listItem && listItem.calls > 0 ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>How this endpoint has behaved</CardTitle>
              <p className="text-xs text-ink-soft">
                {listItem.calls} calls, {listItem.failures} failed
                {listItem.lastCalledAt
                  ? ` · last used ${formatRelativeTime(listItem.lastCalledAt)}`
                  : ""}
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-1.5">
            {recent.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-ink-faint">
                  {formatRelativeTime(entry.createdAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-danger">
                  {entry.error ?? ""}
                </span>
                <span className="text-ink-faint">
                  {formatDuration(entry.durationMs)}
                </span>
                <Badge tone={entry.ok ? "positive" : "danger"}>
                  {entry.status ?? "failed"}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
