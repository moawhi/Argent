"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Hash,
  Heading,
  Image as ImageIcon,
  MousePointerClick,
  Search,
  SquarePen,
  Table2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { OBJECT_KIND_LABEL, type ObjectKind } from "@/lib/objects/types";
import { BLOCK_KIND_LABEL, type BlockKind } from "@/lib/sites/types";
import type { AvailableObject } from "@/components/dashboard/DashboardCanvas";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, typeof Table2> = {
  table: Table2,
  chart: BarChart3,
  kpi: Hash,
  form: SquarePen,
  action: MousePointerClick,
};

const CONTENT_OPTIONS: {
  kind: Exclude<BlockKind, "object">;
  icon: typeof Type;
  hint: string;
}[] = [
  { kind: "heading", icon: Heading, hint: "A title on the page" },
  { kind: "richtext", icon: Type, hint: "A few paragraphs of copy" },
  { kind: "image", icon: ImageIcon, hint: "An image from a URL" },
];

export function AddWidgetDialog({
  open,
  objects,
  onClose,
  onAddObject,
  onAddContent,
}: {
  open: boolean;
  objects: AvailableObject[];
  onClose: () => void;
  onAddObject: (objectId: string) => void;
  onAddContent: (kind: Exclude<BlockKind, "object">) => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"objects" | "content">("objects");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return objects;
    return objects.filter((object) =>
      [object.name, object.connectionName, object.summary]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [objects, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={onClose} />

      <div className="animate-fade-in relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
        <div className="border-b border-line p-4">
          <h3 className="text-sm font-semibold">Add a tile</h3>
          <div className="mt-2 flex gap-1 rounded-lg bg-canvas p-0.5">
            {(["objects", "content"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium",
                  tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
                )}
              >
                {id === "objects" ? "Objects" : "Content"}
              </button>
            ))}
          </div>
          {tab === "objects" ? (
            <div className="relative mt-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your objects"
                className="pl-8"
              />
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === "content" ? (
            CONTENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => onAddContent(option.kind)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-canvas"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {BLOCK_KIND_LABEL[option.kind]}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })
          ) : filtered.length === 0 ? (
            <div className="space-y-2 p-6 text-center">
              <p className="text-sm text-ink-soft">
                {objects.length === 0
                  ? "You have not built any objects yet."
                  : "Nothing matches that search."}
              </p>
              <Link href="/objects/new">
                <Button size="sm" variant="secondary">
                  Build a new object
                </Button>
              </Link>
            </div>
          ) : (
            filtered.map((object) => {
              const Icon = KIND_ICON[object.kind] ?? Table2;
              return (
                <button
                  key={object.id}
                  type="button"
                  onClick={() => onAddObject(object.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-canvas"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {object.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {OBJECT_KIND_LABEL[object.kind as ObjectKind] ??
                        object.kind}{" "}
                      · {object.connectionName}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-line p-3">
          <Link href="/objects/new">
            <Button variant="ghost" size="sm">
              Build a new object
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
