export type ObjectKind = "table" | "chart" | "kpi" | "form" | "action";

export type FormatKind =
  | "auto"
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "datetime"
  | "boolean"
  | "badge"
  | "link"
  | "json";

export interface ColumnConfig {
  path: string;
  label: string;
  visible: boolean;
  format: FormatKind;
  align?: "left" | "right" | "center";
}

/**
 * What happens when a row action runs.
 *
 * - `details` reads one record and shows it.
 * - `form` opens input boxes and sends the result, for POST/PUT/PATCH.
 * - `run` fires a single request, typically a DELETE or a status change.
 * - `link` opens a URL taken from the row.
 * - `select` only marks the row, feeding other tiles on a dashboard.
 */
export type RowActionKind = "details" | "form" | "run" | "link" | "select";

export type RowActionIcon =
  | "view"
  | "edit"
  | "delete"
  | "archive"
  | "transfer"
  | "copy"
  | "download"
  | "external"
  | "play"
  | "pause"
  | "settings"
  | "select"
  | "plus";

/** Where one value sent by a row action comes from. */
export interface RowActionInput {
  /** An operation parameter name, or `body.<path>` for a request-body field. */
  target: string;
  source: "row" | "fixed" | "ask";
  /** Row field path, for `row`. */
  field?: string;
  /** Literal value for `fixed`, or the starting value for `ask`. */
  value?: string;
  /** Prompt shown for `ask`. */
  label?: string;
  required?: boolean;
}

export interface RowAction {
  id: string;
  kind: RowActionKind;
  label: string;
  icon: RowActionIcon;
  /** Red styling and a firmer confirmation. */
  danger: boolean;
  /** Endpoint this action calls, for `details`, `form` and `run`. */
  operationId?: string;
  /** Method of that endpoint, kept so the UI can warn before it is called. */
  method?: string;
  /** How the endpoint's parameters and body get their values. */
  inputs: RowActionInput[];
  /** Input boxes for `form`, generated from the endpoint's request body. */
  formFields?: FormFieldConfig[];
  /** Ask before sending. Forced on for anything that changes data. */
  confirm: boolean;
  confirmText?: string;
  successMessage?: string;
  /** Row field holding the address to open, for `link`. */
  urlField?: string;
  /** Reload the table once the action succeeds. */
  refreshAfter: boolean;

  /** @deprecated Pre-modal configs pointed at a whole form object. */
  targetObjectId?: string;
  /** @deprecated Superseded by `inputs`. */
  keyField?: string;
  /** @deprecated Superseded by `inputs`. */
  keyParam?: string;
}

export interface TableConfig {
  columns: ColumnConfig[];
  pageSize: number;
  searchable: boolean;
  rowIdField: string | null;
  rowActions: RowAction[];
  /**
   * Buttons in the table header toolbar (e.g. Create). Same shape as row
   * actions, but they run without a selected row — inputs should use `ask`
   * or `fixed`, not `row`.
   */
  toolbarActions?: RowAction[];
  /** Action opened by clicking the row itself. `null` selects the row. */
  rowClickActionId?: string | null;
  density: "comfortable" | "compact";
  emptyMessage?: string;
  /**
   * Load one page from the API/database at a time (recommended for large
   * result sets). When false, the first fetchLimit rows are loaded and
   * paged in the browser.
   */
  serverPagination?: boolean;
  /**
   * Max rows fetched per request. Defaults to `pageSize` when server
   * pagination is on, otherwise a shared safety cap.
   */
  fetchLimit?: number;
}

export type SeriesType =
  | "line"
  | "bar"
  | "area"
  | "scatter"
  | "pie"
  | "doughnut";

export interface ChartSeriesConfig {
  path: string;
  label: string;
  type: SeriesType;
  axis: "left" | "right";
  color?: string;
  format: FormatKind;
}

export const SERIES_TYPE_LABEL: Record<SeriesType, string> = {
  line: "Line",
  area: "Filled line",
  bar: "Bars",
  scatter: "Scatter",
  pie: "Pie",
  doughnut: "Doughnut",
};

export const SERIES_TYPE_DESCRIPTION: Record<SeriesType, string> = {
  line: "Trends over categories or time.",
  area: "Filled line for volume over time.",
  bar: "Compare values side by side.",
  scatter: "Plot points without connecting them.",
  pie: "Share of a total as slices.",
  doughnut: "Pie with a hollow centre.",
};

/** Order shown in the Object Builder chart-type picker. */
export const SERIES_TYPE_OPTIONS: SeriesType[] = [
  "line",
  "area",
  "bar",
  "scatter",
  "pie",
  "doughnut",
];

export const CARTESIAN_SERIES_TYPES: SeriesType[] = [
  "line",
  "bar",
  "area",
  "scatter",
];

export function isPieSeriesType(
  type: SeriesType,
): type is "pie" | "doughnut" {
  return type === "pie" || type === "doughnut";
}

export interface ChartConfig {
  xField: string;
  series: ChartSeriesConfig[];
  /** The range slider under the plot, as in the reference dashboard. */
  showZoom: boolean;
  stacked: boolean;
  smooth: boolean;
  legend: boolean;
  /** Sort rows by the x field before plotting. */
  sortByX: boolean;
  /** Max rows fetched for the plot. Defaults to a shared chart cap. */
  fetchLimit?: number;
}

export type Aggregate =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "latest"
  | "first";

export interface KpiConfig {
  valueField: string | null;
  aggregate: Aggregate;
  format: FormatKind;
  caption?: string;
  /** Compare the latest value against the one before it. */
  compare: "none" | "previousRow" | "firstRow";
  goodDirection: "up" | "down";
  accent: "brand" | "positive" | "warning" | "danger" | "neutral";
  /** Optional hex override; when set, used instead of the named accent. */
  color?: string;
  /** Max rows scanned when aggregating. Prefer a one-row aggregate query. */
  fetchLimit?: number;
}

export type FormControl =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "datetime"
  | "hidden";

export interface FormFieldConfig {
  path: string;
  label: string;
  control: FormControl;
  visible: boolean;
  required: boolean;
  helpText?: string;
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface FormConfig {
  fields: FormFieldConfig[];
  submitLabel: string;
  successMessage: string;
  layout: "single" | "two";
  /** Load the current record into the form before editing. */
  loadOperationId?: string;
}

export interface ActionConfig {
  label: string;
  description?: string;
  confirmTitle: string;
  confirmText: string;
  successMessage: string;
  variant: "primary" | "danger";
}

export type ObjectConfig =
  | TableConfig
  | ChartConfig
  | KpiConfig
  | FormConfig
  | ActionConfig;

export const OBJECT_KIND_LABEL: Record<ObjectKind, string> = {
  table: "Table",
  chart: "Chart",
  kpi: "Number card",
  form: "Form",
  action: "Action button",
};

export const OBJECT_KIND_DESCRIPTION: Record<ObjectKind, string> = {
  table: "A searchable, sortable list of records.",
  chart: "A line, bar, area, scatter, pie or doughnut chart.",
  kpi: "One headline number with an optional comparison.",
  form: "Input boxes that send a change back to the API.",
  action: "A single button that runs one request.",
};

/** Default grid footprint on the dashboard, in 12-column units. */
export const OBJECT_KIND_SIZE: Record<
  ObjectKind,
  { w: number; h: number }
> = {
  kpi: { w: 2, h: 4 },
  chart: { w: 7, h: 10 },
  table: { w: 7, h: 11 },
  form: { w: 5, h: 14 },
  action: { w: 3, h: 4 },
};
