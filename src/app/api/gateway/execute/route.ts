import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/auth/acl";
import {
  canCallOperation,
  logDeniedApiCall,
} from "@/server/auth/api-grants";
import { executeOperation } from "@/server/gateway/executor";
import type {
  ExecuteRequestBody,
  ExecuteResponseBody,
} from "@/lib/gateway/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(message: string): ExecuteResponseBody {
  return {
    ok: false,
    status: null,
    durationMs: 0,
    contentType: null,
    error: {
      kind: "forbidden",
      message,
      detail:
        "Ask an admin to grant you this API under Users → API access.",
    },
  };
}

/**
 * The single door between the browser and every upstream API.
 *
 * Clients name an object or operation and supply filter values; they never see
 * a base URL, a header or a credential. Errors are always returned with HTTP
 * 200 and `ok: false` so the UI can render a friendly message rather than
 * treating the gateway itself as broken.
 */
export async function POST(request: Request) {
  let body: ExecuteRequestBody;

  try {
    body = (await request.json()) as ExecuteRequestBody;
  } catch {
    return NextResponse.json<ExecuteResponseBody>({
      ok: false,
      status: null,
      durationMs: 0,
      contentType: null,
      error: {
        kind: "config",
        message: "The request could not be read.",
      },
    });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json<ExecuteResponseBody>(
      forbidden("Sign in to call connected APIs."),
    );
  }

  try {
    let operationId = body.operationId ?? null;
    if (body.objectId && !operationId) {
      const object = await prisma.dataObject.findUnique({
        where: { id: body.objectId },
        select: { operationId: true },
      });
      operationId = object?.operationId ?? null;
    }

    if (operationId) {
      const operation = await prisma.operation.findUnique({
        where: { id: operationId },
        select: {
          id: true,
          connectionId: true,
          method: true,
          path: true,
        },
      });

      if (operation) {
        const allowed = await canCallOperation(
          user,
          operation.connectionId,
          operation.id,
        );
        if (!allowed) {
          await logDeniedApiCall({
            userId: user.id,
            connectionId: operation.connectionId,
            operationId: operation.id,
            method: operation.method,
            path: operation.path,
            origin: body.origin,
            params: body.params,
          });
          return NextResponse.json<ExecuteResponseBody>(
            forbidden(
              "You do not have permission to call this API endpoint.",
            ),
          );
        }
      }
    }

    const result = await executeOperation({
      objectId: body.objectId,
      operationId: body.operationId,
      params: body.params,
      body: body.body,
      filters: body.filters,
      pagination: body.pagination,
      origin: body.origin,
      confirmWrite: body.confirmWrite,
      noCache: body.noCache,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json<ExecuteResponseBody>({
      ok: false,
      status: null,
      durationMs: 0,
      contentType: null,
      error: {
        kind: "config",
        message: "Something went wrong inside seeIt while sending that request.",
        detail: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
