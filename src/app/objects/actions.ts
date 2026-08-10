"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import {
  buildBuilderContext,
  buildRowActionTarget,
  createObjectsForOperations,
  saveObject,
  type BuilderContext,
  type RowActionTarget,
  type SaveObjectInput,
} from "@/server/objects/service";
import type { ObjectKind } from "@/lib/objects/types";

export async function builderContextAction(
  operationId: string,
): Promise<BuilderContext | null> {
  return buildBuilderContext(operationId);
}

/** Loads the parameters and body fields of an endpoint a row action calls. */
export async function rowActionTargetAction(
  operationId: string,
): Promise<RowActionTarget | null> {
  return buildRowActionTarget(operationId);
}

export async function saveObjectAction(
  input: SaveObjectInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    if (!input.name.trim()) {
      return { ok: false, error: "Give this object a name first." };
    }

    const object = await saveObject(input);

    revalidatePath("/objects");
    revalidatePath("/dashboards");
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
