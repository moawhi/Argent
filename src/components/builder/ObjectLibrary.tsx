"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Copy,
  Hash,
  MousePointerClick,
  Search,
  SquarePen,
  Table2,
  Trash2,
} from "lucide-react";
import {
  deleteObjectAction,
  duplicateObjectAction,
} from "@/app/objects/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  Input,
  MethodBadge,
  Select,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatRelativeTime } from "@/lib/utils";
import { OBJECT_KIND_LABEL, type ObjectKind } from "@/lib/objects/types";

const KIND_ICON: Record<string, typeof Table2> = {
  table: Table2,
  chart: BarChart3,
  kpi: Hash,
  form: SquarePen,
  action: MousePointerClick,
};

export interface ObjectSummary {
  id: string;
  name: string;
  kind: string;
  connectionName: string;
  connectionId: string;
  method: string | null;
  path: string | null;
  summary: string | null;
  widgetCount: number;
  updatedAt: string;
}

export function ObjectLibrary({ objects }: { objects: ObjectSummary[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [deleting, setDeleting] = useState<ObjectSummary | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return objects.filter((object) => {
      if (kindFilter && object.kind !== kindFilter) return false;
      if (!term) return true;
      return [object.name, object.path, object.connectionName, object.summary]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [objects, search, kindFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search objects"
            className="pl-8"
          />
        </div>
        <Select
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value)}
          className="w-44"
        >
          <option value="">Every type</option>
          {Object.entries(OBJECT_KIND_LABEL).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          Nothing matches those filters.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((object) => {
            const Icon = KIND_ICON[object.kind] ?? Table2;
            return (
              <Card key={object.id} className="flex flex-col p-4">
                <div className="mb-2 flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/objects/${object.id}`}
                      className="block truncate text-sm font-semibold hover:text-brand"
                    >
                      {object.name}
                    </Link>
                    <p className="truncate text-[11px] text-ink-faint">
                      {OBJECT_KIND_LABEL[object.kind as ObjectKind] ??
                        object.kind}{" "}
                      · {object.connectionName}
                    </p>
                  </div>
                </div>

                {object.path ? (
                  <div className="mb-3 flex items-center gap-1.5">
                    {object.method ? (
                      <MethodBadge method={object.method} />
                    ) : null}
                    <code className="min-w-0 truncate font-mono text-[10px] text-ink-faint">
                      {object.path}
                    </code>
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
                  <span className="text-[11px] text-ink-faint">
                    {object.widgetCount > 0
                      ? `On ${object.widgetCount} dashboard${object.widgetCount === 1 ? "" : "s"}`
                      : "Not used yet"}
                    {" · "}
                    {formatRelativeTime(object.updatedAt)}
                  </span>
                  <div className="flex gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Make a copy"
                      onClick={() =>
                        startTransition(async () => {
                          await duplicateObjectAction(object.id);
                          router.refresh();
                        })
                      }
                    >
                      <Copy />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete"
                      className="text-ink-faint hover:text-danger"
                      onClick={() => setDeleting(object)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        destructive
        title={`Delete “${deleting?.name}”?`}
        description={
          deleting && deleting.widgetCount > 0
            ? `This object appears on ${deleting.widgetCount} dashboard${deleting.widgetCount === 1 ? "" : "s"} and will be removed from ${deleting.widgetCount === 1 ? "it" : "them"} too. Nothing changes on the connected API.`
            : "Nothing changes on the connected API."
        }
        confirmLabel="Delete object"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          startTransition(async () => {
            await deleteObjectAction(target.id);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
