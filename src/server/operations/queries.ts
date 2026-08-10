import "server-only";

import { prisma } from "@/server/db";
import type { ParameterDescriptor } from "@/lib/openapi/types";

export interface OperationListItem {
  id: string;
  operationKey: string;
  method: string;
  path: string;
  summary: string | null;
  tags: string[];
  source: string;
  deprecated: boolean;
  /** How many required values a user must supply, excluding credentials. */
  requiredInputs: number;
  hasBody: boolean;
  calls: number;
  failures: number;
  lastCalledAt: string | null;
}

/**
 * Endpoint list for the explorer, joined with usage counts so each row can show
 * whether it has been working.
 */
export async function listOperations(
  connectionId: string,
): Promise<OperationListItem[]> {
  const [operations, connection, stats] = await Promise.all([
    prisma.operation.findMany({
      where: { connectionId },
      orderBy: [{ sortOrder: "asc" }],
    }),
    prisma.connection.findUnique({
      where: { id: connectionId },
      include: { authProfile: { select: { injection: true } } },
    }),
    prisma.requestLog.groupBy({
      by: ["operationId", "ok"],
      where: { connectionId },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  const credentialNames = new Set(
    ((connection?.authProfile?.injection as { in: string; name: string }[]) ??
      []).map((rule) => `${rule.in}:${rule.name}`),
  );

  const usage = new Map<
    string,
    { calls: number; failures: number; lastCalledAt: Date | null }
  >();

  for (const row of stats) {
    if (!row.operationId) continue;
    const entry = usage.get(row.operationId) ?? {
      calls: 0,
      failures: 0,
      lastCalledAt: null,
    };
    entry.calls += row._count._all;
    if (!row.ok) entry.failures += row._count._all;
    const seen = row._max.createdAt;
    if (seen && (!entry.lastCalledAt || seen > entry.lastCalledAt)) {
      entry.lastCalledAt = seen;
    }
    usage.set(row.operationId, entry);
  }

  return operations.map((operation) => {
    const params = (operation.params as unknown as ParameterDescriptor[]) ?? [];
    const requiredInputs = params.filter(
      (param) =>
        param.required &&
        param.default === undefined &&
        !credentialNames.has(`${param.in}:${param.name}`) &&
        !param.looksLikeCredential,
    ).length;

    const entry = usage.get(operation.id);

    return {
      id: operation.id,
      operationKey: operation.operationKey,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
      tags: operation.tags,
      source: operation.source,
      deprecated: operation.deprecated,
      requiredInputs,
      hasBody: operation.requestSchema !== null,
      calls: entry?.calls ?? 0,
      failures: entry?.failures ?? 0,
      lastCalledAt: entry?.lastCalledAt?.toISOString() ?? null,
    };
  });
}

export async function getOperationWithConnection(operationId: string) {
  return prisma.operation.findUnique({
    where: { id: operationId },
    include: {
      connection: {
        include: { authProfile: { select: { injection: true, kind: true } } },
      },
    },
  });
}

export async function credentialNamesFor(
  connectionId: string,
): Promise<Set<string>> {
  const profile = await prisma.authProfile.findUnique({
    where: { connectionId },
    select: { injection: true },
  });

  return new Set(
    ((profile?.injection as { in: string; name: string }[]) ?? []).map(
      (rule) => `${rule.in}:${rule.name}`,
    ),
  );
}
