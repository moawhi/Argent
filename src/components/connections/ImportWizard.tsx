"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  KeyRound,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  createConnectionAction,
  previewSpecAction,
  saveTokenAuthAction,
  testConnectionAction,
} from "@/app/connections/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { IngestResult } from "@/lib/openapi/types";
import type { TestResult } from "@/server/connections/service";

type Step = "source" | "review" | "credentials" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "Choose a file" },
  { id: "review", label: "Check what we found" },
  { id: "credentials", label: "Add your keys" },
  { id: "done", label: "Test" },
];

interface CredentialInput {
  name: string;
  in: "query" | "header";
  value: string;
  description?: string;
  occurrences: number;
}

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("source");
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<"file" | "url" | "paste">("file");
  const [urlValue, setUrlValue] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ingest, setIngest] = useState<IngestResult | null>(null);
  const [rawSpec, setRawSpec] = useState("");
  const [specFormat, setSpecFormat] = useState("yaml");

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [allowWrites, setAllowWrites] = useState(false);
  const [credentials, setCredentials] = useState<CredentialInput[]>([]);
  const [authChoice, setAuthChoice] = useState<"params" | "bearer">("params");
  const [bearerToken, setBearerToken] = useState("");

  const [result, setResult] = useState<{
    connectionId: string;
    test?: TestResult;
  } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  function handlePreview(payload: Parameters<typeof previewSpecAction>[0]) {
    setError(null);
    startTransition(async () => {
      const preview = await previewSpecAction(payload);

      if (!preview.ok || !preview.result) {
        setError(preview.error ?? "That file could not be read.");
        return;
      }

      setIngest(preview.result);
      setRawSpec(preview.rawSpec ?? "");
      setSpecFormat(preview.specFormat ?? "yaml");
      setName(preview.result.title);
      setBaseUrl(preview.result.servers.at(-1)?.url ?? "");
      const detected = preview.result.credentialCandidates.map((candidate) => ({
        name: candidate.name,
        in: (candidate.in === "header" ? "header" : "query") as
          | "query"
          | "header",
        value: "",
        description: candidate.description,
        occurrences: candidate.occurrences,
      }));
      // Specs often omit shared API keys from parameters. Seed a query param
      // the user can rename (e.g. apikey) so auth still works.
      setCredentials(
        detected.length > 0
          ? detected
          : [
              {
                name: "apikey",
                in: "query",
                value: "",
                description:
                  "Not found in the OpenAPI file — add any URL query key your API uses.",
                occurrences: 0,
              },
            ],
      );
      setAuthChoice("params");
      setStep("review");
    });
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    handlePreview({ source: "text", text });
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const created = await createConnectionAction({
        name,
        rawSpec,
        specFormat,
        baseUrl,
        credentials:
          authChoice === "params"
            ? credentials
                .filter(
                  (credential) =>
                    credential.name.trim() && credential.value.trim(),
                )
                .map((credential) => ({
                  name: credential.name.trim(),
                  in: credential.in,
                  value: credential.value.trim(),
                }))
            : [],
        allowWrites,
      });

      if (!created.ok || !created.connectionId) {
        setError(created.error ?? "The connection could not be saved.");
        return;
      }

      let test = created.test;
      if (authChoice === "bearer" && bearerToken.trim()) {
        const tokenResult = await saveTokenAuthAction(
          created.connectionId,
          "bearer",
          { token: bearerToken.trim() },
        );
        if (!tokenResult.ok) {
          setError(tokenResult.error ?? "Could not save the bearer token.");
          return;
        }
        // Re-test now that the token is in place.
        test = await testConnectionAction(created.connectionId);
      }

      setResult({ connectionId: created.connectionId, test });
      setStep("done");
    });
  }

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-2">
        {STEPS.map((entry, index) => (
          <li key={entry.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                index < stepIndex
                  ? "bg-positive text-white"
                  : index === stepIndex
                    ? "bg-brand text-white"
                    : "bg-canvas text-ink-faint",
              )}
            >
              {index < stepIndex ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                "hidden truncate text-xs sm:block",
                index === stepIndex ? "font-medium text-ink" : "text-ink-faint",
              )}
            >
              {entry.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="h-px flex-1 bg-line" />
            ) : null}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">That did not work</p>
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        </div>
      ) : null}

      {step === "source" ? (
        <Card className="p-5">
          <div className="mb-4 flex gap-1 rounded-lg bg-canvas p-1">
            {(
              [
                { id: "file", label: "Upload a file", icon: FileUp },
                { id: "url", label: "From a link", icon: Link2 },
                { id: "paste", label: "Paste it", icon: FileUp },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                onClick={() => setMode(option.id)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === option.id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={async (event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) await handleFile(file);
              }}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line px-6 py-10 text-center"
            >
              <FileUp className="size-7 text-ink-faint" />
              <div>
                <p className="text-sm font-medium">
                  Drop your API file here, or choose one
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  A Swagger or OpenAPI file, ending in .yaml, .yml or .json
                </p>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".yaml,.yml,.json,application/json,text/yaml"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) await handleFile(file);
                }}
              />
              <Button
                variant="secondary"
                onClick={() => fileInput.current?.click()}
                disabled={pending}
              >
                {pending ? <Loader2 className="animate-spin" /> : null}
                Choose a file
              </Button>
              {fileName ? (
                <p className="text-xs text-ink-faint">Selected: {fileName}</p>
              ) : null}
            </div>
          ) : mode === "url" ? (
            <div className="space-y-3">
              <Field
                label="Web address of the API file"
                hint="For example https://api.example.com/openapi.json"
              >
                <Input
                  value={urlValue}
                  onChange={(event) => setUrlValue(event.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                />
              </Field>
              <Button
                onClick={() => handlePreview({ source: "url", url: urlValue })}
                disabled={pending || !urlValue.trim()}
              >
                {pending ? <Loader2 className="animate-spin" /> : null}
                Read this file
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Paste the contents of your API file">
                <Textarea
                  rows={12}
                  value={pasteValue}
                  onChange={(event) => setPasteValue(event.target.value)}
                  placeholder={"openapi: 3.0.0\ninfo:\n  title: My API"}
                  className="font-mono text-xs"
                />
              </Field>
              <Button
                onClick={() => handlePreview({ source: "text", text: pasteValue })}
                disabled={pending || !pasteValue.trim()}
              >
                {pending ? <Loader2 className="animate-spin" /> : null}
                Read this file
              </Button>
            </div>
          )}
        </Card>
      ) : null}

      {step === "review" && ingest ? (
        <ReviewStep
          ingest={ingest}
          name={name}
          setName={setName}
          baseUrl={baseUrl}
          setBaseUrl={setBaseUrl}
          onBack={() => setStep("source")}
          onNext={() =>
            setStep(credentials.length > 0 ? "credentials" : "credentials")
          }
        />
      ) : null}

      {step === "credentials" ? (
        <CredentialsStep
          credentials={credentials}
          setCredentials={setCredentials}
          authChoice={authChoice}
          setAuthChoice={setAuthChoice}
          bearerToken={bearerToken}
          setBearerToken={setBearerToken}
          allowWrites={allowWrites}
          setAllowWrites={setAllowWrites}
          pending={pending}
          onBack={() => setStep("review")}
          onNext={handleCreate}
        />
      ) : null}

      {step === "done" && result ? (
        <DoneStep
          test={result.test}
          onOpen={() => router.push(`/explorer/${result.connectionId}`)}
          onBuild={() => router.push(`/objects/new?connection=${result.connectionId}`)}
          onSettings={() =>
            router.push(`/connections/${result.connectionId}`)
          }
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReviewStep({
  ingest,
  name,
  setName,
  baseUrl,
  setBaseUrl,
  onBack,
  onNext,
}: {
  ingest: IngestResult;
  name: string;
  setName: (value: string) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const readCount = ingest.operations.filter((op) => op.method === "GET").length;
  const writeCount = ingest.operations.length - readCount;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-positive-soft p-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
          <div>
            <p className="text-sm font-medium text-ink">
              Found {ingest.operations.length} endpoints in {ingest.tags.length}{" "}
              {ingest.tags.length === 1 ? "group" : "groups"}
            </p>
            <p className="text-xs text-ink-soft">
              {readCount} that read data and {writeCount} that change data.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {ingest.tags.slice(0, 14).map((tag) => (
            <Badge key={tag} tone="brand">
              {tag}
            </Badge>
          ))}
          {ingest.tags.length > 14 ? (
            <Badge tone="neutral">+{ingest.tags.length - 14} more</Badge>
          ) : null}
        </div>

        <div className="space-y-4">
          <Field
            label="What should we call this connection?"
            hint="Only used inside Argent, so pick whatever is easiest to recognise."
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field
            label="Which server should we talk to?"
            hint={
              ingest.servers.length > 1
                ? "Your file lists several. Development servers are usually safest to start with."
                : "This is where every request will be sent."
            }
          >
            {ingest.servers.length > 0 ? (
              <Select
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              >
                {ingest.servers.map((server) => (
                  <option key={server.url} value={server.url}>
                    {server.url}
                    {server.description ? ` — ${server.description}` : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.example.com"
              />
            )}
          </Field>
        </div>

        {ingest.warnings.length > 0 ? (
          <details className="mt-4 rounded-lg border border-warning/30 bg-warning-soft p-3">
            <summary className="cursor-pointer text-xs font-medium text-ink">
              {ingest.warnings.length} thing
              {ingest.warnings.length === 1 ? "" : "s"} to be aware of
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-soft">
              {ingest.warnings.map((warning) => (
                <li key={warning}>· {warning}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={onNext} disabled={!baseUrl.trim() || !name.trim()}>
          Continue <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CredentialsStep({
  credentials,
  setCredentials,
  authChoice,
  setAuthChoice,
  bearerToken,
  setBearerToken,
  allowWrites,
  setAllowWrites,
  pending,
  onBack,
  onNext,
}: {
  credentials: CredentialInput[];
  setCredentials: React.Dispatch<React.SetStateAction<CredentialInput[]>>;
  authChoice: "params" | "bearer";
  setAuthChoice: (value: "params" | "bearer") => void;
  bearerToken: string;
  setBearerToken: (value: string) => void;
  allowWrites: boolean;
  setAllowWrites: (value: boolean) => void;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-brand-soft p-3">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-brand-ink" />
          <div>
            <p className="text-sm font-medium text-ink">
              How should Argent authenticate?
            </p>
            <p className="text-xs text-ink-soft">
              Enter credentials once here. They are encrypted and added to every
              request for this connection.
            </p>
          </div>
        </div>

        <Field label="Method" className="mb-4">
          <Select
            value={authChoice}
            onChange={(event) =>
              setAuthChoice(event.target.value as "params" | "bearer")
            }
          >
            <option value="params">
              Query / header API key (e.g. ?apikey=…)
            </option>
            <option value="bearer">Bearer token (Authorization header)</option>
          </Select>
        </Field>

        {authChoice === "params" ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-soft">
              Added to every request. Rename the parameter if your API uses
              something other than what Argent detected — for example{" "}
              <code className="font-mono text-[11px]">apikey</code> on{" "}
              <code className="font-mono text-[11px]">
                /campaigns?apikey=…
              </code>
              .
            </p>
            {credentials.map((credential, index) => (
              <div
                key={`${credential.in}:${credential.name}:${index}`}
                className="space-y-2 rounded-lg border border-line p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
                  <Select
                    value={credential.in}
                    onChange={(event) => {
                      const next = [...credentials];
                      next[index] = {
                        ...credential,
                        in: event.target.value as "query" | "header",
                      };
                      setCredentials(next);
                    }}
                    className="h-9 text-xs"
                  >
                    <option value="query">Query</option>
                    <option value="header">Header</option>
                  </Select>
                  <Input
                    value={credential.name}
                    onChange={(event) => {
                      const next = [...credentials];
                      next[index] = {
                        ...credential,
                        name: event.target.value,
                      };
                      setCredentials(next);
                    }}
                    placeholder="Parameter name, e.g. apikey"
                    className="font-mono text-xs"
                  />
                </div>
                <Input
                  type="password"
                  autoComplete="off"
                  value={credential.value}
                  placeholder="Paste the value here"
                  onChange={(event) => {
                    const next = [...credentials];
                    next[index] = { ...credential, value: event.target.value };
                    setCredentials(next);
                  }}
                />
                <p className="text-[11px] text-ink-faint">
                  {credential.occurrences > 0
                    ? `Detected on ${credential.occurrences} endpoints · ${
                        credential.in === "query" ? "URL query" : "header"
                      }`
                    : `Not in the OpenAPI file — still sent on every request as a ${
                        credential.in === "query" ? "URL query" : "header"
                      }.`}
                </p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setCredentials((rows) => [
                    ...rows,
                    {
                      name: "",
                      in: "query",
                      value: "",
                      occurrences: 0,
                    },
                  ])
                }
              >
                Add another parameter
              </Button>
              {credentials.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCredentials((rows) => rows.slice(0, -1))
                  }
                >
                  Remove last
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {authChoice === "bearer" ? (
          <Field
            label="Bearer token"
            hint="Sent as Authorization: Bearer &lt;token&gt; on every request."
          >
            <Input
              type="password"
              autoComplete="off"
              value={bearerToken}
              placeholder="Paste access token"
              onChange={(event) => setBearerToken(event.target.value)}
            />
          </Field>
        ) : null}

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs text-ink-soft">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" />
          Values are encrypted before they are saved and are never sent to your
          browser. You can change them later at any time.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3">
          <Checkbox
            checked={allowWrites}
            onChange={(event) => setAllowWrites(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Allow this connection to change data
            </span>
            <span className="block text-xs text-ink-soft">
              Leave this off to start. While it is off, Argent will only ever read
              from this API, so nothing can be created, edited or deleted by
              accident.
            </span>
          </span>
        </label>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={onNext} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save and test
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DoneStep({
  test,
  onOpen,
  onBuild,
  onSettings,
}: {
  test?: TestResult;
  onOpen: () => void;
  onBuild: () => void;
  onSettings: () => void;
}) {
  const ok = test?.ok ?? false;

  return (
    <Card className="p-6 text-center">
      <div
        className={cn(
          "mx-auto mb-4 flex size-12 items-center justify-center rounded-full",
          ok ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning",
        )}
      >
        {ok ? (
          <CheckCircle2 className="size-6" />
        ) : (
          <AlertTriangle className="size-6" />
        )}
      </div>

      <h3 className="text-base font-semibold">
        {ok ? "Your API is connected" : "Connected, but the test call failed"}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
        {test?.message}
      </p>

      {test?.operationLabel ? (
        <p className="mt-2 text-xs text-ink-faint">
          Tested with: {test.operationLabel}
          {test.durationMs ? ` · ${test.durationMs} ms` : ""}
        </p>
      ) : null}

      {!ok && test?.detail ? (
        <details className="mx-auto mt-3 max-w-md text-left">
          <summary className="cursor-pointer text-xs text-ink-soft">
            Technical detail
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-canvas p-2 text-[11px] text-ink-soft">
            {test.detail}
          </pre>
        </details>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onBuild}>Build my first object</Button>
        <Button variant="secondary" onClick={onOpen}>
          Browse the endpoints
        </Button>
        <Button variant="ghost" onClick={onSettings}>
          Connection settings
        </Button>
      </div>
    </Card>
  );
}
