"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CircleHelp, Search, Table2 } from "lucide-react";
import { Input } from "@/components/ui/primitives";
import { openHelp } from "@/lib/help-store";
import type { DbSchema } from "@/lib/database/schema-types";

/**
 * Searchable schemas → tables → columns tree. Clicking a table or column
 * inserts its qualified name into the SQL editor via `onInsert`.
 */
export function SchemaBrowser({
  schemas,
  connectionId,
  onInsert,
}: {
  schemas: DbSchema[];
  connectionId?: string;
  onInsert?: (snippet: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({});
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schemas;

    return schemas
      .map((schema) => {
        const tables = schema.tables
          .map((table) => {
            const columns = table.columns.filter(
              (column) =>
                column.name.toLowerCase().includes(q) ||
                column.type.toLowerCase().includes(q),
            );
            const tableMatch = table.name.toLowerCase().includes(q);
            if (!tableMatch && columns.length === 0) return null;
            return {
              ...table,
              columns: tableMatch ? table.columns : columns,
            };
          })
          .filter(Boolean) as DbSchema["tables"];

        if (
          schema.name.toLowerCase().includes(q) ||
          tables.length > 0
        ) {
          return { ...schema, tables };
        }
        return null;
      })
      .filter(Boolean) as DbSchema[];
  }, [schemas, query]);

  if (schemas.length === 0) {
    return (
      <p className="p-3 text-xs text-ink-faint">
        No schemas mapped yet. Refresh the catalog from the settings above.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tables and columns"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5 text-xs">
        {filtered.map((schema) => {
          const schemaOpen = openSchemas[schema.name] ?? true;
          return (
            <div key={schema.name} className="mb-1">
              <button
                type="button"
                onClick={() =>
                  setOpenSchemas((current) => ({
                    ...current,
                    [schema.name]: !schemaOpen,
                  }))
                }
                className="flex w-full items-center gap-1 rounded px-1.5 py-1 font-medium text-ink hover:bg-canvas"
              >
                {schemaOpen ? (
                  <ChevronDown className="size-3.5 text-ink-faint" />
                ) : (
                  <ChevronRight className="size-3.5 text-ink-faint" />
                )}
                {schema.name}
                <span className="text-[10px] font-normal text-ink-faint">
                  {schema.tables.length}
                </span>
              </button>

              {schemaOpen
                ? schema.tables.map((table) => {
                    const key = `${schema.name}.${table.name}`;
                    const tableOpen = openTables[key] ?? Boolean(query.trim());
                    const qualified = `"${schema.name}"."${table.name}"`;

                    return (
                      <div key={key} className="ml-2">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenTables((current) => ({
                                ...current,
                                [key]: !tableOpen,
                              }))
                            }
                            className="rounded p-0.5 text-ink-faint hover:text-ink"
                          >
                            {tableOpen ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronRight className="size-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Insert into SQL"
                            onClick={() => onInsert?.(qualified)}
                            className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-brand-soft"
                          >
                            <Table2 className="size-3 shrink-0 text-ink-faint" />
                            <span className="truncate">{table.name}</span>
                            <span className="text-[10px] text-ink-faint">
                              {table.kind}
                              {(table.relations?.length ?? 0) > 0
                                ? ` · ${table.relations!.length} rel`
                                : ""}
                            </span>
                          </button>
                          {connectionId ? (
                            <button
                              type="button"
                              title="Table help"
                              onClick={() =>
                                openHelp({
                                  connectionId,
                                  table: key,
                                })
                              }
                              className="rounded p-0.5 text-ink-faint hover:text-ink"
                            >
                              <CircleHelp className="size-3" />
                            </button>
                          ) : null}
                        </div>

                        {tableOpen ? (
                          <>
                            {table.columns.map((column) => {
                              const relation = table.relations?.find(
                                (entry) => entry.fromColumn === column.name,
                              );
                              return (
                                <button
                                  key={column.name}
                                  type="button"
                                  title={
                                    relation
                                      ? `→ ${relation.toSchema}.${relation.toTable}.${relation.toColumn}`
                                      : "Insert into SQL"
                                  }
                                  onClick={() =>
                                    onInsert?.(
                                      `"${schema.name}"."${table.name}"."${column.name}"`,
                                    )
                                  }
                                  className="ml-6 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-brand-soft"
                                >
                                  <span className="truncate font-mono text-ink">
                                    {column.name}
                                    {column.isPk ? (
                                      <span className="ml-1 text-[9px] text-brand">
                                        PK
                                      </span>
                                    ) : null}
                                    {relation ? (
                                      <span className="ml-1 text-[9px] text-ink-faint">
                                        → {relation.toTable}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="shrink-0 truncate text-[10px] text-ink-faint">
                                    {column.type}
                                  </span>
                                </button>
                              );
                            })}
                          </>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
