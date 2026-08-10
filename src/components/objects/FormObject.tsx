"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { executeGateway } from "@/lib/gateway/client";
import {
  buildFormSchema,
  cleanFormPayload,
  zodFormResolver,
} from "@/lib/objects/form-schema";
import { cn } from "@/lib/utils";
import type { FormConfig, FormFieldConfig } from "@/lib/objects/types";

export interface FormObjectProps {
  config: FormConfig;
  objectId?: string;
  operationId?: string;
  /** Values to prefill, typically the row selected in a linked table. */
  initialValues?: Record<string, unknown>;
  /** Parameter values (path/query) the request needs, e.g. the record id. */
  params?: Record<string, unknown>;
  readOnly?: boolean;
  method?: string;
  onSuccess?: () => void;
  /** Render without sending anything, for the builder preview. */
  previewOnly?: boolean;
}

/**
 * Input boxes generated from an endpoint's request body schema. Submitting
 * sends the change through the gateway, behind a confirmation.
 */
export function FormObject({
  config,
  objectId,
  operationId,
  initialValues,
  params,
  readOnly,
  method = "PUT",
  onSuccess,
  previewOnly,
}: FormObjectProps) {
  const visibleFields = useMemo(
    () => config.fields.filter((field) => field.visible),
    [config.fields],
  );

  const schema = useMemo(() => buildFormSchema(config.fields), [config.fields]);

  const defaultValues = useMemo(
    () => buildDefaults(visibleFields, initialValues),
    [visibleFields, initialValues],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FieldValues>({
    resolver: zodFormResolver(schema),
    defaultValues,
  });

  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<
    { ok: boolean; message: string; detail?: string } | null
  >(null);
  const [confirming, setConfirming] = useState<Record<string, unknown> | null>(
    null,
  );

  // A newly selected table row should repopulate the form and clear whatever
  // the previous submission said.
  const [lastDefaults, setLastDefaults] = useState(defaultValues);
  if (defaultValues !== lastDefaults) {
    setLastDefaults(defaultValues);
    setStatus(null);
  }

  useEffect(() => {
    reset(defaultValues);
  }, [reset, defaultValues]);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    setStatus(null);

    const response = await executeGateway({
      objectId,
      operationId,
      params,
      body: cleanFormPayload(values, config.fields),
      origin: "gateway",
      confirmWrite: true,
      noCache: true,
    });

    setPending(false);

    if (response.ok) {
      setStatus({ ok: true, message: config.successMessage });
      onSuccess?.();
    } else {
      setStatus({
        ok: false,
        message: response.error?.message ?? "The change could not be saved.",
        detail: response.error?.detail,
      });
    }
  }

  if (visibleFields.length === 0) {
    return (
      <p className="p-4 text-xs text-ink-faint">
        No fields are turned on for this form yet.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => {
        if (previewOnly) {
          setStatus({
            ok: true,
            message: "Looks good. This is a preview, so nothing was sent.",
          });
          return;
        }
        setConfirming(values);
      })}
      className="flex h-full flex-col"
    >
      <div
        className={cn(
          "min-h-0 flex-1 gap-x-4 gap-y-3.5 overflow-y-auto p-4",
          config.layout === "two" ? "grid sm:grid-cols-2" : "flex flex-col",
        )}
      >
        {visibleFields.map((field) => (
          <FormControl
            key={field.path}
            field={field}
            register={register}
            error={errors[field.path]?.message as string | undefined}
          />
        ))}
      </div>

      <div className="space-y-2 border-t border-line p-3">
        {readOnly && !previewOnly ? (
          <p className="flex items-start gap-1.5 rounded-md bg-warning-soft px-2.5 py-2 text-[11px] text-ink">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            This connection is read-only, so saving is turned off. Enable
            changes in the connection settings first.
          </p>
        ) : null}

        {status ? (
          <p
            className={cn(
              "flex items-start gap-1.5 rounded-md px-2.5 py-2 text-[11px]",
              status.ok
                ? "bg-positive-soft text-positive"
                : "bg-danger-soft text-danger",
            )}
          >
            {status.ok ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span>
              {status.message}
              {status.detail ? (
                <span className="mt-0.5 block opacity-80">{status.detail}</span>
              ) : null}
            </span>
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={pending || (readOnly && !previewOnly)}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {config.submitLabel}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={`${config.submitLabel}?`}
        description={`This sends a ${method} request that changes real data on the connected API.`}
        confirmLabel="Yes, save it"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const values = confirming;
          setConfirming(null);
          if (values) void submit(values);
        }}
      />
    </form>
  );
}

function buildDefaults(
  fields: FormFieldConfig[],
  initial?: Record<string, unknown>,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of fields) {
    const provided = initial?.[field.path];

    if (field.control === "checkbox") {
      defaults[field.path] = provided === true || provided === "true";
      continue;
    }

    if (provided !== undefined && provided !== null) {
      // datetime-local rejects a full ISO string with a trailing Z.
      if (field.control === "datetime" && typeof provided === "string") {
        defaults[field.path] = provided.replace("Z", "").slice(0, 16);
        continue;
      }
      if (field.control === "date" && typeof provided === "string") {
        defaults[field.path] = provided.slice(0, 10);
        continue;
      }
      defaults[field.path] = String(provided);
      continue;
    }

    defaults[field.path] = field.control === "select" ? (field.options?.[0] ?? "") : "";
  }

  return defaults;
}

function FormControl({
  field,
  register,
  error,
}: {
  field: FormFieldConfig;
  register: ReturnType<typeof useForm<FieldValues>>["register"];
  error?: string;
}) {
  if (field.control === "hidden") return null;

  if (field.control === "checkbox") {
    return (
      <label className="flex cursor-pointer items-start gap-2 py-1">
        <Checkbox {...register(field.path)} className="mt-0.5" />
        <span>
          <span className="block text-sm text-ink">{field.label}</span>
          {field.helpText ? (
            <span className="block text-xs text-ink-faint">
              {field.helpText}
            </span>
          ) : null}
        </span>
      </label>
    );
  }

  return (
    <Field
      label={field.label}
      hint={field.helpText}
      error={error}
      required={field.required}
    >
      {field.control === "select" ? (
        <Select {...register(field.path)}>
          {!field.required ? <option value="">Not set</option> : null}
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      ) : field.control === "textarea" ? (
        <Textarea rows={3} placeholder={field.placeholder} {...register(field.path)} />
      ) : (
        <Input
          type={
            field.control === "number"
              ? "number"
              : field.control === "date"
                ? "date"
                : field.control === "datetime"
                  ? "datetime-local"
                  : "text"
          }
          step={field.control === "number" ? "any" : undefined}
          placeholder={field.placeholder}
          {...register(field.path)}
        />
      )}
    </Field>
  );
}
