import { Badge } from "@/components/ui/primitives";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import type { FormatKind } from "./types";

export const FORMAT_LABEL: Record<FormatKind, string> = {
  auto: "Automatic",
  text: "Plain text",
  number: "Number",
  currency: "Money",
  percent: "Percentage",
  date: "Date",
  datetime: "Date and time",
  boolean: "Yes / no",
  badge: "Label",
  link: "Link",
  json: "Raw data",
};

/** Formats a single value for display. Always returns a string. */
export function formatValue(
  value: unknown,
  format: FormatKind,
  options: { compact?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (format) {
    case "currency": {
      const num = toNumber(value);
      return num === null ? String(value) : formatCurrency(num, options.compact);
    }
    case "percent": {
      const num = toNumber(value);
      return num === null ? String(value) : formatPercent(num);
    }
    case "number": {
      const num = toNumber(value);
      return num === null ? String(value) : formatNumber(num, options.compact);
    }
    case "date":
      return formatDate(String(value));
    case "datetime":
      return formatDateTime(String(value));
    case "boolean":
      return value === true || value === "true" ? "Yes" : "No";
    case "json":
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function numericValue(value: unknown): number | null {
  return toNumber(value);
}

const STATUS_TONE: Record<string, "positive" | "warning" | "danger" | "neutral"> =
  {
    active: "positive",
    running: "positive",
    healthy: "positive",
    enabled: "positive",
    live: "positive",
    true: "positive",
    paused: "warning",
    pending: "warning",
    draft: "warning",
    inactive: "neutral",
    disabled: "neutral",
    archived: "neutral",
    false: "neutral",
    failed: "danger",
    error: "danger",
    deleted: "danger",
  };

/**
 * Renders a value with the small amount of markup some formats deserve:
 * status pills, clickable links, and a muted dash for empty cells.
 */
export function CellValue({
  value,
  format,
  compact,
}: {
  value: unknown;
  format: FormatKind;
  compact?: boolean;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-ink-faint">—</span>;
  }

  if (format === "badge") {
    const text = String(value);
    return (
      <Badge tone={STATUS_TONE[text.toLowerCase()] ?? "neutral"}>{text}</Badge>
    );
  }

  if (format === "boolean") {
    const truthy = value === true || value === "true";
    return (
      <Badge tone={truthy ? "positive" : "neutral"}>{truthy ? "Yes" : "No"}</Badge>
    );
  }

  if (format === "link") {
    const href = String(value);
    const safe = /^https?:\/\//i.test(href);
    if (!safe) return <span>{href}</span>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-brand hover:underline"
        title={href}
      >
        {href.replace(/^https?:\/\//, "").slice(0, 40)}
        {href.length > 47 ? "…" : ""}
      </a>
    );
  }

  const text = formatValue(value, format, { compact });

  if (format === "currency" || format === "percent" || format === "number") {
    const num = toNumber(value);
    const negative = num !== null && num < 0;
    return (
      <span className={negative ? "text-danger" : undefined}>{text}</span>
    );
  }

  return <span>{text}</span>;
}
