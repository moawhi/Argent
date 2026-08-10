export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPk: boolean;
}

/** Outgoing link from one table's column to another's primary/unique key. */
export interface DbRelation {
  fromColumn: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
  /** Declared foreign key vs name-based guess (e.g. account_id → accounts.id). */
  source: "fk" | "inferred";
}

export interface DbTable {
  name: string;
  kind: "table" | "view";
  columns: DbColumn[];
  relations?: DbRelation[];
}

export interface DbSchema {
  name: string;
  tables: DbTable[];
}

export interface DbForeignKeyRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  to_schema: string;
  to_table: string;
  to_column: string;
}

/** Attach declared foreign keys onto tables in an introspected catalog. */
export function attachForeignKeys(
  schemas: DbSchema[],
  keys: DbForeignKeyRow[],
): DbSchema[] {
  const byTable = new Map<string, DbRelation[]>();

  for (const key of keys) {
    const id = `${key.schema_name}.${key.table_name}`;
    const list = byTable.get(id) ?? [];
    list.push({
      fromColumn: key.column_name,
      toSchema: key.to_schema,
      toTable: key.to_table,
      toColumn: key.to_column,
      source: "fk",
    });
    byTable.set(id, list);
  }

  return schemas.map((schema) => ({
    ...schema,
    tables: schema.tables.map((table) => {
      const relations = byTable.get(`${schema.name}.${table.name}`) ?? [];
      return relations.length > 0 ? { ...table, relations } : { ...table };
    }),
  }));
}

/**
 * When the engine has no FK metadata (or a column has none), guess links from
 * `*_id` / `*Id` column names that match another table's primary key.
 */
export function inferRelations(schemas: DbSchema[]): DbSchema[] {
  const tables: {
    schema: string;
    table: DbTable;
    pk: string | null;
  }[] = [];

  for (const schema of schemas) {
    for (const table of schema.tables) {
      const pk = table.columns.find((c) => c.isPk)?.name ?? null;
      tables.push({ schema: schema.name, table, pk });
    }
  }

  function findTarget(
    stem: string,
  ): { schema: string; table: string; column: string } | null {
    const candidates = [
      stem,
      `${stem}s`,
      stem.endsWith("y") ? `${stem.slice(0, -1)}ies` : null,
      stem.endsWith("s") ? stem.slice(0, -1) : null,
    ].filter(Boolean) as string[];

    for (const name of candidates) {
      const match = tables.find(
        (entry) => entry.table.name.toLowerCase() === name.toLowerCase(),
      );
      if (match?.pk) {
        return {
          schema: match.schema,
          table: match.table.name,
          column: match.pk,
        };
      }
    }
    return null;
  }

  return schemas.map((schema) => ({
    ...schema,
    tables: schema.tables.map((table) => {
      const existing = new Set(
        (table.relations ?? []).map((r) => r.fromColumn.toLowerCase()),
      );
      const inferred: DbRelation[] = [];

      for (const column of table.columns) {
        if (existing.has(column.name.toLowerCase())) continue;
        if (column.isPk) continue;

        const snake = column.name.match(/^(.+)_id$/i);
        const camel = column.name.match(/^(.+)Id$/);
        const stem = snake?.[1] ?? camel?.[1];
        if (!stem) continue;

        const target = findTarget(stem);
        if (!target) continue;
        if (
          target.schema === schema.name &&
          target.table === table.name &&
          target.column === column.name
        ) {
          continue;
        }

        inferred.push({
          fromColumn: column.name,
          toSchema: target.schema,
          toTable: target.table,
          toColumn: target.column,
          source: "inferred",
        });
      }

      const relations = [...(table.relations ?? []), ...inferred];
      return relations.length > 0 ? { ...table, relations } : table;
    }),
  }));
}

/** Full catalog map: declared FKs first, then naming-based guesses. */
export function mapCatalogRelations(
  schemas: DbSchema[],
  keys: DbForeignKeyRow[] = [],
): DbSchema[] {
  return inferRelations(attachForeignKeys(schemas, keys));
}

export function tableRef(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function countCatalog(schemas: DbSchema[]) {
  let tables = 0;
  let columns = 0;
  let relations = 0;
  for (const schema of schemas) {
    tables += schema.tables.length;
    for (const table of schema.tables) {
      columns += table.columns.length;
      relations += table.relations?.length ?? 0;
    }
  }
  return { schemas: schemas.length, tables, columns, relations };
}
