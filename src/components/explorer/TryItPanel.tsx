"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ResponseViewer } from "./ResponseViewer";
import { executeGateway } from "@/lib/gateway/client";
import { sampleForParameter } from "@/lib/openapi/sample";
import { describeParam, type OperationDoc } from "@/lib/docs/generate";
import type { ExecuteResponseBody } from "@/lib/gateway/types";
import type { ParameterDescriptor } from "@/lib/openapi/types";

/**
 * Runs a single endpoint with user-supplied values. Reads go straight through;
 * writes require the connection to allow them and an explicit confirmation.
 */
export function TryItPanel({
  operationId,
  doc,
  readOnly,
}: {
  operationId: string;
  doc: OperationDoc;
  readOnly: boolean;
  baseUrl: string;
}) {
  const inputs = [...doc.pathParams, ...doc.queryParams, ...doc.headerParams];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const param of inputs) {
      if (param.default !== undefined && param.default !== null) {
        initial[param.name] = String(param.default);
      } else if (param.required) {
        initial[param.name] = sampleForParameter(param);
      }
    }
    return initial;
  });

  const [body, setBody] = useState(doc.requestExample ?? "");
  const [result, setResult] = useState<ExecuteResponseBody | null>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isWrite = doc.method !== "GET" && doc.method !== "HEAD";
  const blocked = isWrite && readOnly;

  const missing = inputs
    .filter((param) => param.required && !values[param.name]?.trim())
    .map((param) => param.name);

  async function run() {
    setRunning(true);
    setResult(null);

    let parsedBody: unknown;
    if (isWrite && body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setResult({
          ok: false,
          status: null,
          durationMs: 0,
          contentType: null,
          error: {
            kind: "invalidParam",
            message: "The request body is not valid JSON.",
            detail: "Check for a missing comma or quote.",
          },
        });
        setRunning(false);
        return;
      }
    }

    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) params[key] = value;
    }

    const response = await executeGateway({
      operationId,
      params,
      body: parsedBody,
      origin: "tryIt",
      confirmWrite: true,
      noCache: true,
    });

    setResult(response);
    setRunning(false);
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Try it</CardTitle>
          <p className="text-xs text-ink-soft">
            {isWrite
              ? "This sends a real request that changes data."
              : "This sends a real read request. Nothing is changed."}
          </p>
        </div>
        <Badge tone={isWrite ? "warning" : "positive"}>{doc.method}</Badge>
      </CardHeader>

      <CardBody className="space-y-4">
        {blocked ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              This connection is read-only, so this request cannot be sent. Turn
              on “Allow changes to data” in the connection settings first.
            </span>
          </div>
        ) : null}

        {inputs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {inputs.map((param) => (
              <ParamInput
                key={`${param.in}:${param.name}`}
                param={param}
                value={values[param.name] ?? ""}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [param.name]: value }))
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-faint">
            This endpoint needs no extra information.
          </p>
        )}

        {isWrite ? (
          <Field
            label="What to send"
            hint="Edit the JSON below before sending. It is prefilled from the API description."
          >
            <Textarea
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="font-mono text-xs"
            />
          </Field>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            onClick={() => (isWrite ? setConfirming(true) : run())}
            disabled={running || blocked || missing.length > 0}
          >
            {running ? <Loader2 className="animate-spin" /> : <Play />}
            {running ? "Sending…" : "Send request"}
          </Button>
          {missing.length > 0 ? (
            <span className="text-xs text-ink-faint">
              Fill in {missing.join(", ")} first.
            </span>
          ) : null}
        </div>

        {result ? <ResponseViewer result={result} /> : null}
      </CardBody>

      <ConfirmDialog
        open={confirming}
        destructive={doc.method === "DELETE"}
        title={`Send this ${doc.method} request?`}
        description={`${doc.plainSummary} This affects real data on the connected API and cannot be undone from Argent.`}
        confirmLabel={`Yes, send ${doc.method}`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void run();
        }}
      />
    </Card>
  );
}

function ParamInput({
  param,
  value,
  onChange,
}: {
  param: ParameterDescriptor;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = param.name;
  const hint = describeParam(param);

  if (param.enumValues?.length) {
    return (
      <Field label={label} hint={hint} required={param.required}>
        <Select value={value} onChange={(event) => onChange(event.target.value)}>
          {!param.required ? <option value="">Not set</option> : null}
          {param.enumValues.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  const type =
    param.semantic === "date"
      ? "date"
      : param.semantic === "datetime"
        ? "datetime-local"
        : param.type === "integer" || param.type === "number"
          ? "number"
          : "text";

  return (
    <Field label={label} hint={hint} required={param.required}>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={param.example !== undefined ? String(param.example) : ""}
      />
    </Field>
  );
}
