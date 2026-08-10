"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth/acl";
import { canAccessConnection } from "@/server/auth/api-grants";
import {
  executeManualRequest,
  saveRequestAsOperation,
} from "@/server/gateway/manual";
import type { ExecuteResponseBody } from "@/lib/gateway/types";
import type { ManualRequest } from "@/lib/requests/types";
import type { Prisma } from "@prisma/client";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function sendManualRequestAction(
  request: ManualRequest,
): Promise<ExecuteResponseBody> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return {
        ok: false,
        status: null,
        durationMs: 0,
        contentType: null,
        error: {
          kind: "forbidden",
          message: "Sign in to send requests.",
        },
      };
    }

    if (request.connectionId) {
      const allowed = await canAccessConnection(user, request.connectionId);
      if (!allowed) {
        return {
          ok: false,
          status: null,
          durationMs: 0,
          contentType: null,
          error: {
            kind: "forbidden",
            message: "You do not have permission to use this connection.",
            detail:
              "Ask an admin to grant you this API under Users → API access.",
          },
        };
      }
    }

    return await executeManualRequest(request);
  } catch (error) {
    return {
      ok: false,
      status: null,
      durationMs: 0,
      contentType: null,
      error: {
        kind: "config",
        message: "seeIt could not send that request.",
        detail: describeError(error),
      },
    };
  }
}

export async function saveManualRequestAction(input: {
  id?: string;
  request: ManualRequest;
  lastStatus?: number | null;
  lastDurationMs?: number | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { request } = input;

    if (!request.name.trim()) {
      return { ok: false, error: "Give this request a name first." };
    }

    const data = {
      connectionId: request.connectionId,
      name: request.name.trim(),
      method: request.method,
      url: request.url,
      headers: request.headers as unknown as Prisma.InputJsonValue,
      queryParams: request.queryParams as unknown as Prisma.InputJsonValue,
      bodyMode: request.bodyMode,
      body: request.body || null,
      authMode: request.authMode,
      authConfig: request.authConfig as unknown as Prisma.InputJsonValue,
      lastStatus: input.lastStatus ?? null,
      lastDurationMs: input.lastDurationMs ?? null,
      lastRunAt: input.lastStatus !== undefined ? new Date() : null,
    };

    const saved = input.id
      ? await prisma.savedRequest.update({ where: { id: input.id }, data })
      : await prisma.savedRequest.create({ data });

    revalidatePath("/requests");
    return { ok: true, id: saved.id };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteSavedRequestAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.savedRequest.delete({ where: { id } });
    revalidatePath("/requests");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

/**
 * Promotes a hand-built request to a real endpoint, so objects can be built on
 * top of it exactly like an imported one.
 */
export async function saveAsOperationAction(input: {
  connectionId: string;
  request: ManualRequest;
  sampleResponse?: unknown;
}): Promise<{ ok: boolean; operationId?: string; error?: string }> {
  try {
    if (!input.request.name.trim()) {
      return {
        ok: false,
        error: "Name this request first — the name becomes the endpoint's title.",
      };
    }

    const operation = await saveRequestAsOperation({
      connectionId: input.connectionId,
      request: input.request,
      sampleResponse: input.sampleResponse,
    });

    revalidatePath(`/explorer/${input.connectionId}`);
    revalidatePath(`/docs/${input.connectionId}`);
    revalidatePath("/requests");

    return { ok: true, operationId: operation.id };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
