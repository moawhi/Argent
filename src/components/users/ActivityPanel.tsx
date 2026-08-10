"use client";

import { useEffect, useState, useTransition } from "react";
import {
  fetchActivityAction,
  fetchActivityDetailAction,
} from "@/app/users/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { Badge, MethodBadge } from "@/components/ui/primitives";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

type ActivityDetail = NonNullable<
  Awaited<ReturnType<typeof fetchActivityDetailAction>>
>;

const ORIGIN_LABEL: Record<string, string> = {
  gateway: "Dashboard / object",
  tryIt: "Try it",
  manual: "Request builder",
  test: "Connection test",
};

export function ActivityPanel({
  users,
  connections,
  initial,
}: {
  users: { id: string; name: string; email: string }[];
  connections: { id: string; name: string }[];
  initial: Awaited<ReturnType<typeof fetchActivityAction>>;
}) {
  const [userId, setUserId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [ok, setOk] = useState<"all" | "ok" | "fail">("all");
  const [data, setData] = useState(initial);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [pending, startTransition] = useTransition();

  function reload(skip = 0) {
    startTransition(async () => {
      const next = await fetchActivityAction({
        userId: userId || undefined,
        connectionId: connectionId || undefined,
        ok,
        skip,
      });
      setData(next);
    });
  }

  useEffect(() => {
    setData(initial);
  }, [initial]);

  async function openDetail(id: string) {
    const row = await fetchActivityDetailAction(id);
    if (row) setDetail(row);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Recent API calls through seeIt. Open a row for redacted request and
        response details useful for troubleshooting.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-ink-soft">User</span>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="block h-8 min-w-[10rem] rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="">Everyone</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-ink-soft">Connection</span>
          <select
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
            className="block h-8 min-w-[10rem] rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="">All connections</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-ink-soft">Result</span>
          <select
            value={ok}
            onChange={(event) =>
              setOk(event.target.value as "all" | "ok" | "fail")
            }
            className="block h-8 rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="ok">Succeeded</option>
            <option value="fail">Failed / denied</option>
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => reload(0)}
        >
          {pending ? "Loading…" : "Apply filters"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-canvas text-ink-soft">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Request</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.logs.map((log) => (
              <tr
                key={log.id}
                className="cursor-pointer hover:bg-canvas"
                onClick={() => void openDetail(log.id)}
              >
                <td className="whitespace-nowrap px-3 py-2 text-ink-faint">
                  {formatRelativeTime(log.createdAt.toISOString())}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                  {log.user?.name ?? "—"}
                </td>
                <td className="max-w-md px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MethodBadge method={log.method} />
                    <span className="truncate text-ink">
                      {log.operation?.path ?? log.url}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                    {log.connection.name}
                    {log.error ? ` · ${log.error}` : ""}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-faint">
                  {ORIGIN_LABEL[log.origin] ?? log.origin}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-ink-faint">
                      {formatDuration(log.durationMs)}
                    </span>
                    <Badge tone={log.ok ? "positive" : "danger"}>
                      {log.status ?? (log.ok ? "ok" : "failed")}
                    </Badge>
                  </div>
                </td>
              </tr>
            ))}
            {data.logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-ink-faint"
                >
                  No matching API calls yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>
          Showing {data.logs.length} of {data.total}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending || data.skip <= 0}
            onClick={() => reload(Math.max(0, data.skip - data.take))}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending || data.skip + data.logs.length >= data.total}
            onClick={() => reload(data.skip + data.take)}
          >
            Next
          </Button>
        </div>
      </div>

      <ActivityDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function ActivityDetailModal({
  detail,
  onClose,
}: {
  detail: ActivityDetail | null;
  onClose: () => void;
}) {
  if (!detail) return null;

  return (
    <Modal
      open
      size="lg"
      title="API call details"
      onClose={onClose}
    >
      <div className="space-y-4 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <Detail label="When">
            {new Date(detail.createdAt).toLocaleString()}
          </Detail>
          <Detail label="User">
            {detail.user
              ? `${detail.user.name} <${detail.user.email}>`
              : "Unknown / system"}
          </Detail>
          <Detail label="Connection">{detail.connection.name}</Detail>
          <Detail label="Source">
            {ORIGIN_LABEL[detail.origin] ?? detail.origin}
          </Detail>
          <Detail label="Method / path">
            <span className="inline-flex items-center gap-1.5">
              <MethodBadge method={detail.method} />
              <span className="font-mono text-xs">
                {detail.operation?.path ?? detail.url}
              </span>
            </span>
          </Detail>
          <Detail label="Result">
            <Badge tone={detail.ok ? "positive" : "danger"}>
              {detail.status ?? (detail.ok ? "ok" : "failed")}
            </Badge>{" "}
            <span className="text-ink-faint">
              {formatDuration(detail.durationMs)}
            </span>
          </Detail>
        </dl>

        {detail.error ? (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            {detail.error}
          </p>
        ) : null}

        <Detail label="URL (redacted)">
          <code className="block break-all font-mono text-[11px] text-ink-soft">
            {detail.url}
          </code>
        </Detail>

        <JsonBlock label="Request params (redacted / truncated)" value={detail.requestParams} />
        <JsonBlock label="Request body (redacted / truncated)" value={detail.requestBody} />
        <JsonBlock label="Response (redacted / truncated)" value={detail.responseBody} />
      </div>
    </Modal>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <p className="text-[11px] font-medium text-ink-faint">{label}</p>
        <p className="mt-1 text-xs text-ink-faint">None stored.</p>
      </div>
    );
  }

  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <div>
      <p className="text-[11px] font-medium text-ink-faint">{label}</p>
      <pre className="mt-1 max-h-56 overflow-auto rounded-md border border-line bg-canvas p-2 font-mono text-[11px] text-ink-soft">
        {text}
      </pre>
    </div>
  );
}
