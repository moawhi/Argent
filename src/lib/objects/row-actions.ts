import {
  Archive,
  ArrowRightLeft,
  Copy,
  Download,
  ExternalLink,
  Eye,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { getByPath } from "@/lib/utils";
import type {
  RowAction,
  RowActionIcon,
  RowActionInput,
  RowActionKind,
  TableConfig,
} from "./types";

export const ROW_ACTION_ICON: Record<RowActionIcon, LucideIcon> = {
  view: Eye,
  edit: Pencil,
  delete: Trash2,
  archive: Archive,
  transfer: ArrowRightLeft,
  copy: Copy,
  download: Download,
  external: ExternalLink,
  play: Play,
  pause: Pause,
  settings: Settings2,
  select: MousePointerClick,
  plus: Plus,
};

export const ROW_ACTION_ICON_LABEL: Record<RowActionIcon, string> = {
  view: "Magnifier",
  edit: "Pencil",
  delete: "Bin",
  archive: "Archive box",
  transfer: "Two arrows",
  copy: "Copy",
  download: "Download",
  external: "Open elsewhere",
  play: "Play",
  pause: "Pause",
  settings: "Cog",
  select: "Pointer",
  plus: "Plus",
};

export const ROW_ACTION_KIND_LABEL: Record<RowActionKind, string> = {
  details: "Show the record",
  form: "Open a form and save",
  run: "Send one request",
  link: "Open a web address",
  select: "Select the row",
};

export const ROW_ACTION_KIND_HINT: Record<RowActionKind, string> = {
  details: "Reads one record and shows every field in a panel.",
  form: "Input boxes filled from the row, sent back when saved.",
  run: "Fires the endpoint straight away, behind a confirmation.",
  link: "Opens an address held in one of the row's fields.",
  select: "Marks the row so other tiles on the dashboard follow it.",
};

/** Methods that change data and therefore need a confirmation. */
export function isWriteMethod(method?: string): boolean {
  const upper = (method ?? "GET").toUpperCase();
  return upper !== "GET" && upper !== "HEAD" && upper !== "OPTIONS";
}

export function isWriteAction(action: RowAction): boolean {
  if (action.kind === "form") return true;
  if (action.kind === "run") return isWriteMethod(action.method);
  return false;
}

const BODY_PREFIX = "body.";

export function isBodyTarget(target: string): boolean {
  return target.startsWith(BODY_PREFIX);
}

export function bodyPath(target: string): string {
  return target.slice(BODY_PREFIX.length);
}

export function toBodyTarget(path: string): string {
  return `${BODY_PREFIX}${path}`;
}

let counter = 0;

function newId(): string {
  counter += 1;
  return `act_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/* ------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------ */

/**
 * Upgrades a stored action to the current shape. Objects saved before row
 * actions could open modals used `kind: "delete"` and a single key field.
 */
export function normalizeRowAction(raw: unknown): RowAction {
  const value = (raw ?? {}) as Omit<Partial<RowAction>, "kind">;
  const legacyKind = (raw as { kind?: string } | null)?.kind;
  const wasDelete = legacyKind === "delete";

  const kind: RowActionKind = wasDelete
    ? "run"
    : legacyKind === "form" ||
        legacyKind === "details" ||
        legacyKind === "run" ||
        legacyKind === "link" ||
        legacyKind === "select"
      ? legacyKind
      : "select";

  const inputs: RowActionInput[] =
    value.inputs ??
    (value.keyParam && value.keyField
      ? [{ target: value.keyParam, source: "row", field: value.keyField }]
      : []);

  return {
    id: value.id ?? newId(),
    kind,
    label: value.label ?? ROW_ACTION_KIND_LABEL[kind],
    icon: value.icon ?? defaultIconFor(kind, wasDelete),
    danger: value.danger ?? wasDelete,
    operationId: value.operationId,
    method: value.method ?? (wasDelete ? "DELETE" : undefined),
    inputs,
    formFields: value.formFields,
    confirm: value.confirm ?? wasDelete,
    confirmText: value.confirmText,
    successMessage: value.successMessage,
    urlField: value.urlField,
    refreshAfter: value.refreshAfter ?? wasDelete,
    targetObjectId: value.targetObjectId,
    keyField: value.keyField,
    keyParam: value.keyParam,
  };
}

/** Reads a table config from storage, tolerating older saved shapes. */
export function normalizeTableConfig(config: TableConfig): TableConfig {
  return {
    ...config,
    rowActions: (config.rowActions ?? []).map(normalizeRowAction),
    toolbarActions: (config.toolbarActions ?? []).map(normalizeRowAction),
    rowClickActionId: config.rowClickActionId ?? null,
  };
}

function defaultIconFor(kind: RowActionKind, destructive: boolean): RowActionIcon {
  if (destructive) return "delete";
  switch (kind) {
    case "details":
      return "view";
    case "form":
      return "edit";
    case "run":
      return "play";
    case "link":
      return "external";
    default:
      return "select";
  }
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

export interface RowActionTemplate {
  id: string;
  label: string;
  description: string;
  icon: RowActionIcon;
  build: () => RowAction;
}

export const ROW_ACTION_TEMPLATES: RowActionTemplate[] = [
  {
    id: "details",
    label: "View details",
    description: "Read the full record and show it in a panel.",
    icon: "view",
    build: () => base("details", "View details", "view"),
  },
  {
    id: "edit",
    label: "Edit",
    description: "Open a form filled from the row and save the changes.",
    icon: "edit",
    build: () => ({
      ...base("form", "Edit", "edit"),
      confirm: true,
      refreshAfter: true,
    }),
  },
  {
    id: "delete",
    label: "Delete",
    description: "Remove the record, behind a typed confirmation.",
    icon: "delete",
    build: () => ({
      ...base("run", "Delete", "delete"),
      danger: true,
      confirm: true,
      refreshAfter: true,
    }),
  },
  {
    id: "run",
    label: "Run an endpoint",
    description: "One button that calls any endpoint for this row.",
    icon: "play",
    build: () => ({ ...base("run", "Run", "play"), refreshAfter: true }),
  },
  {
    id: "link",
    label: "Open a link",
    description: "Open an address held in one of the row's fields.",
    icon: "external",
    build: () => base("link", "Open", "external"),
  },
  {
    id: "select",
    label: "Select the row",
    description: "Feed the row into other tiles on the same dashboard.",
    icon: "select",
    build: () => base("select", "Use this row", "select"),
  },
];

/** Templates for the table header toolbar (no selected row). */
export const TOOLBAR_ACTION_TEMPLATES: RowActionTemplate[] = [
  {
    id: "create",
    label: "Create",
    description: "Open a form to create a new record (Plus button).",
    icon: "plus",
    build: () => ({
      ...base("form", "Create", "plus"),
      confirm: false,
      refreshAfter: true,
      successMessage: "Created.",
    }),
  },
  {
    id: "run",
    label: "Run an endpoint",
    description: "Call an endpoint from the toolbar, without a row.",
    icon: "play",
    build: () => ({
      ...base("run", "Run", "play"),
      refreshAfter: true,
    }),
  },
  {
    id: "link",
    label: "Open a link",
    description: "Open a fixed web address from the toolbar.",
    icon: "external",
    build: () => ({
      ...base("link", "Open", "external"),
      inputs: [{ target: "url", source: "fixed", value: "https://" }],
    }),
  },
];

function base(
  kind: RowActionKind,
  label: string,
  icon: RowActionIcon,
): RowAction {
  return {
    id: newId(),
    kind,
    label,
    icon,
    danger: false,
    inputs: [],
    confirm: false,
    refreshAfter: false,
  };
}

/* ------------------------------------------------------------------ *
 * Resolving values at run time
 * ------------------------------------------------------------------ */

export interface ResolvedInputs {
  params: Record<string, unknown>;
  body: Record<string, unknown>;
  hasBody: boolean;
  /** Inputs the user still has to fill in before the request can go. */
  asks: RowActionInput[];
}

/**
 * Turns an action's input mapping into the parameters and body for one row.
 * `answers` holds whatever the user typed for `ask` inputs.
 */
export function resolveActionInputs(
  action: RowAction,
  row: Record<string, unknown>,
  answers: Record<string, string> = {},
): ResolvedInputs {
  const params: Record<string, unknown> = {};
  const body: Record<string, unknown> = {};
  const asks: RowActionInput[] = [];
  let hasBody = false;

  for (const input of action.inputs) {
    if (!input.target) continue;

    let value: unknown;

    if (input.source === "row") {
      value = input.field ? getByPath(row, input.field) : undefined;
    } else if (input.source === "fixed") {
      value = input.value;
    } else {
      asks.push(input);
      const answer = answers[input.target];
      value = answer !== undefined && answer !== "" ? answer : input.value;
    }

    if (value === undefined || value === null || value === "") continue;

    if (isBodyTarget(input.target)) {
      body[bodyPath(input.target)] = value;
      hasBody = true;
    } else {
      params[input.target] = value;
    }
  }

  return { params, body, hasBody, asks };
}

/** Inputs that must be answered before the request can be sent. */
export function unansweredInputs(
  action: RowAction,
  answers: Record<string, string>,
): RowActionInput[] {
  return action.inputs.filter(
    (input) =>
      input.source === "ask" &&
      input.required !== false &&
      !(answers[input.target] ?? input.value ?? "").toString().trim(),
  );
}

/** A short, human description of the row an action is about to touch. */
export function describeRow(
  row: Record<string, unknown>,
  rowIdField: string | null,
  labelFields: string[] = ["name", "title", "label", "email"],
): string {
  for (const key of labelFields) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  if (rowIdField) {
    const value = getByPath(row, rowIdField);
    if (value !== undefined && value !== null) return `#${String(value)}`;
  }

  return "this record";
}
