import {
  countCatalog,
  mapCatalogRelations,
  type DbRelation,
  type DbSchema,
  type DbTable,
} from "@/lib/database/schema-types";
import { parseParams, type OperationLike } from "@/lib/docs/generate";
import type { ParameterDescriptor } from "@/lib/openapi/types";
import type { DbEngine } from "@/lib/database/engines";
import { ENGINE_DEFAULTS } from "@/lib/database/engines";

export interface DatabaseTableDoc {
  id: string;
  schema: string;
  name: string;
  kind: "table" | "view";
  title: string;
  plainSummary: string;
  columns: DbTable["columns"];
  relations: DbRelation[];
  /** Tables that point at this one. */
  referencedBy: {
    schema: string;
    table: string;
    column: string;
    source: DbRelation["source"];
  }[];
}

export interface DatabaseSchemaGroup {
  schema: string;
  note: string | null;
  tables: DatabaseTableDoc[];
}

export interface SqlOperationDoc {
  id: string;
  operationKey: string;
  method: string;
  title: string;
  plainSummary: string;
  description: string | null;
  sqlTemplate: string;
  params: ParameterDescriptor[];
  tags: string[];
}

export interface DatabaseDocsModel {
  engine: DbEngine;
  engineLabel: string;
  baseUrl: string;
  stats: ReturnType<typeof countCatalog>;
  schemas: DatabaseSchemaGroup[];
  /** Flat relation edges for an overview diagram list. */
  edges: {
    from: string;
    to: string;
    column: string;
    source: DbRelation["source"];
  }[];
  queries: SqlOperationDoc[];
}

function qualify(schema: string, table: string) {
  return `${schema}.${table}`;
}

export function buildTableDocs(schemas: DbSchema[]): DatabaseTableDoc[] {
  const mapped = mapCatalogRelations(schemas);
  const inbound = new Map<string, DatabaseTableDoc["referencedBy"]>();

  for (const schema of mapped) {
    for (const table of schema.tables) {
      for (const relation of table.relations ?? []) {
        const target = qualify(relation.toSchema, relation.toTable);
        const list = inbound.get(target) ?? [];
        list.push({
          schema: schema.name,
          table: table.name,
          column: relation.fromColumn,
          source: relation.source,
        });
        inbound.set(target, list);
      }
    }
  }

  const docs: DatabaseTableDoc[] = [];
  for (const schema of mapped) {
    for (const table of schema.tables) {
      const id = qualify(schema.name, table.name);
      const pk = table.columns.filter((c) => c.isPk).map((c) => c.name);
      const relCount = table.relations?.length ?? 0;
      docs.push({
        id,
        schema: schema.name,
        name: table.name,
        kind: table.kind,
        title: table.name,
        plainSummary:
          table.kind === "view"
            ? `View with ${table.columns.length} column${table.columns.length === 1 ? "" : "s"}.`
            : `Table with ${table.columns.length} column${table.columns.length === 1 ? "" : "s"}${
                pk.length ? ` · primary key ${pk.join(", ")}` : ""
              }${relCount ? ` · ${relCount} outgoing relation${relCount === 1 ? "" : "s"}` : ""}.`,
        columns: table.columns,
        relations: table.relations ?? [],
        referencedBy: inbound.get(id) ?? [],
      });
    }
  }

  return docs;
}

export function buildSqlOperationDoc(
  operation: OperationLike & { sqlTemplate?: string | null },
): SqlOperationDoc {
  const params = parseParams(operation.params);
  const sql = operation.sqlTemplate?.trim() || "";
  const isWrite = operation.method.toUpperCase() !== "SELECT";

  return {
    id: operation.id,
    operationKey: operation.operationKey,
    method: operation.method,
    title:
      operation.summary?.trim() ||
      operation.operationKey.replace(/[_-]+/g, " "),
    plainSummary: isWrite
      ? `Runs a write query (${operation.method}) against this database.`
      : `Runs a SELECT query and returns rows for dashboards and objects.`,
    description: operation.description,
    sqlTemplate: sql,
    params,
    tags: operation.tags,
  };
}

export function buildDatabaseDocs(input: {
  engine: DbEngine;
  baseUrl: string;
  schemas: DbSchema[];
  operations: (OperationLike & { sqlTemplate?: string | null })[];
  notes?: Map<string, string | null>;
}): DatabaseDocsModel {
  const mapped = mapCatalogRelations(input.schemas);
  const tableDocs = buildTableDocs(mapped);
  const noteByKey = input.notes ?? new Map();

  const bySchema = new Map<string, DatabaseTableDoc[]>();
  for (const table of tableDocs) {
    const list = bySchema.get(table.schema) ?? [];
    list.push(table);
    bySchema.set(table.schema, list);
  }

  const edges: DatabaseDocsModel["edges"] = [];
  for (const table of tableDocs) {
    for (const relation of table.relations) {
      edges.push({
        from: qualify(table.schema, table.name),
        to: qualify(relation.toSchema, relation.toTable),
        column: relation.fromColumn,
        source: relation.source,
      });
    }
  }

  const queries = input.operations
    .filter((op) => op.source === "sql")
    .map(buildSqlOperationDoc);

  return {
    engine: input.engine,
    engineLabel: ENGINE_DEFAULTS[input.engine]?.label ?? input.engine,
    baseUrl: input.baseUrl,
    stats: countCatalog(mapped),
    schemas: [...bySchema.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([schema, tables]) => ({
        schema,
        note: noteByKey.get(`tag:${schema}`) ?? null,
        tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
      })),
    edges: edges.sort((a, b) => a.from.localeCompare(b.from)),
    queries,
  };
}
