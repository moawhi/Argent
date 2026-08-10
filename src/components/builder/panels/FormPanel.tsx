"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Checkbox, Field, Input, Select } from "@/components/ui/primitives";
import type { FormConfig, FormControl } from "@/lib/objects/types";

const CONTROLS: { value: FormControl; label: string }[] = [
  { value: "text", label: "Single line" },
  { value: "textarea", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Tick box" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date and time" },
  { value: "hidden", label: "Hidden" },
];

export function FormPanel({
  config,
  onChange,
}: {
  config: FormConfig;
  onChange: (next: FormConfig) => void;
}) {
  function update(patch: Partial<FormConfig>) {
    onChange({ ...config, ...patch });
  }

  function updateField(
    index: number,
    patch: Partial<FormConfig["fields"][number]>,
  ) {
    const fields = [...config.fields];
    fields[index] = { ...fields[index], ...patch };
    update({ fields });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= config.fields.length) return;
    const fields = [...config.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    update({ fields });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Button text">
          <Input
            value={config.submitLabel}
            onChange={(event) => update({ submitLabel: event.target.value })}
            className="h-8 text-xs"
          />
        </Field>
        <Field label="Layout">
          <Select
            value={config.layout}
            onChange={(event) =>
              update({ layout: event.target.value as FormConfig["layout"] })
            }
            className="h-8 text-xs"
          >
            <option value="single">One column</option>
            <option value="two">Two columns</option>
          </Select>
        </Field>
      </div>

      <Field label="Message after a successful save">
        <Input
          value={config.successMessage}
          onChange={(event) => update({ successMessage: event.target.value })}
          className="h-8 text-xs"
        />
      </Field>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-ink-soft">
          Fields ({config.fields.filter((field) => field.visible).length} of{" "}
          {config.fields.length} shown)
        </p>

        <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {config.fields.map((field, index) => (
            <div
              key={field.path}
              className="rounded-md border border-line bg-surface p-2"
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateField(index, { visible: !field.visible })}
                  title={field.visible ? "Hide this field" : "Show this field"}
                  className="text-ink-faint hover:text-ink"
                >
                  {field.visible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </button>

                <Input
                  value={field.label}
                  onChange={(event) =>
                    updateField(index, { label: event.target.value })
                  }
                  className="h-7 flex-1 text-xs"
                />

                <div className="flex flex-col">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-ink-faint hover:text-ink disabled:opacity-25"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === config.fields.length - 1}
                    className="text-ink-faint hover:text-ink disabled:opacity-25"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
              </div>

              {field.visible ? (
                <div className="mt-1.5 space-y-1.5 pl-5">
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={field.control}
                      onChange={(event) =>
                        updateField(index, {
                          control: event.target.value as FormControl,
                        })
                      }
                      className="h-6 flex-1 text-[11px]"
                    >
                      {CONTROLS.map((control) => (
                        <option key={control.value} value={control.value}>
                          {control.label}
                        </option>
                      ))}
                    </Select>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-ink-soft">
                      <Checkbox
                        checked={field.required}
                        onChange={(event) =>
                          updateField(index, { required: event.target.checked })
                        }
                        className="size-3.5"
                      />
                      Required
                    </label>
                  </div>
                  <Input
                    value={field.helpText ?? ""}
                    onChange={(event) =>
                      updateField(index, { helpText: event.target.value })
                    }
                    placeholder="Helper text under the box"
                    className="h-6 text-[11px]"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
