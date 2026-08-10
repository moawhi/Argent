import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { buildCurl, buildOperationDoc } from "@/lib/docs/generate";
import { credentialNamesFor } from "@/server/operations/queries";

export const runtime = "nodejs";

/** Full detail for one operation, used by the explorer and the object builder. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const operation = await prisma.operation.findUnique({
    where: { id },
    include: {
      connection: {
        select: { id: true, name: true, baseUrl: true, readOnly: true },
      },
    },
  });

  if (!operation) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const credentialNames = await credentialNamesFor(operation.connectionId);
  const doc = buildOperationDoc(operation, { credentialNames });

  const recent = await prisma.requestLog.findMany({
    where: { operationId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      ok: true,
      durationMs: true,
      createdAt: true,
      error: true,
    },
  });

  return NextResponse.json({
    doc,
    curl: buildCurl(doc, operation.connection.baseUrl),
    connection: operation.connection,
    recent,
  });
}
