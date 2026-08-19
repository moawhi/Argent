"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Hash,
  Loader2,
  MousePointerClick,
  Save,
  SquarePen,
  Table2,
  X,
} from "lucide-react";
import {
  builderContextAction,
  saveObjectAction,
} from "@/app/objects/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  Field,
  Input,
  MethodBadge,
  Spinner,
} from "@/components/ui/primitives";
import { ObjectRenderer } from "@/components/objects/ObjectRenderer";
import { EndpointPicker } from "./EndpointPicker";
import { ParamBindingPanel } from "./ParamBindingPanel";
import { TablePanel } from "./panels/TablePanel";
import { ChartPanel } from "./panels/ChartPanel";
import { KpiPanel } from "./panels/KpiPanel";
import { FormPanel } from "./panels/FormPanel";
import { ActionPanel } from "./panels/ActionPanel";
import { openHelp } from "@/lib/help-store";
import { cn } from "@/lib/utils";
import {
  OBJECT_KIND_DESCRIPTION,
  OBJECT_KIND_LABEL,
  type ObjectKind,
} from "@/lib/objects/types";
import type { BuilderContext } from "@/server/objects/service";
import type { FieldDescriptor } from "@/lib/openapi/types";
import type { ParamBindings } from "@/lib/gateway/types";
import type { OperationListItem } from "@/server/operations/queries";

const KIND_ICON: Record<ObjectKind, typeof Table2> = {
  table: Table2,
  chart: BarChart3,
  kpi: Hash,
  form: SquarePen,
  action: MousePointerClick,
};

/** Stable order in the builder so Chart is always easy to find. */
const KIND_DISPLAY_ORDER: ObjectKind[] = [
  "table",
  "chart",
  "kpi",
  "form",
  "action",
];

export interface BuilderInitial {
  id: string;
  name: string;
  kind: ObjectKind;
  config: unknown;
  paramBindings: ParamBindings;
  operationId: string;
}

export function ObjectBuilder({
  connections,
  operationsByConnection,
  initialOperationId,
  initialConnectionId,
  initial,
  variant = "page",
  onClose,
  onSaved,
}: {
  connections: {
    id: string;
    name: string;
    readOnly: boolean;
    type?: string;
  }[];
  operationsByConnection: Record<string, OperationListItem[]>;
  initialOperationId?: string;
  initialConnectionId?: string;
  initial?: BuilderInitial;
  variant?: "page" | "panel";
  onClose?: () => void;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  const [operationId, setOperationId] = useState<string | null>(
    initial?.operationId ?? initialOperationId ?? null,
  );
  // Kept together with the endpoint it belongs to, so switching endpoints
  // clears the old suggestions without a second state update.
  const [loaded, setLoaded] = useState<{
    operationId: string;
    context: BuilderContext | null;
  } | null>(null);

  const context =
    loaded && loaded.operationId === operationId ? loaded.context : null;

  // Anything selected but not yet loaded is, by definition, still loading.
  const loadingContext =
    operationId !== null && loaded?.operationId !== operationId;

  const [kind, setKind] = useState<ObjectKind | null>(initial?.kind ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [config, setConfig] = useState<unknown>(initial?.config ?? null);
  const [bindings, setBindings] = useState<ParamBindings>(
    initial?.paramBindings ?? {},
  );
  const [previewParams, setPreviewParams] = useState<Record<string, unknown>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);

  // Load suggestions whenever the endpoint changes.
  useEffect(() => {
    if (!operationId) return;

    let cancelled = false;

    void builderContextAction(operationId).then((next) => {
      if (cancelled) return;
      setLoaded({ operationId, context: next });

      if (!next) return;

      // Only auto-pick when creating; editing keeps the saved config.
      if (!initial) {
        const best = next.suggestions[0];
        if (best) {
          setKind(best.kind);
          setConfig(best.config);
          setName((current) => current || best.name);
        }
        setBindings(next.defaultBindings);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [operationId, initial]);

  const suggestion = useMemo(
    () => context?.suggestions.find((entry) => entry.kind === kind) ?? null,
    [context, kind],
  );

  const suggestedKind = context?.suggestions[0]?.kind ?? null;

  const kindOptions = useMemo(() => {
    if (!context) return [];
    const byKind = new Map(
      context.suggestions.map((entry) => [entry.kind, entry]),
    );
    return KIND_DISPLAY_ORDER.map((entryKind) => byKind.get(entryKind)).filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry),
    );
  }, [context]);

  const promptParams = useMemo(
    () =>
      (context?.bindableParams ?? []).filter(
        (param) => bindings[param.name]?.mode === "prompt",
      ),
    [context, bindings],
  );

  const missingPrompts = promptParams.filter(
    (param) =>
      param.required &&
      (previewParams[param.name] === undefined ||
        previewParams[param.name] === ""),
  );

  function chooseKind(next: ObjectKind) {
    setKind(next);
    const match = context?.suggestions.find((entry) => entry.kind === next);
    if (match) {
      setConfig(match.config);
      if (!initial) setName(match.name);
    }
  }

  function handleSave() {
    setError(null);

    if (!context || !kind || !config) {
      setError("Choose an endpoint and an object type first.");
      return;
    }

    startSaving(async () => {
      const result = await saveObjectAction({
        id: savedId ?? undefined,
        connectionId: context.connection.id,
        operationId: context.operation.id,
        name,
        kind,
        config,
        paramBindings: bindings,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save this object.");
        return;
      }

      setSavedId(result.id ?? null);
      if (result.id) onSaved?.(result.id);
      if (variant !== "panel") {
        router.push("/objects");
      }
    });
  }

  /* ---------------- endpoint not chosen yet ---------------- */

  if (!operationId) {
    return (
      <EndpointPicker
        connections={connections}
        operationsByConnection={operationsByConnection}
        initialConnectionId={initialConnectionId}
        onPick={setOperationId}
      />
    );
  }

  if (loadingContext) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-ink-soft">
        <Spinner /> Working out what this endpoint can do…
      </div>
    );
  }

  if (!context) {
    return (
      <p className="p-10 text-sm text-danger">
        That endpoint could not be loaded.
      </p>
    );
  }

  const settingsBody = (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        {variant === "panel" ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOperationId(null);
              setKind(null);
              setConfig(null);
            }}
          >
            <ArrowLeft /> Choose a different endpoint
          </Button>
        )}

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <MethodBadge method={context.operation.method} />
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-soft">
              {context.operation.path}
            </code>
          </div>
          <p className="mt-1.5 text-xs text-ink">
            {context.operation.summary ?? "No description provided."}
          </p>
          <button
            onClick={() =>
              openHelp({
                connectionId: context.connection.id,
                operationKey: context.operation.operationKey,
              })
            }
            className="mt-1.5 text-[11px] text-brand hover:underline"
          >
            What does this endpoint do?
          </button>
        </Card>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          What should this look like?
        </h3>
        <div className="space-y-1.5">
          {kindOptions.map((entry) => {
            const Icon = KIND_ICON[entry.kind];
            const active = kind === entry.kind;
            return (
              <button
                key={entry.kind}
                type="button"
                onClick={() => chooseKind(entry.kind)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                  active
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:bg-canvas",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    active
                      ? "bg-brand text-white"
                      : "bg-canvas text-ink-soft",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-ink">
                      {OBJECT_KIND_LABEL[entry.kind]}
                    </span>
                    {entry.kind === suggestedKind ? (
                      <Badge tone="brand">Suggested</Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-soft">
                    {entry.reason}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Field label="Name" hint="Shown as the heading on your dashboard.">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={suggestion?.name ?? "My object"}
        />
      </Field>

      {context.bindableParams.length > 0 ? (
        <ParamBindingPanel
          params={context.bindableParams}
          bindings={bindings}
          onChange={setBindings}
          previewParams={previewParams}
          onPreviewParamsChange={setPreviewParams}
        />
      ) : null}

      {kind && config ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {OBJECT_KIND_LABEL[kind]} settings
          </h3>
          <ConfigPanel
            kind={kind}
            config={config}
            onChange={setConfig}
            fields={context.responseFields}
            operations={operationsByConnection[context.connection.id] ?? []}
          />
        </section>
      ) : null}
    </div>
  );

  if (variant === "panel") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
          <p className="min-w-0 truncate text-sm font-semibold">
            {name || "Edit object"}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" onClick={handleSave} disabled={saving || !kind}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
            {onClose ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                aria-label="Close"
              >
                <X />
              </Button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="shrink-0 px-3 pt-2 text-xs text-danger">{error}</p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{settingsBody}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* ---------------- settings ---------------- */}
      <div className="w-[26rem] shrink-0 overflow-y-auto border-r border-line bg-surface">
        {settingsBody}
      </div>

      {/* ---------------- preview ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-soft">
              Live preview
            </span>
            <Badge tone="neutral">Real data</Badge>
            {context.connection.readOnly && (kind === "form" || kind === "action") ? (
              <Badge tone="warning">Saving disabled while read-only</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {error ? (
              <span className="text-xs text-danger">{error}</span>
            ) : null}
            <Button onClick={handleSave} disabled={saving || !kind}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {savedId ? "Save changes" : "Save object"}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {missingPrompts.length > 0 ? (
            <Card className="mx-auto max-w-md p-5 text-center">
              <p className="text-sm font-medium">Almost there</p>
              <p className="mt-1 text-xs text-ink-soft">
                Enter a value for{" "}
                {missingPrompts.map((param) => param.name).join(", ")} on the
                left to see this preview with real data.
              </p>
            </Card>
          ) : kind && config ? (
            <div
              className={cn(
                "mx-auto",
                kind === "kpi"
                  ? "max-w-xs"
                  : kind === "form"
                    ? "max-w-md"
                    : kind === "action"
                      ? "max-w-sm"
                      : "max-w-5xl",
              )}
            >
              <Card
                className={cn(
                  "overflow-hidden",
                  kind === "kpi" ? "border-0 p-0 shadow-none" : "",
                )}
                style={{
                  height:
                    kind === "chart"
                      ? 340
                      : kind === "table"
                        ? 460
                        : kind === "kpi"
                          ? 128
                          : undefined,
                }}
              >
                {kind !== "kpi" ? (
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <h3 className="text-sm font-semibold">
                      {name || suggestion?.name}
                    </h3>
                  </div>
                ) : null}

                <div
                  className={cn(
                    kind === "kpi"
                      ? "h-full"
                      : "h-[calc(100%-2.75rem)] min-h-0",
                  )}
                >
                  <ObjectRenderer
                    object={{
                      operationId: context.operation.id,
                      name: name || (suggestion?.name ?? "Preview"),
                      kind,
                      config,
                      method: context.operation.method,
                    }}
                    params={previewParams}
                    readOnly={context.connection.readOnly}
                    previewOnly
                    title={name || suggestion?.name}
                  />
                </div>
              </Card>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint">
                <CheckCircle2 className="size-3.5 text-positive" />
                {kind === "form" || kind === "action"
                  ? "Nothing is sent while you are previewing."
                  : "This is real data from your API, updating as you change settings."}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-ink-faint">
              Pick an object type on the left.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({
  kind,
  config,
  onChange,
  fields,
  operations,
}: {
  kind: ObjectKind;
  config: unknown;
  onChange: (next: unknown) => void;
  fields: FieldDescriptor[];
  operations: OperationListItem[];
}) {
  switch (kind) {
    case "table":
      return (
        <TablePanel
          config={config as never}
          onChange={onChange}
          fields={fields}
          operations={operations}
        />
      );
    case "chart":
      return (
        <ChartPanel config={config as never} onChange={onChange} fields={fields} />
      );
    case "kpi":
      return (
        <KpiPanel config={config as never} onChange={onChange} fields={fields} />
      );
    case "form":
      return <FormPanel config={config as never} onChange={onChange} />;
    case "action":
      return <ActionPanel config={config as never} onChange={onChange} />;
    default:
      return (
        <p className="text-xs text-ink-faint">
          {OBJECT_KIND_DESCRIPTION[kind]}
        </p>
      );
  }
}
