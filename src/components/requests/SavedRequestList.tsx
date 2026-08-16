"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSavedRequestAction } from "@/app/requests/actions";
import { Badge, Card, MethodBadge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

export interface SavedRequestRow {
  id: string;
  name: string;
  method: string;
  url: string;
  connectionName: string | null;
  lastStatus: number | null;
  lastDurationMs: number | null;
  lastRunAt: string | null;
  updatedAt: string;
}

export function SavedRequestList({
  requests,
}: {
  requests: SavedRequestRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<SavedRequestRow | null>(null);

  return (
    <>
      <Card className="divide-y divide-line overflow-hidden">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-canvas"
          >
            <MethodBadge method={request.method} />

            <Link
              href={`/requests/${request.id}`}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm font-medium text-ink">
                {request.name}
              </p>
              <p className="truncate font-mono text-[11px] text-ink-faint">
                {request.url}
                {request.connectionName ? ` · ${request.connectionName}` : ""}
              </p>
            </Link>

            {request.lastStatus !== null ? (
              <div className="flex shrink-0 items-center gap-2 text-[11px] text-ink-faint">
                {request.lastDurationMs !== null ? (
                  <span>{formatDuration(request.lastDurationMs)}</span>
                ) : null}
                <Badge tone={request.lastStatus < 400 ? "positive" : "danger"}>
                  {request.lastStatus}
                </Badge>
              </div>
            ) : null}

            <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">
              {request.lastRunAt
                ? formatRelativeTime(request.lastRunAt)
                : formatRelativeTime(request.updatedAt)}
            </span>

            <Button
              size="icon"
              variant="ghost"
              className="text-ink-faint hover:text-danger"
              onClick={() => setDeleting(request)}
              aria-label={`Delete ${request.name}`}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        destructive
        title={`Delete “${deleting?.name}”?`}
        description="This only removes the saved request from Argent. Nothing changes on the API."
        confirmLabel="Delete request"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          startTransition(async () => {
            await deleteSavedRequestAction(target.id);
            router.refresh();
          });
        }}
      />
    </>
  );
}
