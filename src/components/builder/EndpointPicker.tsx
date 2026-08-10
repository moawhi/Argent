"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Database, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  MethodBadge,
  Select,
} from "@/components/ui/primitives";
import type { OperationListItem } from "@/server/operations/queries";

/**
 * Step one of the builder: pick the endpoint or SQL query the object will
 * read from. Ready-to-preview sources (no required inputs) are highlighted.
 */
export function EndpointPicker({
  connections,
  operationsByConnection,
  initialConnectionId,
  onPick,
}: {
  connections: {
    id: string;
    name: string;
    readOnly: boolean;
    type?: string;
  }[];
  operationsByConnection: Record<string, OperationListItem[]>;
  initialConnectionId?: string;
  onPick: (operationId: string) => void;
}) {
  const [connectionId, setConnectionId] = useState(
    initialConnectionId ?? connections[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");

  const selected = connections.find((entry) => entry.id === connectionId);
  const isDatabase = selected?.type === "database";

  const groups = useMemo(() => {
    const operations = operationsByConnection[connectionId] ?? [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? operations.filter((operation) =>
          [operation.summary, operation.path, ...operation.tags]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term)),
        )
      : operations;

    const map = new Map<string, OperationListItem[]>();
    for (const operation of filtered) {
      const tag =
        operation.tags[0] ??
        (operation.source === "sql" ? "Queries" : "Uncategorized");
      const list = map.get(tag);
      if (list) list.push(operation);
      else map.set(tag, [operation]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [operationsByConnection, connectionId, search]);

  if (connections.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Nothing connected yet"
          description="Connect an API or a database first, then come back to build objects from it."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="text-base font-semibold">
          Which information do you want to show?
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          {isDatabase
            ? "Pick a saved SQL query and seeIt will suggest the best way to display the rows."
            : "Pick an endpoint and seeIt will suggest the best way to display it."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {connections.length > 1 ? (
          <Select
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
            className="w-56"
          >
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
                {connection.type === "database" ? " (database)" : ""}
              </option>
            ))}
          </Select>
        ) : null}

        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              isDatabase
                ? "Search saved queries"
                : "Search endpoints, for example “accounts” or “daily stats”"
            }
            className="pl-8"
          />
        </div>

        {isDatabase ? (
          <Link href={`/connections/${connectionId}`}>
            <Button variant="secondary" size="sm">
              <Database /> New query
            </Button>
          </Link>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={
            isDatabase
              ? "No saved queries on this database yet"
              : "Nothing matches that search"
          }
          description={
            isDatabase
              ? "Open the connection, write a SQL query with {{parameters}}, save it, then pick it here."
              : "Try a shorter word, or clear the search to see every endpoint."
          }
          action={
            isDatabase ? (
              <Link href={`/connections/${connectionId}`}>
                <Button size="sm">
                  <Database /> Write a query
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([tag, items]) => (
            <div key={tag}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {tag}
              </h3>
              <Card className="divide-y divide-line overflow-hidden">
                {items.map((operation) => (
                  <button
                    key={operation.id}
                    onClick={() => onPick(operation.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-canvas"
                  >
                    <MethodBadge
                      method={
                        operation.source === "sql" ? "SQL" : operation.method
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {operation.summary ?? operation.path}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-ink-faint">
                        {operation.source === "sql"
                          ? "Saved SQL query"
                          : operation.path}
                      </span>
                    </span>
                    {operation.requiredInputs === 0 ? (
                      <Badge tone="positive">Ready to preview</Badge>
                    ) : (
                      <Badge tone="neutral">
                        Needs {operation.requiredInputs} value
                        {operation.requiredInputs === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </button>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
