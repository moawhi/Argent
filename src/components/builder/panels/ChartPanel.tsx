"use client";

import { Plus, X } from "lucide-react";
import {
  Checkbox,
  Field,
  Input,
  Label,
  Select,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { SERIES_PALETTE } from "@/lib/colors/palette";
import { isNumericSemantic } from "@/lib/openapi/infer";
import { defaultFormat } from "@/lib/objects/suggest";
import { cn } from "@/lib/utils";
import type { FieldDescriptor } from "@/lib/openapi/types";
import {
  SERIES_TYPE_DESCRIPTION,
  SERIES_TYPE_LABEL,
  SERIES_TYPE_OPTIONS,
  isPieSeriesType,
  type ChartConfig,
  type ChartSeriesConfig,
  type SeriesType,
} from "@/lib/objects/types";

export function ChartPanel({
  config,
  onChange,
  fields = [],
}: {
  config: ChartConfig;
  onChange: (next: ChartConfig) => void;
  fields?: FieldDescriptor[];
}) {
  function update(patch: Partial<ChartConfig>) {
    onChange({ ...config, ...patch });
  }

  function updateSeries(index: number, patch: Partial<ChartSeriesConfig>) {
    const series = [...config.series];
    series[index] = { ...series[index], ...patch };
    update({ series });
  }

  function setChartType(type: SeriesType) {
    if (config.series.length === 0) {
      update({
        series: [
          {
            path: "",
            label: "Value",
            type,
            axis: "left",
            color: SERIES_PALETTE[0],
            format: "number",
          },
        ],
      });
      return;
    }

    // Apply the chosen chart type to every series so pie/doughnut/etc. are
    // one click away, not hidden in a per-value dropdown.
    update({
      series: config.series.map((series) => ({ ...series, type })),
    });
  }

  const numericFields = fields.filter(
    (field) => isNumericSemantic(field.semantic) && field.semantic !== "id",
  );
  const used = new Set(config.series.map((entry) => entry.path));
  const available = numericFields.filter((field) => !used.has(field.path));
  const chartType = config.series[0]?.type ?? "line";
  const usesPie = isPieSeriesType(chartType);
  const mixedTypes = config.series.some((series) => series.type !== chartType);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Chart type</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {SERIES_TYPE_OPTIONS.map((type) => {
            const active = chartType === type && !mixedTypes;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setChartType(type)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-brand bg-brand-soft"
                    : "border-line hover:bg-canvas",
                )}
              >
                <span className="block text-xs font-medium text-ink">
                  {SERIES_TYPE_LABEL[type]}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-ink-faint">
                  {SERIES_TYPE_DESCRIPTION[type]}
                </span>
              </button>
            );
          })}
        </div>
        {mixedTypes ? (
          <p className="text-[11px] text-ink-faint">
            Series use different types. Pick one above to apply it to all, or
            change each value below.
          </p>
        ) : null}
      </div>

      <Field
        label={
          usesPie ? "Slice labels" : "Across the bottom (the time axis)"
        }
        hint={
          usesPie
            ? "Each distinct value becomes a slice of the pie."
            : undefined
        }
      >
        {fields.length > 0 ? (
          <Select
            value={config.xField}
            onChange={(event) => update({ xField: event.target.value })}
            className="h-8 text-xs"
          >
            {fields.map((field) => (
              <option key={field.path} value={field.path}>
                {field.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={config.xField}
            onChange={(event) => update({ xField: event.target.value })}
            className="h-8 font-mono text-xs"
          />
        )}
      </Field>

      <div className="space-y-1.5">
        <Label>Values to plot</Label>

        <div className="space-y-1.5">
          {config.series.map((series, index) => (
            <div
              key={series.path || `series-${index}`}
              className="space-y-1.5 rounded-md border border-line bg-surface p-2"
            >
              <div className="flex items-center gap-1.5">
                <Input
                  value={series.label}
                  onChange={(event) =>
                    updateSeries(index, { label: event.target.value })
                  }
                  className="h-7 flex-1 text-xs"
                />
                <button
                  onClick={() =>
                    update({
                      series: config.series.filter((_, i) => i !== index),
                    })
                  }
                  className="text-ink-faint hover:text-danger"
                  aria-label={`Remove ${series.label}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <ColorPicker
                size="sm"
                value={
                  series.color ?? SERIES_PALETTE[index % SERIES_PALETTE.length]
                }
                onChange={(hex) =>
                  updateSeries(index, {
                    color: hex ?? SERIES_PALETTE[index % SERIES_PALETTE.length],
                  })
                }
              />

              <div
                className={
                  isPieSeriesType(series.type)
                    ? "grid grid-cols-1 gap-1.5"
                    : "grid grid-cols-2 gap-1.5"
                }
              >
                <Select
                  value={series.type}
                  onChange={(event) =>
                    updateSeries(index, {
                      type: event.target.value as SeriesType,
                    })
                  }
                  className="h-7 text-[11px]"
                  aria-label={`Chart type for ${series.label}`}
                >
                  {SERIES_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {SERIES_TYPE_LABEL[type]}
                    </option>
                  ))}
                </Select>
                {!isPieSeriesType(series.type) ? (
                  <Select
                    value={series.axis}
                    onChange={(event) =>
                      updateSeries(index, {
                        axis: event.target.value as "left" | "right",
                      })
                    }
                    className="h-7 text-[11px]"
                  >
                    <option value="left">Left scale</option>
                    <option value="right">Right scale</option>
                  </Select>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {available.length > 0 ? (
          <Select
            value=""
            onChange={(event) => {
              const field = numericFields.find(
                (entry) => entry.path === event.target.value,
              );
              if (!field) return;
              update({
                series: [
                  ...config.series,
                  {
                    path: field.path,
                    label: field.label,
                    type: chartType,
                    axis: "left",
                    color:
                      SERIES_PALETTE[
                        config.series.length % SERIES_PALETTE.length
                      ],
                    format: defaultFormat(field.semantic),
                  },
                ],
              });
            }}
            className="h-8 text-xs"
          >
            <option value="">+ Add another value…</option>
            {available.map((field) => (
              <option key={field.path} value={field.path}>
                {field.label}
              </option>
            ))}
          </Select>
        ) : config.series.length === 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              update({
                series: [
                  {
                    path: "",
                    label: "Value",
                    type: chartType,
                    axis: "left",
                    color: SERIES_PALETTE[0],
                    format: "number",
                  },
                ],
              })
            }
          >
            <Plus /> Add a value
          </Button>
        ) : null}

        {usesPie ? (
          <p className="text-[11px] text-ink-faint">
            Pie and doughnut charts use the first value for slice sizes. Extra
            values still contribute their colours to the palette.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        {(
          [
            ["legend", "Show the legend"],
            ...(!usesPie
              ? ([
                  ["showZoom", "Show the range slider underneath"],
                  ["smooth", "Smooth the lines"],
                  ["stacked", "Stack the values on top of each other"],
                  ["sortByX", "Sort by date before plotting"],
                ] as const)
              : ([["sortByX", "Sort slices by the label field"]] as const)),
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 text-xs text-ink"
          >
            <Checkbox
              checked={config[key]}
              onChange={(event) => update({ [key]: event.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>

      <Field
        label="Max points to load"
        hint="Stops huge reports from freezing the dashboard. Default 2,000."
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
          placeholder="2000"
          className="h-8 text-xs"
        />
      </Field>
    </div>
  );
}
