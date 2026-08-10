import { Badge, MethodBadge } from "@/components/ui/primitives";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

export interface LogRow {
  id: string;
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  error: string | null;
  origin: string;
  createdAt: string;
  label: string | null;
}

const ORIGIN_LABEL: Record<string, string> = {
  gateway: "Dashboard",
  tryIt: "Try it",
  manual: "Request builder",
  test: "Connection test",
};

export function RequestLogTable({ logs }: { logs: LogRow[] }) {
  if (logs.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-ink-faint">
        Nothing yet. Requests appear here as soon as an object or the explorer
        calls this API.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-line bg-canvas text-ink-soft">
          <tr>
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">Request</th>
            <th className="px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2 text-right font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap px-4 py-2 text-ink-faint">
                {formatRelativeTime(log.createdAt)}
              </td>
              <td className="max-w-md px-4 py-2">
                <div className="flex items-center gap-2">
                  <MethodBadge method={log.method} />
                  <span className="truncate text-ink">
                    {log.label ?? log.url}
                  </span>
                </div>
                {log.error ? (
                  <p className="mt-0.5 truncate text-[11px] text-danger">
                    {log.error}
                  </p>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-ink-faint">
                {ORIGIN_LABEL[log.origin] ?? log.origin}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-ink-faint">
                    {formatDuration(log.durationMs)}
                  </span>
                  <Badge tone={log.ok ? "positive" : "danger"}>
                    {log.status ?? "failed"}
                  </Badge>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
