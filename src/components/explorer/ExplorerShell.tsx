"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  Badge,
  Input,
  MethodBadge,
} from "@/components/ui/primitives";
import { OperationDetail } from "./OperationDetail";
import { cn } from "@/lib/utils";
import type { OperationListItem } from "@/server/operations/queries";

export function ExplorerShell({
  connectionId,
  connectionName,
  baseUrl,
  readOnly,
  operations,
  initialOperationKey,
}: {
  connectionId: string;
  connectionName: string;
  baseUrl: string;
  readOnly: boolean;
  operations: OperationListItem[];
  initialOperationKey?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialOperationKey) {
      const match = operations.find(
        (operation) => operation.operationKey === initialOperationKey,
      );
      if (match) return match.id;
    }
    return operations[0]?.id ?? null;
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return operations;

    return operations.filter((operation) =>
      [operation.summary, operation.path, operation.method, ...operation.tags]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [operations, search]);

  const groups = useMemo(() => {
    const map = new Map<string, OperationListItem[]>();
    for (const operation of filtered) {
      const tag = operation.tags[0] ?? "Uncategorized";
      const list = map.get(tag);
      if (list) list.push(operation);
      else map.set(tag, [operation]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function toggle(tag: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-80 shrink-0 flex-col border-r border-line bg-surface">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search endpoints"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {search ? (
            <p className="mt-2 text-[11px] text-ink-faint">
              {filtered.length} of {operations.length} endpoints
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-ink-faint">
              Nothing matches “{search}”.
            </p>
          ) : (
            groups.map(([tag, items]) => (
              <div key={tag} className="mb-1">
                <button
                  onClick={() => toggle(tag)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:bg-canvas"
                >
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      collapsed.has(tag) && "-rotate-90",
                    )}
                  />
                  <span className="flex-1 truncate">{tag}</span>
                  <span className="font-normal text-ink-faint">
                    {items.length}
                  </span>
                </button>

                {!collapsed.has(tag)
                  ? items.map((operation) => (
                      <button
                        key={operation.id}
                        onClick={() => setSelectedId(operation.id)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                          selectedId === operation.id
                            ? "bg-brand-soft"
                            : "hover:bg-canvas",
                        )}
                      >
                        <MethodBadge
                          method={operation.method}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-ink">
                            {operation.summary ?? operation.path}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-ink-faint">
                            {operation.path}
                          </span>
                        </span>
                        {operation.failures > 0 ? (
                          <span
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-danger"
                            title={`${operation.failures} failed calls`}
                          />
                        ) : operation.calls > 0 ? (
                          <span
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-positive"
                            title={`${operation.calls} successful calls`}
                          />
                        ) : null}
                      </button>
                    ))
                  : null}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-line px-3 py-2">
          <Badge tone={readOnly ? "neutral" : "warning"}>
            {readOnly ? "Read only connection" : "Writes enabled"}
          </Badge>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto bg-canvas">
        {selectedId ? (
          <OperationDetail
            key={selectedId}
            operationId={selectedId}
            connectionId={connectionId}
            connectionName={connectionName}
            baseUrl={baseUrl}
            readOnly={readOnly}
            listItem={operations.find((item) => item.id === selectedId)}
          />
        ) : (
          <p className="p-10 text-center text-sm text-ink-faint">
            Select an endpoint on the left to see what it does.
          </p>
        )}
      </div>
    </div>
  );
}
