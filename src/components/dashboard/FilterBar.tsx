"use client";

import { CalendarRange, ChevronDown, ChevronUp, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/primitives";
import { daysAgo, isoDate } from "@/lib/utils";
import type { FilterDefinition } from "@/server/dashboards/service";

export type FilterValues = Record<string, unknown>;

/**
 * Builds the starting filter values from each filter's saved default, so the
 * dashboard renders with real data on first paint.
 */
export function initialFilterValues(
  filters: FilterDefinition[],
): FilterValues {
  const values: FilterValues = {};

  for (const filter of filters) {
    if (filter.defaultValue !== null && filter.defaultValue !== undefined) {
      values[filter.key] = filter.defaultValue;
    } else if (filter.kind === "dateRange") {
      values[filter.key] = {
        from: isoDate(daysAgo(30)),
        to: isoDate(new Date()),
      };
    } else {
      values[filter.key] = "";
    }
  }

  return values;
}

/**
 * Dashboard-wide controls. Every widget whose parameters are bound to a filter
 * re-reads as soon as a value here changes.
 *
 * Laid out in a fixed grid with a scroll cap so many filters don't shove the
 * dashboard tiles around.
 */
export function FilterBar({
  filters,
  values,
  onChange,
  collapsed = false,
  onToggleCollapsed,
}: {
  filters: FilterDefinition[];
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  if (filters.length === 0) return null;

  function set(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-6">
        <p className="text-xs font-medium text-ink-soft">
          Filters
          <span className="ml-1.5 font-normal text-ink-faint">
            ({filters.length})
          </span>
        </p>
        <div className="flex items-center gap-1">
          {!collapsed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(initialFilterValues(filters))}
              title="Put every filter back to its default"
            >
              <RotateCcw />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          ) : null}
          {onToggleCollapsed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapsed}
              title={collapsed ? "Show filters" : "Hide filters"}
            >
              {collapsed ? <ChevronDown /> : <ChevronUp />}
              {collapsed ? "Show" : "Hide"}
            </Button>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div className="max-h-52 overflow-y-auto px-3 pb-3 sm:max-h-44 sm:px-6">
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
            {filters.map((filter) => (
              <FilterControl
                key={filter.id}
                filter={filter}
                value={values[filter.key]}
                onChange={(value) => set(filter.key, value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterControl({
  filter,
  value,
  onChange,
}: {
  filter: FilterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (filter.kind === "dateRange") {
    const range = (value ?? {}) as { from?: string; to?: string };
    const presets =
      ((filter.options as { presets?: number[] })?.presets ?? [7, 30, 90]);

    return (
      <div className="space-y-1 sm:col-span-2">
        <Label className="flex items-center gap-1">
          <CalendarRange className="size-3" />
          {filter.label}
        </Label>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none sm:flex-row sm:items-center">
            <Input
              type="date"
              value={range.from ?? ""}
              onChange={(event) =>
                onChange({ ...range, from: event.target.value })
              }
              className="h-8 w-full min-w-0 text-xs sm:w-36"
            />
            <span className="hidden text-xs text-ink-faint sm:inline">to</span>
            <Input
              type="date"
              value={range.to ?? ""}
              onChange={(event) =>
                onChange({ ...range, to: event.target.value })
              }
              className="h-8 w-full min-w-0 text-xs sm:w-36"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {presets.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() =>
                  onChange({
                    from: isoDate(daysAgo(days)),
                    to: isoDate(new Date()),
                  })
                }
                className="rounded-md border border-line px-1.5 py-1 text-[10px] text-ink-soft hover:bg-canvas hover:text-ink"
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (filter.kind === "select") {
    const options = ((filter.options as { values?: string[] })?.values ?? []);
    return (
      <div className="space-y-1">
        <Label>{filter.label}</Label>
        <Select
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full text-xs"
        >
          <option value="">Any</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  if (filter.kind === "date") {
    return (
      <div className="space-y-1">
        <Label>{filter.label}</Label>
        <Input
          type="date"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full text-xs"
        />
      </div>
    );
  }

  if (filter.kind === "number") {
    return (
      <div className="space-y-1">
        <Label>{filter.label}</Label>
        <Input
          type="number"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full text-xs"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label>{filter.label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
        <Input
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full pl-8 text-xs"
          placeholder={filter.label}
        />
      </div>
    </div>
  );
}
