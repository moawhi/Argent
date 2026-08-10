"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, NotebookPen } from "lucide-react";
import { saveDocNoteAction } from "@/app/docs/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";

/**
 * An editable note layered over the generated reference. Collapsed to a small
 * link until there is something to show, so it never competes with the
 * generated content.
 */
export function DocNoteEditor({
  connectionId,
  scope,
  targetKey,
  initialValue,
  placeholder,
}: {
  connectionId: string;
  scope: "overview" | "tag" | "operation";
  targetKey: string;
  initialValue: string | null;
  placeholder?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    startTransition(async () => {
      await saveDocNoteAction({
        connectionId,
        scope,
        targetKey,
        bodyMarkdown: value,
      });
      setEditing(false);
      setSaved(true);
      router.refresh();
    });
  }

  if (!editing) {
    return initialValue ? (
      <div className="rounded-lg border border-brand/25 bg-brand-soft/50 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-ink">
            <NotebookPen className="size-3" /> Team note
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-brand hover:underline"
          >
            Edit
          </button>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink">
          {initialValue}
        </p>
      </div>
    ) : (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-[11px] text-ink-faint hover:text-brand"
      >
        <NotebookPen className="size-3" />
        {saved ? "Note removed" : "Add a note"}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <Textarea
        autoFocus
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="text-xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          Save note
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(initialValue ?? "");
            setEditing(false);
          }}
        >
          Cancel
        </Button>
        {value.trim() === "" && initialValue ? (
          <span className="text-[11px] text-ink-faint">
            Saving an empty note removes it.
          </span>
        ) : null}
      </div>
    </div>
  );
}
