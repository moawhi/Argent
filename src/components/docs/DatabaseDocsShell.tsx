"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  KeyRound,
  List,
  Search,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  MethodBadge,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { DocNoteEditor } from "./DocNoteEditor";
import { ParamTable } from "./ParamTable";
import type {
  DatabaseDocsModel,
  DatabaseTableDoc,
  SqlOperationDoc,
} from "@/lib/docs/database";
import { cn } from "@/lib/utils";

type NavItem =
  | { kind: "overview" }
  | { kind: "relations" }
  | { kind: "schema"; schema: string }
  | { kind: "queries" };

function navLabel(nav: NavItem, model: DatabaseDocsModel): string {
  switch (nav.kind) {
    case "overview":
      return "Overview";
    case "relations":
      return "Relations";
    case "queries":
      return "Saved queries";
    case "schema":
      return nav.schema || model.schemas[0]?.schema || "Schema";
  }
}

export function DatabaseDocsShell({
  connectionId,
  connectionName,
  description,
  overviewNote,
  model,
  queryNotes,
}: {
  connectionId: string;
  connectionName: string;
  description: string | null;
  overviewNote: string | null;
  model: DatabaseDocsModel;
  queryNotes: Record<string, string | null>;
}) {
  const [search, setSearch] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [nav, setNav] = useState<NavItem>({ kind: "overview" });

  const filteredSchemas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return model.schemas;

    return model.schemas
      .map((group) => ({
        ...group,
        tables: group.tables.filter((table) =>
          [
            table.name,
            table.schema,
            table.plainSummary,
            ...table.columns.map((c) => `${c.name} ${c.type}`),
            ...table.relations.map(
              (r) => `${r.fromColumn} ${r.toSchema}.${r.toTable}`,
            ),
          ].some((value) => value.toLowerCase().includes(term)),
        ),
      }))
      .filter((group) => group.tables.length > 0);
  }, [model.schemas, search]);

  const activeSchema =
    nav.kind === "schema"
      ? filteredSchemas.find((group) => group.schema === nav.schema) ??
        filteredSchemas[0] ??
        null
      : null;

  function go(next: NavItem) {
    setNav(next);
    setNavOpen(false);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2 md:hidden">
        <Button size="sm" variant="secondary" onClick={() => setNavOpen(true)}>
          <List /> Browse
        </Button>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
          {navLabel(nav, model)}
        </span>
      </div>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="absolute inset-0 z-40 bg-ink/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <nav
        className={cn(
          "flex w-[min(100%,17rem)] shrink-0 flex-col border-r border-line bg-surface shadow-xl md:shadow-none",
          "absolute inset-y-0 left-0 z-50 max-h-full transition-transform duration-200",
          "md:static md:z-auto md:w-60 md:max-h-none md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="shrink-0 border-b border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
            <p className="text-xs font-semibold text-ink">Browse</p>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="rounded-md p-1 text-ink-faint hover:bg-canvas hover:text-ink"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tables"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
          <NavButton
            active={nav.kind === "overview"}
            onClick={() => go({ kind: "overview" })}
            label="Overview"
            count={model.stats.tables}
          />
          <NavButton
            active={nav.kind === "relations"}
            onClick={() => go({ kind: "relations" })}
            label="Relations"
            count={model.stats.relations}
          />
          {filteredSchemas.map((group) => (
            <NavButton
              key={group.schema}
              active={nav.kind === "schema" && nav.schema === group.schema}
              onClick={() => go({ kind: "schema", schema: group.schema })}
              label={group.schema}
              count={group.tables.length}
            />
          ))}
          {model.queries.length > 0 ? (
            <NavButton
              active={nav.kind === "queries"}
              onClick={() => go({ kind: "queries" })}
              label="Saved queries"
              count={model.queries.length}
            />
          ) : null}
        </div>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-canvas">
        <div className="mx-auto max-w-4xl space-y-4 p-3 sm:space-y-5 sm:p-6">
          {nav.kind === "overview" ? (
            <Overview
              connectionId={connectionId}
              connectionName={connectionName}
              description={description}
              overviewNote={overviewNote}
              model={model}
            />
          ) : null}

          {nav.kind === "relations" ? (
            <RelationsMap
              model={model}
              onOpenTable={(schema) => go({ kind: "schema", schema })}
            />
          ) : null}

          {nav.kind === "schema" && activeSchema ? (
            <>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                  Schema {activeSchema.schema}
                </h2>
                <p className="text-sm text-ink-soft">
                  {activeSchema.tables.length} table
                  {activeSchema.tables.length === 1 ? "" : "s"} and views.
                </p>
                <DocNoteEditor
                  connectionId={connectionId}
                  scope="tag"
                  targetKey={activeSchema.schema}
                  initialValue={activeSchema.note}
                  placeholder={`Notes about the ${activeSchema.schema} schema.`}
                />
              </div>
              {activeSchema.tables.map((table) => (
                <TableSection
                  key={table.id}
                  table={table}
                  connectionId={connectionId}
                  note={queryNotes[table.id] ?? null}
                />
              ))}
            </>
          ) : null}

          {nav.kind === "queries" ? (
            <>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                  Saved queries
                </h2>
                <p className="text-sm text-ink-soft">
                  SQL operations you can bind to objects and dashboards.
                </p>
              </div>
              {model.queries.map((query) => (
                <QuerySection
                  key={query.id}
                  query={query}
                  connectionId={connectionId}
                  note={queryNotes[query.operationKey] ?? null}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors md:py-1.5",
        active
          ? "bg-brand-soft font-medium text-brand-ink"
          : "text-ink-soft hover:bg-canvas hover:text-ink",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] text-ink-faint">{count}</span>
    </button>
  );
}

function Overview({
  connectionId,
  connectionName,
  description,
  overviewNote,
  model,
}: {
  connectionId: string;
  connectionName: string;
  description: string | null;
  overviewNote: string | null;
  model: DatabaseDocsModel;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Before you start</CardTitle>
            <p className="text-xs text-ink-soft">
              How Argent talks to {connectionName}.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {description ? (
            <p className="text-xs leading-relaxed text-ink-soft">{description}</p>
          ) : null}
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint">Engine</dt>
              <dd className="text-ink">{model.engineLabel}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Address</dt>
              <dd className="break-all font-mono text-[11px] text-ink">
                {model.baseUrl}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Catalog</dt>
              <dd className="text-ink">
                {model.stats.schemas} schema
                {model.stats.schemas === 1 ? "" : "s"} · {model.stats.tables}{" "}
                tables · {model.stats.columns} columns
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Relations</dt>
              <dd className="text-ink">
                {model.stats.relations} mapped link
                {model.stats.relations === 1 ? "" : "s"} (foreign keys +
                name-based guesses)
              </dd>
            </div>
          </dl>
          <DocNoteEditor
            connectionId={connectionId}
            scope="overview"
            targetKey=""
            initialValue={overviewNote}
            placeholder="Add anything your team should know about this database — ownership, sensitive tables, join patterns."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalog map</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-3">
          <Stat
            icon={<Database className="size-4" />}
            label="Schemas"
            value={model.stats.schemas}
          />
          <Stat
            icon={<Table2 className="size-4" />}
            label="Tables & views"
            value={model.stats.tables}
          />
          <Stat
            icon={<GitBranch className="size-4" />}
            label="Relations"
            value={model.stats.relations}
          />
        </CardBody>
      </Card>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <div className="mb-1 text-brand-ink">{icon}</div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}

function RelationsMap({
  model,
  onOpenTable,
}: {
  model: DatabaseDocsModel;
  onOpenTable: (schema: string) => void;
}) {
  if (model.edges.length === 0) {
    return (
      <Card>
        <CardBody className="py-8 text-center text-sm text-ink-soft">
          No table relations mapped yet. Refresh the schema after connecting, or
          add foreign keys / `*_id` columns so Argent can infer links.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Relations</h2>
        <p className="text-sm text-ink-soft">
          Declared foreign keys and columns that look like references (
          <code className="font-mono text-xs">account_id</code> →{" "}
          <code className="font-mono text-xs">accounts.id</code>).
        </p>
      </div>
      <Card>
        <CardBody className="divide-y divide-line p-0">
          {model.edges.map((edge) => (
            <button
              key={`${edge.from}:${edge.column}:${edge.to}`}
              type="button"
              onClick={() => onOpenTable(edge.from.split(".")[0]!)}
              className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left text-xs hover:bg-canvas"
            >
              <code className="font-mono text-ink">{edge.from}</code>
              <span className="text-ink-faint">.{edge.column}</span>
              <ArrowRight className="size-3.5 text-ink-faint" />
              <code className="font-mono text-ink">{edge.to}</code>
              <Badge tone={edge.source === "fk" ? "brand" : "neutral"}>
                {edge.source === "fk" ? "foreign key" : "inferred"}
              </Badge>
            </button>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function TableSection({
  table,
  connectionId,
  note,
}: {
  table: DatabaseTableDoc;
  connectionId: string;
  note: string | null;
}) {
  return (
    <Card id={table.id} className="scroll-mt-4 sm:scroll-mt-6">
      <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={table.kind === "view" ? "neutral" : "brand"}>
              {table.kind}
            </Badge>
            <code className="max-w-full break-all font-mono text-xs text-ink-soft">
              {table.schema}.{table.name}
            </code>
          </div>
          <CardTitle>{table.title}</CardTitle>
          <p className="text-xs text-ink-soft">{table.plainSummary}</p>
        </div>
        <Link
          href={`/connections/${connectionId}`}
          className="shrink-0 self-start"
        >
          <Button size="sm" variant="ghost">
            <Sparkles /> Open SQL
          </Button>
        </Link>
      </CardHeader>

      <CardBody className="space-y-4">
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Columns
          </h4>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead className="bg-canvas text-[11px] text-ink-faint">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Name</th>
                  <th className="px-3 py-1.5 font-medium">Type</th>
                  <th className="px-3 py-1.5 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.columns.map((column) => (
                  <tr key={column.name}>
                    <td className="px-3 py-1.5 font-mono text-[11px]">
                      {column.name}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">{column.type}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {column.isPk ? (
                          <Badge tone="brand">
                            <KeyRound className="size-2.5" /> PK
                          </Badge>
                        ) : null}
                        {!column.nullable ? (
                          <Badge tone="neutral">required</Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {table.relations.length > 0 ? (
          <section className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Points to
            </h4>
            <ul className="space-y-1">
              {table.relations.map((relation) => (
                <li
                  key={`${relation.fromColumn}-${relation.toTable}`}
                  className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft"
                >
                  <code className="font-mono text-ink">{relation.fromColumn}</code>
                  <ArrowRight className="size-3" />
                  <code className="font-mono text-ink">
                    {relation.toSchema}.{relation.toTable}.{relation.toColumn}
                  </code>
                  <Badge tone={relation.source === "fk" ? "brand" : "neutral"}>
                    {relation.source === "fk" ? "FK" : "inferred"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {table.referencedBy.length > 0 ? (
          <section className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Referenced by
            </h4>
            <ul className="space-y-1">
              {table.referencedBy.map((ref) => (
                <li
                  key={`${ref.schema}.${ref.table}.${ref.column}`}
                  className="text-xs text-ink-soft"
                >
                  <code className="font-mono text-ink">
                    {ref.schema}.{ref.table}.{ref.column}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DocNoteEditor
          connectionId={connectionId}
          scope="operation"
          targetKey={table.id}
          initialValue={note}
          placeholder="Notes about this table for your team."
        />
      </CardBody>
    </Card>
  );
}

function QuerySection({
  query,
  connectionId,
  note,
}: {
  query: SqlOperationDoc;
  connectionId: string;
  note: string | null;
}) {
  return (
    <Card id={query.operationKey} className="scroll-mt-4 sm:scroll-mt-6">
      <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={query.method} />
            <code className="max-w-full break-all font-mono text-xs text-ink-soft">
              {query.operationKey}
            </code>
            {query.method !== "SELECT" ? (
              <Badge tone="danger">Changes data</Badge>
            ) : null}
          </div>
          <CardTitle>{query.title}</CardTitle>
          <p className="text-xs text-ink-soft">{query.plainSummary}</p>
        </div>
        <Link
          href={`/objects/new?connection=${connectionId}&operation=${query.id}`}
          className="shrink-0 self-start"
        >
          <Button size="sm" variant="ghost">
            <Sparkles /> Build
          </Button>
        </Link>
      </CardHeader>
      <CardBody className="space-y-4">
        {query.description ? (
          <p className="text-xs leading-relaxed text-ink-soft">
            {query.description}
          </p>
        ) : null}
        {query.params.length > 0 ? (
          <section className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Parameters
            </h4>
            <ParamTable params={query.params} />
          </section>
        ) : null}
        {query.sqlTemplate ? (
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                SQL
              </h4>
              <CopyButton value={query.sqlTemplate} />
            </div>
            <pre className="max-h-72 overflow-x-auto overflow-y-auto rounded-lg bg-ink px-3 py-2.5 font-mono text-[11px] leading-relaxed text-canvas">
              {query.sqlTemplate}
            </pre>
          </section>
        ) : null}
        <DocNoteEditor
          connectionId={connectionId}
          scope="operation"
          targetKey={query.operationKey}
          initialValue={note}
          placeholder="Add a note for your team about this query."
        />
      </CardBody>
    </Card>
  );
}
