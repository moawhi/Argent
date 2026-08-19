"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import {
  buildBuilderContext,
  buildRowActionTarget,
  createObjectsForOperations,
  getObject,
  saveObject,
  type BuilderContext,
  type RowActionTarget,
  type SaveObjectInput,
} from "@/server/objects/service";
import { listConnections } from "@/server/connections/service";
import { listOperations } from "@/server/operations/queries";
import {
  filterAccessibleConnections,
  filterCallableOperations,
} from "@/server/auth/api-grants";
import { ensureSiteEditor } from "@/server/auth/permissions";
import { normalizeTableConfig } from "@/lib/objects/row-actions";
import type { ObjectKind, TableConfig } from "@/lib/objects/types";
import type { ParamBindings } from "@/lib/gateway/types";
import type { OperationListItem } from "@/server/operations/queries";

export async function builderContextAction(
  operationId: string,
): Promise<BuilderContext | null> {
  await ensureSiteEditor();
  return buildBuilderContext(operationId);
}

/** Loads the parameters and body fields of an endpoint a row action calls. */
export async function rowActionTargetAction(
  operationId: string,
): Promise<RowActionTarget | null> {
  return buildRowActionTarget(operationId);
}

export async function loadObjectEditorAction(objectId: string): Promise<{
  initial: {
    id: string;
    name: string;
    kind: ObjectKind;
    config: unknown;
    paramBindings: ParamBindings;
    operationId: string;
  };
  connections: {
    id: string;
    name: string;
    readOnly: boolean;
    type?: string;
  }[];
  operationsByConnection: Record<string, OperationListItem[]>;
} | null> {
  const user = await ensureSiteEditor();
  const object = await getObject(objectId);
  if (!object || !object.operationId) return null;

  const connections = await filterAccessibleConnections(
    user,
    await listConnections(),
  );
  const operationsByConnection: Record<string, OperationListItem[]> = {};
  for (const entry of connections) {
    operationsByConnection[entry.id] = await filterCallableOperations(
      user,
      await listOperations(entry.id),
      entry.id,
    );
  }

  return {
    initial: {
      id: object.id,
      name: object.name,
      kind: object.kind as ObjectKind,
      config:
        object.kind === "table"
          ? normalizeTableConfig(object.config as unknown as TableConfig)
          : object.config,
      paramBindings: (object.paramBindings as ParamBindings) ?? {},
      operationId: object.operationId,
    },
    connections: connections.map((entry) => ({
      id: entry.id,
      name: entry.name,
      readOnly: entry.readOnly,
      type: entry.type,
    })),
    operationsByConnection,
  };
}

export async function saveObjectAction(
  input: SaveObjectInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await ensureSiteEditor();
    if (!input.name.trim()) {
      return { ok: false, error: "Give this object a name first." };
    }

    const object = await saveObject(input);

    revalidatePath("/objects");
    revalidatePath("/dashboards");
    revalidatePath("/sites");
    if (input.id) revalidatePath(`/objects/${input.id}`);

    return { ok: true, id: object.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save.",
    };
  }
}

export async function deleteObjectAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.dataObject.delete({ where: { id } });
    revalidatePath("/objects");
    revalidatePath("/dashboards");
    revalidatePath("/sites");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete.",
    };
  }
}

export async function duplicateObjectAction(
  id: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const source = await prisma.dataObject.findUnique({ where: { id } });
    if (!source) return { ok: false, error: "That object no longer exists." };

    const copy = await prisma.dataObject.create({
      data: {
        connectionId: source.connectionId,
        operationId: source.operationId,
        name: `${source.name} (copy)`,
        description: source.description,
        kind: source.kind,
        config: source.config ?? {},
        paramBindings: source.paramBindings ?? {},
      },
    });

    revalidatePath("/objects");
    return { ok: true, id: copy.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not duplicate.",
    };
  }
}

/** Creates a default object for each chosen endpoint in one go. */
export async function bulkCreateObjectsAction(
  operationIds: string[],
  kinds: ObjectKind[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const created = await createObjectsForOperations(operationIds, kinds);
    revalidatePath("/objects");
    return { ok: true, count: created.length };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      error: error instanceof Error ? error.message : "Could not create objects.",
    };
  }
}
