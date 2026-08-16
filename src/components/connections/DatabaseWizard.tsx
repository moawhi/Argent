"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  PlugZap,
} from "lucide-react";
import { createDatabaseConnectionAction } from "@/app/connections/db-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
} from "@/components/ui/primitives";
import { ENGINE_DEFAULTS, type DbEngine } from "@/lib/database/engines";
import type { DbConfig } from "@/server/database/types";

const ENGINES: DbEngine[] = ["postgres", "mariadb", "clickhouse"];

function emptyConfig(engine: DbEngine): DbConfig {
  return {
    engine,
    host: "localhost",
    port: ENGINE_DEFAULTS[engine].port,
    database: engine === "clickhouse" ? "default" : "postgres",
    user: engine === "postgres" ? "postgres" : "root",
    ssl: false,
    protocol: engine === "clickhouse" ? "http" : undefined,
  };
}

export function DatabaseWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [readOnly, setReadOnly] = useState(true);
  const [config, setConfig] = useState<DbConfig>(emptyConfig("postgres"));
  const [error, setError] = useState<string | null>(null);

  function setEngine(engine: DbEngine) {
    setConfig((current) => ({
      ...emptyConfig(engine),
      host: current.host,
      ssl: current.ssl,
      user: current.user,
      database: current.database,
      engine,
      port: ENGINE_DEFAULTS[engine].port,
      protocol: engine === "clickhouse" ? (current.ssl ? "https" : "http") : undefined,
    }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await createDatabaseConnectionAction({
        name: name || `${ENGINE_DEFAULTS[config.engine].label} at ${config.host}`,
        config: {
          ...config,
          protocol:
            config.engine === "clickhouse"
              ? config.ssl
                ? "https"
                : "http"
              : undefined,
        },
        password,
        readOnly,
      });

      if (!result.ok || !result.id) {
        setError(result.error ?? "Could not connect.");
        return;
      }

      router.push(`/connections/${result.id}`);
      router.refresh();
    });
  }

  const sslLabel = ENGINE_DEFAULTS[config.engine].sslLabel;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Database details</CardTitle>
          <p className="text-xs text-ink-soft">
            Argent tests the connection and maps schemas before saving. The
            password is encrypted and never shown again.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="Connection name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`${ENGINE_DEFAULTS[config.engine].label} production`}
          />
        </Field>

        <Field label="Engine">
          <div className="grid grid-cols-3 gap-2">
            {ENGINES.map((engine) => (
              <button
                key={engine}
                type="button"
                onClick={() => setEngine(engine)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  config.engine === engine
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-line hover:bg-canvas"
                }`}
              >
                <Database className="mb-1 size-3.5" />
                <span className="block font-medium">
                  {ENGINE_DEFAULTS[engine].label}
                </span>
                <span className="text-[10px] text-ink-faint">
                  port {ENGINE_DEFAULTS[engine].port}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Host" className="sm:col-span-2">
            <Input
              value={config.host}
              onChange={(event) =>
                setConfig((current) => ({ ...current, host: event.target.value }))
              }
              placeholder="localhost"
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={config.port}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  port: Number(event.target.value) || ENGINE_DEFAULTS[current.engine].port,
                }))
              }
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Database">
            <Input
              value={config.database}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  database: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Username">
            <Input
              value={config.user}
              onChange={(event) =>
                setConfig((current) => ({ ...current, user: event.target.value }))
              }
            />
          </Field>
        </div>

        <Field label="Password">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
          <Checkbox
            checked={config.ssl}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                ssl: event.target.checked,
                protocol:
                  current.engine === "clickhouse"
                    ? event.target.checked
                      ? "https"
                      : "http"
                    : current.protocol,
              }))
            }
          />
          Use {sslLabel}
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3">
          <Checkbox
            checked={!readOnly}
            onChange={(event) => setReadOnly(!event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Allow changes to data
            </span>
            <span className="block text-xs text-ink-soft">
              While this is off, Argent only runs SELECT / SHOW style queries.
            </span>
          </span>
        </label>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={pending || !password}>
            {pending ? <Loader2 className="animate-spin" /> : <PlugZap />}
            Test and save
          </Button>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-ink-faint">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-positive" />
          A successful test maps schemas and tables automatically.
        </p>
      </CardBody>
    </Card>
  );
}
