import { SERIES_PALETTE } from "@/lib/colors/palette";
import { FETCH_LIMITS } from "@/lib/gateway/pagination";
import {
  isNumericSemantic,
  isTemporalSemantic,
  pickDefaultColumns,
  pickRowIdField,
} from "@/lib/openapi/infer";
import { humanizeKey, titleFromPath } from "@/lib/utils";
import type {
  FieldDescriptor,
  ResponseShape,
  SemanticType,
} from "@/lib/openapi/types";
import type {
  ActionConfig,
  ChartConfig,
  ChartSeriesConfig,
  ColumnConfig,
  FormatKind,
  FormConfig,
  FormControl,
  FormFieldConfig,
  KpiConfig,
  ObjectKind,
  TableConfig,
} from "./types";

/* ------------------------------------------------------------------ *
 * Formats
 * ------------------------------------------------------------------ */

const SEMANTIC_FORMAT: Partial<Record<SemanticType, FormatKind>> = {
  currency: "currency",
  percent: "percent",
  date: "date",
  datetime: "datetime",
  boolean: "boolean",
  enum: "badge",
  url: "link",
  number: "number",
  integer: "number",
  id: "number",
  json: "json",
};

export function defaultFormat(semantic: SemanticType): FormatKind {
  return SEMANTIC_FORMAT[semantic] ?? "text";
}

function alignFor(semantic: SemanticType): "left" | "right" | "center" {
  if (isNumericSemantic(semantic)) return "right";
  if (semantic === "boolean") return "center";
  return "left";
}

/* ------------------------------------------------------------------ *
 * Suggestions
 * ------------------------------------------------------------------ */

export interface ObjectSuggestion {
  kind: ObjectKind;
  name: string;
  /** Plain-language reason, shown to the user next to each option. */
  reason: string;
  /** 0-100; the highest scoring suggestion is preselected. */
  score: number;
  config: unknown;
}

export interface SuggestionInput {
  method: string;
  path: string;
  summary: string | null;
  response: ResponseShape;
  requestFields: FieldDescriptor[];
  hasRequestBody: boolean;
}

/**
 * Proposes the object types that make sense for an endpoint, ordered best
 * first. Display kinds (table, chart, number card) are always offered when
 * there is anything to show — the top-scoring one is marked Suggested in the
 * builder. Every suggestion carries a complete config so the preview can
 * render before the user changes anything.
 */
export function suggestObjects(input: SuggestionInput): ObjectSuggestion[] {
  const suggestions: ObjectSuggestion[] = [];
  const subject = titleFromPath(input.path);
  const method = input.method.toUpperCase();
  const fields = input.response.fields;

  const isCollection = input.response.kind === "collection";
  const isObject = input.response.kind === "object";
  const temporal = fields.filter((field) => isTemporalSemantic(field.semantic));
  const numeric = fields.filter((field) => isNumericSemantic(field.semantic));
  const hasFields = fields.length > 0;

  // --- Always-available display kinds ---------------------------------

  if (hasFields || isCollection || isObject) {
    if (isCollection && fields.length >= 2) {
      suggestions.push({
        kind: "table",
        name: subject,
        reason: `This returns a list, so each of the ${fields.length} fields can be a column.`,
        score: 90,
        config: buildTableConfig(fields),
      });
    } else if (isObject && fields.length >= 2 && method === "GET") {
      suggestions.push({
        kind: "table",
        name: `${subject} details`,
        reason: "Shows the single record this returns as a one-row table.",
        score: 60,
        config: buildTableConfig(fields),
      });
    } else {
      suggestions.push({
        kind: "table",
        name: subject,
        reason:
          "Shows whatever comes back as a table — useful even when the shape is unclear.",
        score: 40,
        config: buildTableConfig(fields),
      });
    }

    const hasTemporal = temporal.length > 0;
    const sampleNumbers = numeric
      .slice(0, 2)
      .map((field) => field.label)
      .join(" and ");
    suggestions.push({
      kind: "chart",
      name: hasTemporal ? `${subject} over time` : subject,
      reason:
        isCollection && numeric.length > 0 && hasTemporal
          ? `Rows have a date (${temporal[0].label}) and ${numeric.length} number${numeric.length === 1 ? "" : "s"}, which plots well.`
          : isCollection && numeric.length > 0
            ? `Plots ${sampleNumbers} across each row as a chart.`
            : numeric.length > 0
              ? `Build a line, bar, area, scatter, pie or doughnut chart from ${sampleNumbers}.`
              : "Build a line, bar, area, scatter, pie or doughnut chart — pick the axes in settings.",
      score:
        isCollection && numeric.length > 0 && hasTemporal
          ? 95
          : isCollection && numeric.length > 0
            ? 75
            : numeric.length > 0
              ? 55
              : 35,
      config: buildChartConfig(fields),
    });

    const headline =
      numeric.length > 0 ? pickHeadlineField(numeric) : null;
    suggestions.push({
      kind: "kpi",
      name: headline?.label ?? subject,
      reason: headline
        ? isCollection
          ? `Adds up ${headline.label} across every row into one number.`
          : `Shows ${headline.label} as a single headline number.`
        : "A single headline number — choose which field to show in settings.",
      score: headline
        ? isCollection && temporal.length > 0
          ? 70
          : 80
        : 30,
      config: buildKpiConfig(fields, isCollection),
    });
  }

  // --- Write-oriented kinds -------------------------------------------

  if (input.hasRequestBody && input.requestFields.length > 0) {
    suggestions.push({
      kind: "form",
      name:
        method === "POST" ? `New ${singular(subject)}` : `Update ${singular(subject)}`,
      reason: `The API accepts ${input.requestFields.length} field${input.requestFields.length === 1 ? "" : "s"}, so seeIt can build the input boxes for you.`,
      score: 95,
      config: buildFormConfig(input.requestFields, method, subject),
    });
  }

  if (method === "DELETE" || (!input.hasRequestBody && method !== "GET")) {
    suggestions.push({
      kind: "action",
      name: `${humanizeKey(method.toLowerCase())} ${singular(subject)}`,
      reason: "This endpoint takes no input, so a single button is enough.",
      score: 85,
      config: buildActionConfig(method, subject),
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      kind: "table",
      name: subject,
      reason:
        "seeIt could not tell what this returns, so it will show whatever comes back as a table.",
      score: 20,
      config: buildTableConfig(fields),
    });
    suggestions.push({
      kind: "chart",
      name: subject,
      reason:
        "Build a line, bar, area, scatter, pie or doughnut chart once data is available.",
      score: 15,
      config: buildChartConfig(fields),
    });
    suggestions.push({
      kind: "kpi",
      name: subject,
      reason: "A single headline number once you pick a field.",
      score: 10,
      config: buildKpiConfig(fields, false),
    });
  }

  // One entry per kind; keep the highest-scoring reason/config for each.
  const byKind = new Map<ObjectKind, ObjectSuggestion>();
  for (const entry of suggestions) {
    const existing = byKind.get(entry.kind);
    if (!existing || entry.score > existing.score) {
      byKind.set(entry.kind, entry);
    }
  }

  return [...byKind.values()].sort((a, b) => b.score - a.score);
}

function singular(word: string): string {
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Prefers a total or headline money field over an incidental number. */
function pickHeadlineField(numeric: FieldDescriptor[]): FieldDescriptor {
  const byPriority = [...numeric].sort((a, b) => score(b) - score(a));
  return byPriority[0];

  function score(field: FieldDescriptor): number {
    let value = 0;
    if (/^total/i.test(field.key)) value += 6;
    if (field.semantic === "currency") value += 5;
    if (/(balance|revenue|profit|spend|cost|earned)/i.test(field.key)) value += 4;
    if (field.semantic === "percent") value += 2;
    if (/(id|count)$/i.test(field.key)) value -= 4;
    return value;
  }
}

/* ------------------------------------------------------------------ *
 * Config builders
 * ------------------------------------------------------------------ */

export function buildTableConfig(fields: FieldDescriptor[]): TableConfig {
  const defaults = new Set(pickDefaultColumns(fields));

  const columns: ColumnConfig[] = fields.map((field) => ({
    path: field.path,
    label: field.label,
    visible: defaults.has(field.path),
    format: defaultFormat(field.semantic),
    align: alignFor(field.semantic),
  }));

  return {
    columns,
    pageSize: FETCH_LIMITS.tableDefaultPage,
    searchable: true,
    rowIdField: pickRowIdField(fields),
    rowActions: [],
    toolbarActions: [],
    rowClickActionId: null,
    density: "comfortable",
    serverPagination: true,
  };
}

export function buildChartConfig(fields: FieldDescriptor[]): ChartConfig {
  const temporal = fields.filter((field) => isTemporalSemantic(field.semantic));
  const numeric = fields.filter(
    (field) => isNumericSemantic(field.semantic) && field.semantic !== "id",
  );

  const xField = temporal[0]?.path ?? fields[0]?.path ?? "";

  // Two series keeps the default readable; the rest stay available in the panel.
  const chosen = numeric.slice(0, 2);

  const series: ChartSeriesConfig[] = numeric.map((field, index) => ({
    path: field.path,
    label: field.label,
    type: index === 0 ? "area" : "line",
    // A percentage next to a dollar amount needs its own scale.
    axis:
      index > 0 && field.semantic === "percent" && chosen[0]?.semantic !== "percent"
        ? "right"
        : "left",
    color: SERIES_PALETTE[index % SERIES_PALETTE.length],
    format: defaultFormat(field.semantic),
  }));

  return {
    xField,
    series: series.filter((entry) =>
      chosen.some((field) => field.path === entry.path),
    ),
    showZoom: true,
    stacked: false,
    smooth: false,
    legend: true,
    sortByX: true,
  };
}

export function buildKpiConfig(
  fields: FieldDescriptor[],
  isCollection: boolean,
): KpiConfig {
  const numeric = fields.filter((field) => isNumericSemantic(field.semantic));
  const headline = numeric.length > 0 ? pickHeadlineField(numeric) : null;

  return {
    valueField: headline?.path ?? null,
    aggregate: isCollection
      ? headline?.semantic === "percent"
        ? "avg"
        : "sum"
      : "latest",
    format: headline ? defaultFormat(headline.semantic) : "number",
    compare: "none",
    goodDirection: "up",
    accent: headline?.semantic === "currency" ? "positive" : "brand",
  };
}

const CONTROL_BY_SEMANTIC: Partial<Record<SemanticType, FormControl>> = {
  boolean: "checkbox",
  enum: "select",
  date: "date",
  datetime: "datetime",
  currency: "number",
  percent: "number",
  number: "number",
  integer: "number",
  id: "number",
  longText: "textarea",
};

export function buildFormConfig(
  fields: FieldDescriptor[],
  method: string,
  subject: string,
): FormConfig {
  const formFields: FormFieldConfig[] = fields
    .filter((field) => !field.readOnly)
    .map((field) => ({
      path: field.path,
      label: field.label,
      control:
        field.enumValues?.length
          ? "select"
          : (CONTROL_BY_SEMANTIC[field.semantic] ?? "text"),
      visible: true,
      required: field.required,
      helpText: field.description,
      options: field.enumValues,
      placeholder:
        field.example !== undefined && field.example !== null
          ? String(field.example)
          : undefined,
      min: field.minimum,
      max: field.maximum,
    }));

  const verb = method === "POST" ? "Create" : "Save";

  return {
    fields: formFields,
    submitLabel: `${verb} ${singular(subject).toLowerCase()}`,
    successMessage:
      method === "POST"
        ? `${singular(subject)} created.`
        : `${singular(subject)} updated.`,
    layout: formFields.length > 6 ? "two" : "single",
  };
}

export function buildActionConfig(
  method: string,
  subject: string,
): ActionConfig {
  const destructive = method === "DELETE";
  const name = singular(subject).toLowerCase();

  return {
    label: destructive ? `Delete ${name}` : `Run ${name}`,
    confirmTitle: destructive ? `Delete this ${name}?` : `Run this request?`,
    confirmText: destructive
      ? `This permanently removes the ${name} from the connected API. It cannot be undone from seeIt.`
      : `This sends a ${method} request to the connected API.`,
    successMessage: destructive ? `${singular(subject)} deleted.` : "Done.",
    variant: destructive ? "danger" : "primary",
  };
}
