"use client";

import { useEffect, useState } from "react";
import { loadObjectEditorAction } from "@/app/objects/actions";
import { ObjectBuilder } from "@/components/builder/ObjectBuilder";
import { Spinner } from "@/components/ui/primitives";

type Bundle = NonNullable<Awaited<ReturnType<typeof loadObjectEditorAction>>>;

export function SiteObjectEditor({
  objectId,
  onClose,
  onSaved,
}: {
  objectId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    setError(null);
    void loadObjectEditorAction(objectId).then((next) => {
      if (cancelled) return;
      if (!next) {
        setError("This object could not be loaded.");
        return;
      }
      setBundle(next);
    });
    return () => {
      cancelled = true;
    };
  }, [objectId]);

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="text-sm font-semibold">Edit object</p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink-soft hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="p-4 text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-end border-b border-line px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink-soft hover:text-ink"
          >
            Close
          </button>
        </div>
        <div className="flex flex-1 items-center gap-2 p-6 text-sm text-ink-soft">
          <Spinner /> Loading object…
        </div>
      </div>
    );
  }

  return (
    <ObjectBuilder
      variant="panel"
      connections={bundle.connections}
      operationsByConnection={bundle.operationsByConnection}
      initial={bundle.initial}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
