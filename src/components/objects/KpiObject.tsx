"use client";

import { useMemo } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { darkenHex, isHexColor } from "@/lib/colors/palette";
import { formatValue, numericValue } from "@/lib/objects/format";
import { cn, getByPath } from "@/lib/utils";
import type { KpiConfig } from "@/lib/objects/types";

const ACCENT_CLASS: Record<KpiConfig["accent"], string> = {
  brand: "from-brand/90 to-brand-ink text-white",
  positive: "from-positive/90 to-positive text-white",
  warning: "from-warning/90 to-warning text-white",
  danger: "from-danger/90 to-danger text-white",
  neutral: "from-ink/80 to-ink text-white",
};

/**
 * One headline number, optionally with a change indicator, matching the stat
 * cards along the top of the reference dashboard.
 */
export function KpiObject({
  config,
  rows,
  envelope,
  title,
}: {
  config: KpiConfig;
  rows: Record<string, unknown>[];
  envelope?: Record<string, unknown>;
  title?: string;
}) {
  const { value, change } = useMemo(() => {
    if (!config.valueField) return { value: null, change: null };

    const source =
      rows.length > 0
        ? rows
        : envelope
          ? [envelope]
          : [];

    const numbers = source
      .map((row) => numericValue(getByPath(row, config.valueField!)))
      .filter((entry): entry is number => entry !== null);

    if (numbers.length === 0) return { value: null, change: null };

    const value = aggregate(numbers, config.aggregate);

    let change: number | null = null;
    if (config.compare === "previousRow" && numbers.length >= 2) {
      const latest = numbers[numbers.length - 1];
      const previous = numbers[numbers.length - 2];
      if (previous !== 0) change = ((latest - previous) / Math.abs(previous)) * 100;
    } else if (config.compare === "firstRow" && numbers.length >= 2) {
      const first = numbers[0];
      const last = numbers[numbers.length - 1];
      if (first !== 0) change = ((last - first) / Math.abs(first)) * 100;
    }

    return { value, change };
  }, [config, rows, envelope]);

  const improving =
    change === null
      ? null
      : config.goodDirection === "up"
        ? change > 0
        : change < 0;

  const customColor = isHexColor(config.color)
    ? config.color
    : null;
  // Prefer an explicit hex; fall back to the named accent token classes.
  const customStyle = customColor
    ? {
        backgroundImage: `linear-gradient(135deg, ${customColor}, ${darkenHex(customColor)})`,
        color: "#ffffff",
      }
    : undefined;

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-xl bg-gradient-to-br p-4",
        !customColor && ACCENT_CLASS[config.accent],
        customColor && "text-white",
      )}
      style={customStyle}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium opacity-85">{title ?? config.caption}</p>
        {change !== null ? (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold",
              improving ? "text-white" : "text-white/90",
            )}
            title="Change versus the previous period"
          >
            {change > 0.5 ? (
              <TrendingUp className="size-3" />
            ) : change < -0.5 ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {Math.abs(change) < 0.05 ? "0%" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          </span>
        ) : null}
      </div>

      <p className="tabular text-3xl font-semibold leading-tight tracking-tight">
        {value === null ? "—" : formatValue(value, config.format, { compact: true })}
      </p>

      {config.caption && title ? (
        <p className="text-[11px] opacity-75">{config.caption}</p>
      ) : (
        <p className="text-[11px] opacity-75">{aggregateLabel(config)}</p>
      )}
    </div>
  );
}

function aggregate(numbers: number[], mode: KpiConfig["aggregate"]): number {
  switch (mode) {
    case "sum":
      return numbers.reduce((total, entry) => total + entry, 0);
    case "avg":
      return numbers.reduce((total, entry) => total + entry, 0) / numbers.length;
    case "min":
      return Math.min(...numbers);
    case "max":
      return Math.max(...numbers);
    case "count":
      return numbers.length;
    case "first":
      return numbers[0];
    case "latest":
    default:
      return numbers[numbers.length - 1];
  }
}

function aggregateLabel(config: KpiConfig): string {
  switch (config.aggregate) {
    case "sum":
      return "Total across all records";
    case "avg":
      return "Average across all records";
    case "min":
      return "Lowest value";
    case "max":
      return "Highest value";
    case "count":
      return "Number of records";
    case "first":
      return "Earliest value";
    case "latest":
    default:
      return "Most recent value";
  }
}
