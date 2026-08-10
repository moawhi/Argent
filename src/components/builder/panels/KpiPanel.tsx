"use client";

import { Field, Input, Label, Select } from "@/components/ui/primitives";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { ACCENT_HEX, normalizeHex } from "@/lib/colors/palette";
import { FORMAT_LABEL } from "@/lib/objects/format";
import { isNumericSemantic } from "@/lib/openapi/infer";
import type { FieldDescriptor } from "@/lib/openapi/types";
import type { Aggregate, FormatKind, KpiConfig } from "@/lib/objects/types";

const AGGREGATES: { value: Aggregate; label: string }[] = [
  { value: "sum", label: "Add every record together" },
  { value: "avg", label: "Average of every record" },
  { value: "latest", label: "Most recent record" },
  { value: "first", label: "Earliest record" },
  { value: "max", label: "Highest value" },
  { value: "min", label: "Lowest value" },
  { value: "count", label: "How many records" },
];

const FORMATS: FormatKind[] = ["number", "currency", "percent", "text"];

function accentFromHex(hex: string): KpiConfig["accent"] {
  const normalized = normalizeHex(hex);
  const match = (
    Object.entries(ACCENT_HEX) as [KpiConfig["accent"], string][]
  ).find(([, value]) => value === normalized);
  return match?.[0] ?? "brand";
}

export function KpiPanel({
  config,
  onChange,
  fields = [],
}: {
  config: KpiConfig;
  onChange: (next: KpiConfig) => void;
  fields?: FieldDescriptor[];
}) {
  function update(patch: Partial<KpiConfig>) {
    onChange({ ...config, ...patch });
  }

  const numericFields = fields.filter((field) =>
    isNumericSemantic(field.semantic),
  );

  const colourValue = config.color ?? ACCENT_HEX[config.accent];

  return (
    <div className="space-y-3">
      <Field label="Which number?">
        {numericFields.length > 0 ? (
          <Select
            value={config.valueField ?? ""}
            onChange={(event) => update({ valueField: event.target.value })}
            className="h-8 text-xs"
          >
            <option value="">Choose a field…</option>
            {numericFields.map((field) => (
              <option key={field.path} value={field.path}>
                {field.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={config.valueField ?? ""}
            onChange={(event) => update({ valueField: event.target.value })}
            placeholder="Field name"
            className="h-8 font-mono text-xs"
          />
        )}
      </Field>

      <Field
        label="How should several records become one number?"
        hint="Money usually adds up; percentages usually average."
      >
        <Select
          value={config.aggregate}
          onChange={(event) =>
            update({ aggregate: event.target.value as Aggregate })
          }
          className="h-8 text-xs"
        >
          {AGGREGATES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Show it as">
        <Select
          value={config.format}
          onChange={(event) =>
            update({ format: event.target.value as FormatKind })
          }
          className="h-8 text-xs"
        >
          {FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_LABEL[format]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-1.5">
        <Label>Colour</Label>
        <ColorPicker
          value={colourValue}
          onChange={(hex) => {
            if (!hex) {
              update({ color: undefined, accent: "brand" });
              return;
            }
            update({
              color: normalizeHex(hex),
              accent: accentFromHex(hex),
            });
          }}
        />
      </div>

      <Field
        label="Compare against"
        hint="Adds a small up or down badge in the corner."
      >
        <Select
          value={config.compare}
          onChange={(event) =>
            update({ compare: event.target.value as KpiConfig["compare"] })
          }
          className="h-8 text-xs"
        >
          <option value="none">Nothing</option>
          <option value="previousRow">The record before the latest</option>
          <option value="firstRow">The first record in the range</option>
        </Select>
      </Field>

      {config.compare !== "none" ? (
        <Field label="Which direction is good?">
          <Select
            value={config.goodDirection}
            onChange={(event) =>
              update({
                goodDirection: event.target.value as "up" | "down",
              })
            }
            className="h-8 text-xs"
          >
            <option value="up">Going up is good</option>
            <option value="down">Going down is good</option>
          </Select>
        </Field>
      ) : null}

      <Field label="Small print underneath" hint="Optional.">
        <Input
          value={config.caption ?? ""}
          onChange={(event) => update({ caption: event.target.value })}
          placeholder="e.g. Latest vs. previous week"
          className="h-8 text-xs"
        />
      </Field>

      <Field
        label="Max rows to scan"
        hint="Prefer a query that returns one aggregate. Default 1,000."
      >
        <Input
          type="number"
          min={1}
          max={5000}
          value={config.fetchLimit ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            update({
              fetchLimit: raw === "" ? undefined : Number(raw),
            });
          }}
          placeholder="1000"
          className="h-8 text-xs"
        />
      </Field>
    </div>
  );
}
