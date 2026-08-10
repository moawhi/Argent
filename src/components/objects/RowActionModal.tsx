"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Spinner } from "@/components/ui/primitives";
import { FormObject } from "./FormObject";
import { executeGateway, useGatewayData } from "@/lib/gateway/client";
import { CellValue } from "@/lib/objects/format";
import {
  ROW_ACTION_ICON,
  describeRow,
  isWriteAction,
  isWriteMethod,
  resolveActionInputs,
  unansweredInputs,
} from "@/lib/objects/row-actions";
import { humanizeKey } from "@/lib/utils";
import type { RowAction } from "@/lib/objects/types";
import type { ExecuteResponseBody } from "@/lib/gateway/types";

export interface RowActionTarget {
  action: RowAction;
  row: Record<string, unknown>;
}

/**
 * Runs one row action. Everything the action needs comes from the row itself,
 * apart from values the author chose to ask for, which are collected first.
 */
export function RowActionModal({
  target,
  rowIdField,
  readOnly,
  previewOnly,
  onClose,
  onDataChanged,
}: {
  target: RowActionTarget | null;
  rowIdField: string | null;
  readOnly?: boolean;
  previewOnly?: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}) {
  // Mounted only while an action is open, so each opening starts clean.
  if (!target) return null;

  return (
    <RowActionModalBody
      action={target.action}
      row={target.row}
      rowIdField={rowIdField}
      readOnly={readOnly}
      previewOnly={previewOnly}
      onClose={onClose}
      onDataChanged={onDataChanged}
    />
  );
}

function RowActionModalBody({
  action,
  row,
  rowIdField,
  readOnly,
  previewOnly,
  onClose,
  onDataChanged,
}: {
  action: RowAction;
  row: Record<string, unknown>;
  rowIdField: string | null;
  readOnly?: boolean;
  previewOnly?: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}) {
  const subject = describeRow(row, rowIdField);
  const Icon = ROW_ACTION_ICON[action.icon] ?? ROW_ACTION_ICON.settings;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<ExecuteResponseBody | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(!action.confirm);

  const resolved = useMemo(
    () => resolveActionInputs(action, row, answers),
    [action, row, answers],
  );

  const missing = unansweredInputs(action, answers);
  const isWrite = isWriteAction(action);
  const blockedByReadOnly = Boolean(readOnly) && isWrite;

  // A details view only reads, so it loads the moment it opens.
  const details = useGatewayData(
    ["rowAction", action.id, resolved.params],
    {
      operationId: action.operationId,
      params: resolved.params,
      origin: "gateway",
      noCache: true,
    },
    {
      enabled:
        action.kind === "details" &&
        Boolean(action.operationId) &&
        missing.length === 0,
    },
  );

  async function send() {
    if (!action.operationId) return;

    setSending(true);
    setSent(null);

    const response = await executeGateway({
      operationId: action.operationId,
      params: resolved.params,
      body: resolved.hasBody ? resolved.body : undefined,
      origin: "gateway",
      confirmWrite: true,
      noCache: true,
    });

    setSending(false);
    setSent(response);

    if (response.ok && action.refreshAfter) onDataChanged?.();
  }

  /* Form actions delegate to the normal form renderer -------------------- */

  if (action.kind === "form") {
    const fields = action.formFields ?? [];
    const formTitle =
      Object.keys(row).length === 0
        ? action.label
        : `${action.label} — ${subject}`;

    return (
      <Modal
        open
        size="md"
        title={formTitle}
        icon={<Icon className="size-4 text-ink-soft" />}
        onClose={onClose}
      >
        {fields.length === 0 || !action.operationId ? (
          <Placeholder>
            Open this table in the builder and pick the endpoint this action
            should save to.
          </Placeholder>
        ) : (
          <FormObject
            config={{
              fields,
              submitLabel: action.label,
              successMessage: action.successMessage ?? "Saved.",
              layout: fields.length > 6 ? "two" : "single",
            }}
            operationId={action.operationId}
            initialValues={row}
            params={resolved.params}
            method={action.method}
            readOnly={readOnly}
            previewOnly={previewOnly}
            onSuccess={() => {
              if (action.refreshAfter) onDataChanged?.();
            }}
          />
        )}
      </Modal>
    );
  }

  /* Details and run share the request-and-report shape ------------------- */

  const isDetails = action.kind === "details";
  const busy = isDetails ? details.isFetching : sending;
  const result = isDetails
    ? ((details.data ?? null) as ExecuteResponseBody | null)
    : sent;

  const failure = isDetails
    ? details.isError
      ? {
          message: "seeIt could not load this record.",
          detail: (details.error as Error)?.message,
        }
      : result && !result.ok
        ? result.error
        : null
    : result && !result.ok
      ? result.error
      : null;

  const canSend =
    Boolean(action.operationId) &&
    missing.length === 0 &&
    !blockedByReadOnly &&
    !(previewOnly && isWrite);

  return (
    <Modal
      open
      size={isDetails ? "lg" : "md"}
      title={`${action.label} — ${subject}`}
      description={
        action.kind === "run" && isWriteMethod(action.method)
          ? `This sends a ${action.method} request that changes real data on the connected API.`
          : undefined
      }
      icon={
        <Icon
          className={`size-4 ${action.danger ? "text-danger" : "text-ink-soft"}`}
        />
      }
      onClose={onClose}
      footer={
        isDetails ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => void details.refetch()}
              disabled={busy || !canSend}
            >
              <RefreshCw /> Refresh
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {result?.ok ? "Done" : "Cancel"}
            </Button>
            {result?.ok ? null : (
              <Button
                variant={action.danger ? "danger" : "primary"}
                onClick={() => {
                  if (!confirmed) {
                    setConfirmed(true);
                    return;
                  }
                  void send();
                }}
                disabled={busy || !canSend}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {confirmed
                  ? `Yes, ${action.label.toLowerCase()}`
                  : action.label}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-3 p-4">
        {!action.operationId ? (
          <Placeholder>
            Open this table in the builder and choose which endpoint this action
            should call.
          </Placeholder>
        ) : null}

        {blockedByReadOnly ? (
          <Notice tone="warning">
            This connection is read-only, so nothing can be sent. Turn on
            &ldquo;Allow changes&rdquo; in its settings first.
          </Notice>
        ) : null}

        {previewOnly && isWrite ? (
          <Notice tone="warning">
            You are previewing, so this action will not be sent.
          </Notice>
        ) : null}

        {!confirmed && !result ? (
          <Notice tone={action.danger ? "danger" : "warning"}>
            {action.confirmText ??
              `${action.label} ${subject}? seeIt cannot undo this afterwards.`}
          </Notice>
        ) : null}

        {missing.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-xs text-ink-soft">
              This action needs a little more information.
            </p>
            {action.inputs
              .filter((input) => input.source === "ask")
              .map((input) => (
                <Field
                  key={input.target}
                  label={input.label ?? humanizeKey(input.target)}
                  required={input.required !== false}
                >
                  <Input
                    value={answers[input.target] ?? input.value ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [input.target]: event.target.value,
                      }))
                    }
                  />
                </Field>
              ))}
          </div>
        ) : null}

        {busy ? (
          <p className="flex items-center gap-2 py-6 text-xs text-ink-faint">
            <Spinner /> Talking to the API…
          </p>
        ) : null}

        {failure ? (
          <Notice tone="danger">
            <span className="font-medium">
              {failure.message ?? "That request did not work."}
            </span>
            {failure.detail ? (
              <span className="mt-1 block max-h-32 overflow-auto whitespace-pre-wrap break-words opacity-80">
                {failure.detail}
              </span>
            ) : null}
          </Notice>
        ) : null}

        {result?.ok && !isDetails ? (
          <Notice tone="positive">
            {action.successMessage ?? `${action.label} finished.`}
          </Notice>
        ) : null}

        {result?.ok && isDetails ? (
          <RecordView result={result} fallback={row} />
        ) : null}
      </div>
    </Modal>
  );
}

/** Shows the record an endpoint returned, falling back to the table row. */
function RecordView({
  result,
  fallback,
}: {
  result: ExecuteResponseBody;
  fallback: Record<string, unknown>;
}) {
  const record = pickRecord(result) ?? fallback;

  const flat = Object.entries(record).filter(
    ([, value]) => value === null || typeof value !== "object",
  );
  const nested = Object.entries(record).filter(
    ([, value]) => value !== null && typeof value === "object",
  );

  return (
    <div className="space-y-3">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {flat.map(([key, value]) => (
          <div key={key} className="min-w-0 border-b border-line pb-1.5">
            <dt className="text-[11px] text-ink-faint">{humanizeKey(key)}</dt>
            <dd className="truncate text-sm text-ink">
              <CellValue value={value} format="auto" />
            </dd>
          </div>
        ))}
      </dl>

      {nested.length > 0 ? (
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-3 py-2 text-xs text-ink-soft">
            {nested.length === 1
              ? "1 nested field"
              : `${nested.length} nested fields`}
          </summary>
          <pre className="max-h-64 overflow-auto border-t border-line bg-canvas p-3 font-mono text-[11px] text-ink-soft">
            {JSON.stringify(Object.fromEntries(nested), null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function pickRecord(
  result: ExecuteResponseBody,
): Record<string, unknown> | null {
  if (result.rows?.length === 1) return result.rows[0];

  const data = result.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  if (Array.isArray(data) && data.length === 1 && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }

  return null;
}

function Placeholder({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-ink-faint">{children}</p>;
}

function Notice({
  tone,
  children,
}: {
  tone: "warning" | "danger" | "positive";
  children: ReactNode;
}) {
  const styles = {
    warning: "bg-warning-soft text-ink",
    danger: "bg-danger-soft text-danger",
    positive: "bg-positive-soft text-positive",
  }[tone];

  const Glyph = tone === "positive" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs leading-relaxed ${styles}`}
    >
      <Glyph className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
