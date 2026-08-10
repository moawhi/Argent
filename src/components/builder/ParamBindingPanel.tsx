"use client";

import { Input, Label, Select } from "@/components/ui/primitives";
import { describeParam } from "@/lib/docs/generate";
import type { ParamBinding, ParamBindings } from "@/lib/gateway/types";
import type { ParameterDescriptor } from "@/lib/openapi/types";

/** Filter keys a parameter can follow. Kept in sync with the dashboard bar. */
const FILTER_OPTIONS = [
  { key: "dateRange.from", label: "Dashboard date range — start" },
  { key: "dateRange.to", label: "Dashboard date range — end" },
  { key: "timezone", label: "Dashboard timezone" },
  { key: "search", label: "Dashboard search box" },
];

const MODE_LABEL: Record<ParamBinding["mode"], string> = {
  static: "Always use this value",
  filter: "Follow a dashboard filter",
  prompt: "Ask me each time",
  selection: "Use the selected row",
  omit: "Leave it out",
  credential: "Filled in from credentials",
};

/**
 * Decides where each endpoint parameter gets its value. This is the piece that
 * makes one dashboard date picker drive every chart on the page.
 */
export function ParamBindingPanel({
  params,
  bindings,
  onChange,
  previewParams,
  onPreviewParamsChange,
}: {
  params: ParameterDescriptor[];
  bindings: ParamBindings;
  onChange: (next: ParamBindings) => void;
  previewParams: Record<string, unknown>;
  onPreviewParamsChange: (next: Record<string, unknown>) => void;
}) {
  function setBinding(name: string, binding: ParamBinding) {
    onChange({ ...bindings, [name]: binding });
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Values this endpoint needs
        </h3>
        <p className="mt-0.5 text-[11px] text-ink-faint">
          Dates usually work best following the dashboard filter.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-line p-3">
        {params.map((param) => {
          const binding = bindings[param.name] ?? { mode: "omit" as const };

          return (
            <div key={`${param.in}:${param.name}`} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="font-mono text-[11px] text-ink">
                  {param.name}
                  {param.required ? (
                    <span className="ml-0.5 text-danger">*</span>
                  ) : null}
                </Label>
                <span className="truncate text-[10px] text-ink-faint">
                  {describeParam(param).slice(0, 46)}
                </span>
              </div>

              <Select
                value={binding.mode}
                onChange={(event) => {
                  const mode = event.target.value as ParamBinding["mode"];
                  if (mode === "static") {
                    setBinding(param.name, {
                      mode: "static",
                      value: param.default ?? "",
                    });
                  } else if (mode === "filter") {
                    setBinding(param.name, {
                      mode: "filter",
                      filterKey: guessFilterKey(param.name),
                    });
                  } else if (mode === "selection") {
                    setBinding(param.name, {
                      mode: "selection",
                      field: param.name,
                    });
                  } else if (mode === "prompt") {
                    setBinding(param.name, { mode: "prompt" });
                  } else {
                    setBinding(param.name, { mode: "omit" });
                  }
                }}
                className="h-8 text-xs"
              >
                <option value="static">{MODE_LABEL.static}</option>
                <option value="filter">{MODE_LABEL.filter}</option>
                <option value="selection">{MODE_LABEL.selection}</option>
                <option value="prompt">{MODE_LABEL.prompt}</option>
                {!param.required ? (
                  <option value="omit">{MODE_LABEL.omit}</option>
                ) : null}
              </Select>

              {binding.mode === "static" ? (
                param.enumValues?.length ? (
                  <Select
                    value={String(binding.value ?? "")}
                    onChange={(event) =>
                      setBinding(param.name, {
                        mode: "static",
                        value: event.target.value,
                      })
                    }
                    className="h-8 text-xs"
                  >
                    {param.enumValues.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={String(binding.value ?? "")}
                    onChange={(event) =>
                      setBinding(param.name, {
                        mode: "static",
                        value: event.target.value,
                      })
                    }
                    placeholder={
                      param.example !== undefined ? String(param.example) : ""
                    }
                    className="h-8 text-xs"
                  />
                )
              ) : null}

              {binding.mode === "filter" ? (
                <Select
                  value={binding.filterKey}
                  onChange={(event) =>
                    setBinding(param.name, {
                      mode: "filter",
                      filterKey: event.target.value,
                    })
                  }
                  className="h-8 text-xs"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : null}

              {binding.mode === "selection" ? (
                <Input
                  value={binding.field}
                  onChange={(event) =>
                    setBinding(param.name, {
                      mode: "selection",
                      field: event.target.value,
                    })
                  }
                  placeholder="Field name in the selected row"
                  className="h-8 font-mono text-xs"
                />
              ) : null}

              {binding.mode === "prompt" ? (
                <Input
                  value={String(previewParams[param.name] ?? "")}
                  onChange={(event) =>
                    onPreviewParamsChange({
                      ...previewParams,
                      [param.name]: event.target.value,
                    })
                  }
                  placeholder="Value to use while previewing"
                  className="h-8 text-xs"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function guessFilterKey(name: string): string {
  if (/^(from|start|since)/i.test(name)) return "dateRange.from";
  if (/^(to|end|until)/i.test(name)) return "dateRange.to";
  if (/timezone/i.test(name)) return "timezone";
  return "search";
}
