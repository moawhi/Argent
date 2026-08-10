"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import type { ActionConfig } from "@/lib/objects/types";

export function ActionPanel({
  config,
  onChange,
}: {
  config: ActionConfig;
  onChange: (next: ActionConfig) => void;
}) {
  function update(patch: Partial<ActionConfig>) {
    onChange({ ...config, ...patch });
  }

  return (
    <div className="space-y-3">
      <Field label="Button text">
        <Input
          value={config.label}
          onChange={(event) => update({ label: event.target.value })}
          className="h-8 text-xs"
        />
      </Field>

      <Field label="Button style">
        <Select
          value={config.variant}
          onChange={(event) =>
            update({ variant: event.target.value as ActionConfig["variant"] })
          }
          className="h-8 text-xs"
        >
          <option value="primary">Normal</option>
          <option value="danger">Warning red, asks to type “delete”</option>
        </Select>
      </Field>

      <Field label="Explanation above the button" hint="Optional.">
        <Input
          value={config.description ?? ""}
          onChange={(event) => update({ description: event.target.value })}
          className="h-8 text-xs"
        />
      </Field>

      <Field label="Confirmation heading">
        <Input
          value={config.confirmTitle}
          onChange={(event) => update({ confirmTitle: event.target.value })}
          className="h-8 text-xs"
        />
      </Field>

      <Field
        label="Confirmation wording"
        hint="Spell out exactly what will happen. This is the last thing shown before the request is sent."
      >
        <Textarea
          rows={3}
          value={config.confirmText}
          onChange={(event) => update({ confirmText: event.target.value })}
          className="text-xs"
        />
      </Field>

      <Field label="Message after it works">
        <Input
          value={config.successMessage}
          onChange={(event) => update({ successMessage: event.target.value })}
          className="h-8 text-xs"
        />
      </Field>
    </div>
  );
}
