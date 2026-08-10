"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, KeyRound, X } from "lucide-react";
import { closeHelp, useHelpTarget } from "@/lib/help-store";
import { Badge, MethodBadge, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ParamTable } from "@/components/docs/ParamTable";
import type { OperationDoc } from "@/lib/docs/generate";
import type { DatabaseTableDoc, SqlOperationDoc } from "@/lib/docs/database";

interface OperationHelp {
  kind: "operation";
  connectionName: string;
  baseUrl: string;
  doc: OperationDoc;
  curl: string;
  note: string | null;
}

interface SqlHelp {
  kind: "sql";
  connectionName: string;
  baseUrl: string;
  doc: SqlOperationDoc;
  note: string | null;
}

interface TableHelp {
  kind: "table";
  connectionName: string;
  engine: string;
  baseUrl: string;
  doc: DatabaseTableDoc;
  note: string | null;
}

interface TagHelp {
  kind: "tag";
  connectionName: string;
  tag: string;
  connectionType?: string;
  operations: {
    id: string;
    operationKey: string;
    method: string;
    path: string;
    summary: string | null;
    source?: string;
  }[];
}

type HelpPayload = OperationHelp | SqlHelp | TableHelp | TagHelp;

export function HelpDrawerHost() {
  const target = useHelpTarget();

  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);

  const query = useQuery<HelpPayload>({
    queryKey: [
      "help",
      target?.connectionId,
      target?.operationKey,
      target?.tag,
      target?.table,
    ],
    enabled: Boolean(target),
    queryFn: async () => {
      const search = new URLSearchParams({
        connectionId: target!.connectionId,
      });
      if (target!.operationKey) search.set("operationKey", target!.operationKey);
      if (target!.tag) search.set("tag", target!.tag);
      if (target!.table) search.set("table", target!.table);

      const response = await fetch(`/api/help?${search.toString()}`);
      if (!response.ok) throw new Error("Could not load help.");
      return (await response.json()) as HelpPayload;
    },
  });

  if (!target) return null;

  const title =
    query.data?.kind === "operation"
      ? query.data.doc.title
      : query.data?.kind === "sql"
        ? query.data.doc.title
        : query.data?.kind === "table"
          ? query.data.doc.title
          : query.data?.kind === "tag"
            ? query.data.tag
            : "Loading";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close help"
        onClick={closeHelp}
        className="flex-1 bg-ink/20 backdrop-blur-[1px]"
      />

      <aside className="flex w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              Help
            </p>
            <p className="truncate text-sm font-semibold">{title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={closeHelp} aria-label="Close">
            <X />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <Spinner /> Loading reference…
            </div>
          ) : query.isError ? (
            <p className="text-sm text-danger">
              {(query.error as Error).message}
            </p>
          ) : query.data?.kind === "operation" ? (
            <OperationHelpBody payload={query.data} />
          ) : query.data?.kind === "sql" ? (
            <SqlHelpBody payload={query.data} connectionId={target.connectionId} />
          ) : query.data?.kind === "table" ? (
            <TableHelpBody payload={query.data} connectionId={target.connectionId} />
          ) : query.data?.kind === "tag" ? (
            <TagHelpBody payload={query.data} connectionId={target.connectionId} />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function OperationHelpBody({ payload }: { payload: OperationHelp }) {
  const { doc, curl } = payload;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MethodBadge method={doc.method} />
          <code className="truncate font-mono text-xs text-ink-soft">
            {doc.path}
          </code>
        </div>
        <p className="text-sm text-ink">{doc.plainSummary}</p>
        {doc.description ? (
          <p className="text-xs leading-relaxed text-ink-soft">
            {doc.description}
          </p>
        ) : null}
      </div>

      <TeamNote note={payload.note} />

      {doc.credentialParams.length > 0 ? (
        <p className="rounded-lg bg-canvas p-3 text-xs text-ink-soft">
          seeIt fills in{" "}
          {doc.credentialParams.map((param, index) => (
            <span key={param.name}>
              {index > 0 ? ", " : ""}
              <code className="font-mono text-ink">{param.name}</code>
            </span>
          ))}{" "}
          automatically from this connection&apos;s saved credentials.
        </p>
      ) : null}

      {doc.pathParams.length > 0 ? (
        <Section title="Address parts">
          <ParamTable params={doc.pathParams} />
        </Section>
      ) : null}

      {doc.queryParams.length > 0 ? (
        <Section title="Options you can set">
          <ParamTable params={doc.queryParams} />
        </Section>
      ) : null}

      {doc.requestExample ? (
        <Section
          title="What you send"
          action={<CopyButton value={doc.requestExample} />}
        >
          <CodeBlock>{doc.requestExample}</CodeBlock>
        </Section>
      ) : null}

      {doc.responseExample ? (
        <Section
          title={`What comes back${doc.successStatus ? ` (${doc.successStatus})` : ""}`}
          action={<CopyButton value={doc.responseExample} />}
        >
          <CodeBlock>{doc.responseExample}</CodeBlock>
        </Section>
      ) : null}

      <Section title="Try it from a terminal" action={<CopyButton value={curl} />}>
        <CodeBlock>{curl}</CodeBlock>
      </Section>
    </div>
  );
}

function SqlHelpBody({
  payload,
  connectionId,
}: {
  payload: SqlHelp;
  connectionId: string;
}) {
  const { doc } = payload;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MethodBadge method={doc.method} />
          <code className="truncate font-mono text-xs text-ink-soft">
            {doc.operationKey}
          </code>
        </div>
        <p className="text-sm text-ink">{doc.plainSummary}</p>
        {doc.description ? (
          <p className="text-xs leading-relaxed text-ink-soft">
            {doc.description}
          </p>
        ) : null}
      </div>

      <TeamNote note={payload.note} />

      {doc.params.length > 0 ? (
        <Section title="Parameters">
          <ParamTable params={doc.params} />
        </Section>
      ) : null}

      {doc.sqlTemplate ? (
        <Section title="SQL" action={<CopyButton value={doc.sqlTemplate} />}>
          <CodeBlock>{doc.sqlTemplate}</CodeBlock>
        </Section>
      ) : null}

      <Link
        href={`/docs/${connectionId}`}
        onClick={closeHelp}
        className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
      >
        Open full database docs <ExternalLink className="size-3" />
      </Link>
    </div>
  );
}

function TableHelpBody({
  payload,
  connectionId,
}: {
  payload: TableHelp;
  connectionId: string;
}) {
  const { doc } = payload;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={doc.kind === "view" ? "neutral" : "brand"}>{doc.kind}</Badge>
          <code className="font-mono text-xs text-ink-soft">
            {doc.schema}.{doc.name}
          </code>
        </div>
        <p className="text-sm text-ink">{doc.plainSummary}</p>
      </div>

      <TeamNote note={payload.note} />

      <Section title="Columns">
        <div className="space-y-1">
          {doc.columns.map((column) => (
            <div
              key={column.name}
              className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono text-ink">
                {column.name}
                {column.isPk ? (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-brand">
                    <KeyRound className="size-2.5" /> PK
                  </span>
                ) : null}
              </span>
              <span className="text-ink-faint">{column.type}</span>
            </div>
          ))}
        </div>
      </Section>

      {doc.relations.length > 0 ? (
        <Section title="Points to">
          <ul className="space-y-1.5 text-xs text-ink-soft">
            {doc.relations.map((relation) => (
              <li
                key={`${relation.fromColumn}-${relation.toTable}`}
                className="flex flex-wrap items-center gap-1.5"
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
        </Section>
      ) : null}

      {doc.referencedBy.length > 0 ? (
        <Section title="Referenced by">
          <ul className="space-y-1 text-xs text-ink-soft">
            {doc.referencedBy.map((ref) => (
              <li key={`${ref.schema}.${ref.table}.${ref.column}`}>
                <code className="font-mono text-ink">
                  {ref.schema}.{ref.table}.{ref.column}
                </code>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Link
        href={`/docs/${connectionId}`}
        onClick={closeHelp}
        className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
      >
        Open full database docs <ExternalLink className="size-3" />
      </Link>
    </div>
  );
}

function TagHelpBody({
  payload,
  connectionId,
}: {
  payload: TagHelp;
  connectionId: string;
}) {
  const isDb = payload.connectionType === "database";

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">
        {payload.operations.length}{" "}
        {isDb ? "queries" : "endpoints"} in {payload.tag}.
      </p>
      {payload.operations.map((operation) => (
        <Link
          key={operation.id}
          href={
            isDb || operation.source === "sql"
              ? `/docs/${connectionId}`
              : `/explorer/${connectionId}?op=${operation.operationKey}`
          }
          onClick={closeHelp}
          className="flex items-center gap-2 rounded-lg border border-line p-2 hover:bg-canvas"
        >
          <MethodBadge method={operation.method} />
          <span className="min-w-0 flex-1 truncate text-xs">
            {operation.summary ?? operation.path}
          </span>
          <ExternalLink className="size-3.5 shrink-0 text-ink-faint" />
        </Link>
      ))}
    </div>
  );
}

function TeamNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <div className="rounded-lg border border-brand/30 bg-brand-soft/60 p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-ink">
        Team note
      </p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink">
        {note}
      </p>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-ink px-3 py-2.5 font-mono text-[11px] leading-relaxed text-canvas">
      {children}
    </pre>
  );
}

/** Small helper so any page can drop in a "What is this?" button. */
export function HelpButton({
  connectionId,
  operationKey,
  table,
  label = "What is this?",
}: {
  connectionId: string;
  operationKey?: string;
  table?: string;
  label?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        import("@/lib/help-store").then(({ openHelp }) =>
          openHelp({ connectionId, operationKey, table }),
        )
      }
    >
      {label}
    </Button>
  );
}
