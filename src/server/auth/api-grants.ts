import "server-only";

import { prisma } from "@/server/db";
import { isAdmin, type SessionUser } from "@/server/auth/acl";
import { ensureDefaultRoles } from "@/server/auth/roles";
import {
  canSeeDemo,
  getDemoConnectionId,
  isDemoConnectionName,
} from "@/server/demo/access";
import type { Prisma } from "@prisma/client";

const PREVIEW_CHARS = 8_192;

/** Truncate JSON-ish values for RequestLog troubleshooting columns. */
export function truncateForLog(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  try {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value);
      return text.length <= PREVIEW_CHARS
        ? value
        : `${text.slice(0, PREVIEW_CHARS)}…[truncated]`;
    }
    const text = JSON.stringify(value);
    if (!text) return null;
    if (text.length <= PREVIEW_CHARS) {
      return JSON.parse(text) as Prisma.InputJsonValue;
    }
    return `${text.slice(0, PREVIEW_CHARS)}…[truncated]`;
  } catch {
    return String(value).slice(0, PREVIEW_CHARS);
  }
}

function subjectMatches(
  grant: { userId: string | null; roleId: string | null },
  user: SessionUser,
): boolean {
  return grant.userId === user.id || grant.roleId === user.role.id;
}

/**
 * Open-until-locked: no grants on the connection → anyone may call.
 * Once any grant exists for that connection (whole or per-op), only matching
 * subjects (and admins) may call.
 * The bundled demo is always callable when the user has not hidden it.
 */
export async function canCallOperation(
  user: SessionUser,
  connectionId: string,
  operationId: string,
): Promise<boolean> {
  if (isAdmin(user)) return true;

  const demoId = await getDemoConnectionId();
  if (demoId && connectionId === demoId) {
    return canSeeDemo(user);
  }

  const grants = await prisma.apiGrant.findMany({
    where: {
      OR: [
        { connectionId },
        { operation: { connectionId } },
      ],
    },
    select: {
      connectionId: true,
      operationId: true,
      userId: true,
      roleId: true,
    },
  });

  if (grants.length === 0) return true;

  return grants.some((grant) => {
    if (!subjectMatches(grant, user)) return false;
    // Whole-connection grant
    if (grant.connectionId === connectionId && !grant.operationId) return true;
    // Operation-specific grant
    if (grant.operationId === operationId) return true;
    return false;
  });
}

/** True if the connection is open, is the demo, or the user has any grant on it. */
export async function canAccessConnection(
  user: SessionUser,
  connectionId: string,
): Promise<boolean> {
  if (isAdmin(user)) return true;

  const demoId = await getDemoConnectionId();
  if (demoId && connectionId === demoId) {
    return canSeeDemo(user);
  }

  const grants = await prisma.apiGrant.findMany({
    where: {
      OR: [
        { connectionId },
        { operation: { connectionId } },
      ],
    },
    select: {
      connectionId: true,
      operationId: true,
      userId: true,
      roleId: true,
    },
  });

  if (grants.length === 0) return true;

  return grants.some((grant) => subjectMatches(grant, user));
}

export async function filterAccessibleConnections<
  T extends { id: string; name?: string },
>(user: SessionUser, connections: T[]): Promise<T[]> {
  if (connections.length === 0) return connections;

  const showDemo = canSeeDemo(user);
  const withoutHiddenDemo = connections.filter((c) => {
    if (!isDemoConnectionName(c.name)) return true;
    return showDemo;
  });

  if (isAdmin(user) || withoutHiddenDemo.length === 0) {
    return withoutHiddenDemo;
  }

  const demoId = await getDemoConnectionId();
  const ids = withoutHiddenDemo.map((c) => c.id);
  const grants = await prisma.apiGrant.findMany({
    where: {
      OR: [
        { connectionId: { in: ids } },
        { operation: { connectionId: { in: ids } } },
      ],
    },
    select: {
      connectionId: true,
      operationId: true,
      userId: true,
      roleId: true,
      operation: { select: { connectionId: true } },
    },
  });

  const locked = new Set<string>();
  const allowed = new Set<string>();

  for (const grant of grants) {
    const cid = grant.connectionId ?? grant.operation?.connectionId;
    if (!cid) continue;
    locked.add(cid);
    if (subjectMatches(grant, user)) allowed.add(cid);
  }

  return withoutHiddenDemo.filter((c) => {
    // Demo stays visible regardless of other grants on it.
    if (demoId && c.id === demoId) return true;
    return !locked.has(c.id) || allowed.has(c.id);
  });
}

export async function filterCallableOperations<T extends { id: string }>(
  user: SessionUser,
  operations: T[],
  /** Required when operations omit `connectionId` (e.g. explorer list items). */
  connectionId: string,
): Promise<T[]> {
  if (isAdmin(user) || operations.length === 0) return operations;

  const grants = await prisma.apiGrant.findMany({
    where: {
      OR: [
        { connectionId },
        { operationId: { in: operations.map((op) => op.id) } },
        { operation: { connectionId } },
      ],
    },
    select: {
      connectionId: true,
      operationId: true,
      userId: true,
      roleId: true,
    },
  });

  if (grants.length === 0) return operations;

  const wholeConnectionAllow = grants.some(
    (grant) =>
      subjectMatches(grant, user) &&
      grant.connectionId === connectionId &&
      !grant.operationId,
  );
  if (wholeConnectionAllow) return operations;

  const operationAllow = new Set(
    grants
      .filter((grant) => subjectMatches(grant, user) && grant.operationId)
      .map((grant) => grant.operationId as string),
  );

  return operations.filter((op) => operationAllow.has(op.id));
}

export type ApiGrantSubject =
  | { kind: "role"; roleId: string }
  | { kind: "user"; userId: string };

/**
 * After a connection is imported, lock it to the importer and the admin role.
 * Open-until-locked: writing these grants means other users need explicit access.
 */
export async function grantImporterAndAdminAccess(
  connectionId: string,
  importerUserId: string,
): Promise<void> {
  await ensureDefaultRoles();

  const adminRole = await prisma.role.findUnique({
    where: { key: "admin" },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.apiGrant.create({
      data: {
        connectionId,
        userId: importerUserId,
      },
    });

    if (adminRole) {
      await tx.apiGrant.create({
        data: {
          connectionId,
          roleId: adminRole.id,
        },
      });
    }
  });
}

/** Grants for one subject, grouped for the admin UI. */
export async function listApiGrantsForSubject(subject: ApiGrantSubject) {
  const where =
    subject.kind === "role"
      ? { roleId: subject.roleId }
      : { userId: subject.userId };

  return prisma.apiGrant.findMany({
    where,
    select: {
      id: true,
      connectionId: true,
      operationId: true,
    },
  });
}

/**
 * Replace one subject's grants for a single connection.
 * `entireConnection` writes a whole-connection grant; `operationIds` are
 * per-operation grants (ignored when entireConnection is true).
 */
export async function setSubjectConnectionGrants(
  subject: ApiGrantSubject,
  connectionId: string,
  input: { entireConnection: boolean; operationIds: string[] },
) {
  const subjectWhere =
    subject.kind === "role"
      ? { roleId: subject.roleId }
      : { userId: subject.userId };

  const operationIds = await prisma.operation.findMany({
    where: { connectionId },
    select: { id: true },
  });
  const opIdList = operationIds.map((op) => op.id);

  await prisma.$transaction(async (tx) => {
    await tx.apiGrant.deleteMany({
      where: {
        ...subjectWhere,
        OR: [
          { connectionId },
          { operationId: { in: opIdList } },
        ],
      },
    });

    if (input.entireConnection) {
      await tx.apiGrant.create({
        data: {
          connectionId,
          operationId: null,
          ...subjectWhere,
        },
      });
      return;
    }

    const uniqueOps = [...new Set(input.operationIds)].filter((id) =>
      opIdList.includes(id),
    );
    if (uniqueOps.length === 0) return;

    await tx.apiGrant.createMany({
      data: uniqueOps.map((operationId) => ({
        connectionId: null,
        operationId,
        ...subjectWhere,
      })),
    });
  });
}

export async function listConnectionsWithOperations() {
  return prisma.connection.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      operations: {
        orderBy: [{ sortOrder: "asc" }, { path: "asc" }],
        select: {
          id: true,
          method: true,
          path: true,
          summary: true,
          operationKey: true,
          tags: true,
        },
      },
    },
  });
}

export async function listRequestActivity(filters: {
  userId?: string;
  connectionId?: string;
  ok?: boolean;
  take?: number;
  skip?: number;
}) {
  const take = Math.min(filters.take ?? 50, 100);
  const skip = filters.skip ?? 0;

  const where: Prisma.RequestLogWhereInput = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.connectionId) where.connectionId = filters.connectionId;
  if (filters.ok !== undefined) where.ok = filters.ok;

  const [total, logs] = await Promise.all([
    prisma.requestLog.count({ where }),
    prisma.requestLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, email: true } },
        connection: { select: { id: true, name: true } },
        operation: {
          select: {
            id: true,
            method: true,
            path: true,
            summary: true,
            operationKey: true,
          },
        },
      },
    }),
  ]);

  return { total, logs, take, skip };
}

export async function getRequestLogDetail(id: string) {
  return prisma.requestLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      connection: { select: { id: true, name: true } },
      operation: {
        select: {
          id: true,
          method: true,
          path: true,
          summary: true,
          operationKey: true,
        },
      },
    },
  });
}

/** Persist a denied call attempt for the Activity tab. */
export async function logDeniedApiCall(input: {
  userId: string;
  connectionId: string;
  operationId: string;
  method: string;
  path: string;
  origin?: string;
  params?: Record<string, unknown>;
}) {
  await prisma.requestLog
    .create({
      data: {
        userId: input.userId,
        connectionId: input.connectionId,
        operationId: input.operationId,
        method: input.method,
        url: input.path,
        status: null,
        ok: false,
        durationMs: 0,
        error: "Forbidden — no API access grant for this endpoint.",
        origin: input.origin ?? "gateway",
        requestParams: truncateForLog(input.params ?? null) ?? undefined,
      },
    })
    .catch(() => {});
}
