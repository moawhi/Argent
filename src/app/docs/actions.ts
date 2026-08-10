"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";

/**
 * Saves a human-written note that is layered on top of the generated docs.
 * Empty text removes the note rather than storing a blank page.
 */
export async function saveDocNoteAction(input: {
  connectionId: string;
  scope: "overview" | "tag" | "operation";
  targetKey: string;
  title?: string;
  bodyMarkdown: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = input.bodyMarkdown.trim();

    if (!body) {
      await prisma.docPage
        .delete({
          where: {
            connectionId_scope_targetKey: {
              connectionId: input.connectionId,
              scope: input.scope,
              targetKey: input.targetKey,
            },
          },
        })
        .catch(() => {
          // Nothing to remove.
        });
    } else {
      const data = { title: input.title ?? null, bodyMarkdown: body };
      await prisma.docPage.upsert({
        where: {
          connectionId_scope_targetKey: {
            connectionId: input.connectionId,
            scope: input.scope,
            targetKey: input.targetKey,
          },
        },
        create: {
          connectionId: input.connectionId,
          scope: input.scope,
          targetKey: input.targetKey,
          ...data,
        },
        update: data,
      });
    }

    revalidatePath(`/docs/${input.connectionId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save that note.",
    };
  }
}
