import "server-only";

import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { APP_SECTIONS, type AppSection } from "@/lib/auth/sections";
import { isSystemRoleKey, slugifyRoleKey } from "@/lib/auth/roles";
import { ensureDefaultRoles } from "@/server/auth/roles";

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      role: true,
      sectionGrants: true,
    },
  });
}

export async function listRoles() {
  await ensureDefaultRoles();
  return prisma.role.findMany({
    orderBy: { label: "asc" },
    include: {
      sectionGrants: true,
      _count: { select: { users: true } },
    },
  });
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  roleId: string;
}) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      roleId: input.roleId,
      active: true,
      mustChangePassword: true,
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: null,
    },
  });
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    roleId?: string;
    active?: boolean;
    password?: string;
  },
) {
  const patch: {
    name?: string;
    roleId?: string;
    active?: boolean;
    passwordHash?: string;
    mustChangePassword?: boolean;
  } = {};

  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.roleId !== undefined) patch.roleId = data.roleId;
  if (data.active !== undefined) patch.active = data.active;
  if (data.password) {
    patch.passwordHash = await hashPassword(data.password);
    patch.mustChangePassword = true;
  }

  return prisma.user.update({ where: { id }, data: patch });
}

async function uniqueRoleKey(base: string): Promise<string> {
  let key = base;
  let n = 2;
  while (await prisma.role.findUnique({ where: { key } })) {
    key = `${base.slice(0, 36)}-${n}`;
    n += 1;
    if (n > 100) throw new Error("Could not allocate a unique role key.");
  }
  return key;
}

export async function createRole(input: {
  label: string;
  description?: string;
  sections: AppSection[];
}) {
  const label = input.label.trim();
  if (!label) throw new Error("Role name is required.");
  if (label.length > 60) throw new Error("Role name must be 60 characters or fewer.");

  const description = input.description?.trim() || null;
  const key = await uniqueRoleKey(slugifyRoleKey(label));

  return prisma.role.create({
    data: {
      key,
      label,
      description,
      sectionGrants: {
        create: input.sections.map((section) => ({ section })),
      },
    },
  });
}

export async function updateRole(
  roleId: string,
  data: {
    label?: string;
    description?: string | null;
    sections?: AppSection[];
  },
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });

  if (data.label !== undefined || data.description !== undefined) {
    if (role.key === "admin") {
      throw new Error("The Admin role cannot be renamed.");
    }
    const patch: { label?: string; description?: string | null } = {};
    if (data.label !== undefined) {
      const label = data.label.trim();
      if (!label) throw new Error("Role name is required.");
      if (label.length > 60) {
        throw new Error("Role name must be 60 characters or fewer.");
      }
      patch.label = label;
    }
    if (data.description !== undefined) {
      patch.description = data.description?.trim() || null;
    }
    await prisma.role.update({ where: { id: roleId }, data: patch });
  }

  if (data.sections !== undefined) {
    await setRoleSections(roleId, data.sections);
  }
}

export async function deleteRole(roleId: string) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });

  if (isSystemRoleKey(role.key)) {
    throw new Error("Built-in roles cannot be deleted.");
  }
  if (role._count.users > 0) {
    const n = role._count.users;
    throw new Error(
      `Reassign ${n} user${n === 1 ? "" : "s"} before deleting this role.`,
    );
  }

  await prisma.role.delete({ where: { id: roleId } });
}

export async function setRoleSections(roleId: string, sections: AppSection[]) {
  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });
  // Admin always keeps every section.
  const next =
    role.key === "admin" ? ([...APP_SECTIONS] as AppSection[]) : sections;

  await prisma.$transaction([
    prisma.sectionGrant.deleteMany({ where: { roleId } }),
    prisma.sectionGrant.createMany({
      data: next.map((section) => ({ roleId, section })),
    }),
  ]);
}

export async function setUserSectionOverrides(
  userId: string,
  sections: AppSection[],
) {
  await prisma.$transaction([
    prisma.sectionGrant.deleteMany({ where: { userId } }),
    prisma.sectionGrant.createMany({
      data: sections.map((section) => ({ userId, section })),
    }),
  ]);
}

export async function getDashboardAccess(dashboardId: string) {
  const [grants, roles, users] = await Promise.all([
    prisma.dashboardGrant.findMany({
      where: { dashboardId },
      include: { role: true, user: true },
    }),
    prisma.role.findMany({ orderBy: { label: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return { grants, roles, users };
}

export async function setDashboardAccess(
  dashboardId: string,
  input: { roleIds: string[]; userIds: string[] },
) {
  await prisma.$transaction([
    prisma.dashboardGrant.deleteMany({ where: { dashboardId } }),
    prisma.dashboardGrant.createMany({
      data: [
        ...input.roleIds.map((roleId) => ({ dashboardId, roleId })),
        ...input.userIds.map((userId) => ({ dashboardId, userId })),
      ],
    }),
  ]);
}
