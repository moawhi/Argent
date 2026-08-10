"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { List, Search, Sparkles, X } from "lucide-react";
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
import { ParamTable } from "./ParamTable";
import { DocNoteEditor } from "./DocNoteEditor";
import { tagSlug, type OperationDoc } from "@/lib/docs/generate";
import { cn } from "@/lib/utils";

export interface DocEntry {
  doc: OperationDoc;
  curl: string;
  note: string | null;
}

export interface DocGroup {
  tag: string;
  note: string | null;
  entries: DocEntry[];
}

export function DocsShell({
  connectionId,
  connectionName,
  baseUrl,
  description,
  overviewNote,
  groups,
  initialTag,
}: {
  connectionId: string;
  connectionName: string;
  baseUrl: string;
  description: string | null;
  overviewNote: string | null;
  groups: DocGroup[];
  initialTag?: string;
}) {
  const [search, setSearch] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string>(
    initialTag ?? groups[0]?.tag ?? "",
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) =>
          [
            entry.doc.title,
            entry.doc.path,
            entry.doc.plainSummary,
            entry.doc.description,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term)),
        ),
      }))
      .filter((group) => group.entries.length > 0);
  }, [groups, search]);

  const active =
    filteredGroups.find((group) => group.tag === activeTag) ??
    filteredGroups[0] ??
    null;

  function selectTag(tag: string) {
    setActiveTag(tag);
    setNavOpen(false);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Mobile section picker */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2 md:hidden">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setNavOpen(true)}
        >
          <List /> Sections
        </Button>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
          {active?.tag ?? connectionName}
        </span>
      </div>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close sections"
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
            <p className="text-xs font-semibold text-ink">Sections</p>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="rounded-md p-1 text-ink-faint hover:bg-canvas hover:text-ink"
              aria-label="Close sections"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the docs"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {filteredGroups.map((group) => (
            <button
              key={group.tag}
              type="button"
              onClick={() => selectTag(group.tag)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors md:py-1.5",
                active?.tag === group.tag
                  ? "bg-brand-soft font-medium text-brand-ink"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <span className="truncate">{group.tag}</span>
              <span className="shrink-0 text-[10px] text-ink-faint">
                {group.entries.length}
              </span>
            </button>
          ))}
          {filteredGroups.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-ink-faint">
              Nothing matches “{search}”.
            </p>
          ) : null}
        </div>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-canvas">
        <div className="mx-auto max-w-4xl space-y-4 p-3 sm:space-y-5 sm:p-6">
          {!search ? (
            <Card>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>Before you start</CardTitle>
                  <p className="text-xs text-ink-soft">
                    How seeIt talks to {connectionName}.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {description ? (
                  <p className="text-xs leading-relaxed text-ink-soft">
                    {description}
                  </p>
                ) : null}
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-ink-faint">Server</dt>
                    <dd className="break-all font-mono text-[11px] text-ink">
                      {baseUrl}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Credentials</dt>
                    <dd className="text-ink">
                      Added automatically by seeIt on every request.
                    </dd>
                  </div>
                </dl>
                <DocNoteEditor
                  connectionId={connectionId}
                  scope="overview"
                  targetKey=""
                  initialValue={overviewNote}
                  placeholder="Add anything your team should know before using this API — rate limits, who owns it, gotchas."
                />
              </CardBody>
            </Card>
          ) : null}

          {active ? (
            <>
              <div className="space-y-1">
                <h2
                  id={tagSlug(active.tag)}
                  className="text-base font-semibold tracking-tight sm:text-lg"
                >
                  {active.tag}
                </h2>
                <p className="text-sm text-ink-soft">
                  {active.entries.length} endpoint
                  {active.entries.length === 1 ? "" : "s"} for working with{" "}
                  {active.tag.toLowerCase()}.
                </p>
                <DocNoteEditor
                  connectionId={connectionId}
                  scope="tag"
                  targetKey={active.tag}
                  initialValue={active.note}
                  placeholder={`Notes about ${active.tag} that the API file does not cover.`}
                />
              </div>

              {active.entries.map((entry) => (
                <OperationSection
                  key={entry.doc.id}
                  entry={entry}
                  connectionId={connectionId}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OperationSection({
  entry,
  connectionId,
}: {
  entry: DocEntry;
  connectionId: string;
}) {
  const { doc, curl } = entry;
  const isWrite = doc.method !== "GET" && doc.method !== "HEAD";

  return (
    <Card id={doc.operationKey} className="scroll-mt-4 sm:scroll-mt-6">
      <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={doc.method} />
            <code className="max-w-full break-all font-mono text-xs text-ink-soft">
              {doc.path}
            </code>
            {doc.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
            {isWrite ? <Badge tone="danger">Changes data</Badge> : null}
          </div>
          <CardTitle>{doc.title}</CardTitle>
          {doc.plainSummary ? (
            <p className="text-xs text-ink-soft">{doc.plainSummary}</p>
          ) : null}
        </div>

        <Link
          href={`/objects/new?connection=${connectionId}&operation=${doc.id}`}
          className="shrink-0 self-start"
        >
          <Button size="sm" variant="ghost">
            <Sparkles /> Build
          </Button>
        </Link>
      </CardHeader>

      <CardBody className="space-y-4">
        {doc.description ? (
          <p className="text-xs leading-relaxed text-ink-soft">
            {doc.description}
          </p>
        ) : null}

        {doc.credentialParams.length > 0 ? (
          <p className="rounded-md bg-canvas px-2.5 py-2 text-[11px] text-ink-soft">
            seeIt supplies{" "}
            {doc.credentialParams.map((param) => param.name).join(" and ")}{" "}
            automatically. You never need to include them.
          </p>
        ) : null}

        {doc.pathParams.length > 0 ? (
          <DocSection title="Address parts">
            <ParamTable params={doc.pathParams} />
          </DocSection>
        ) : null}

        {doc.queryParams.length > 0 ? (
          <DocSection title="Options">
            <ParamTable params={doc.queryParams} />
          </DocSection>
        ) : null}

        {doc.requestExample ? (
          <DocSection
            title="What you send"
            action={<CopyButton value={doc.requestExample} />}
          >
            <Pre>{doc.requestExample}</Pre>
          </DocSection>
        ) : null}

        {doc.responseExample ? (
          <DocSection
            title={`What comes back${doc.successStatus ? ` (${doc.successStatus})` : ""}`}
            action={<CopyButton value={doc.responseExample} />}
          >
            <Pre>{doc.responseExample}</Pre>
          </DocSection>
        ) : null}

        <DocSection
          title="From a terminal"
          action={<CopyButton value={curl} />}
        >
          <Pre>{curl}</Pre>
        </DocSection>

        <DocNoteEditor
          connectionId={connectionId}
          scope="operation"
          targetKey={doc.operationKey}
          initialValue={entry.note}
          placeholder="Add a note for your team about this endpoint."
        />
      </CardBody>
    </Card>
  );
}

function DocSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="max-h-60 overflow-x-auto overflow-y-auto rounded-lg bg-ink px-3 py-2.5 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-canvas sm:max-h-72 sm:whitespace-pre sm:break-normal">
      {children}
    </pre>
  );
}
