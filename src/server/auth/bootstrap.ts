import "server-only";

import { prisma } from "@/server/db";
import { ensureDefaultRoles } from "@/server/auth/roles";
import { hashPassword } from "@/server/auth/password";

export async function userCount(): Promise<number> {
  return prisma.user.count();
}

export async function needsBootstrap(): Promise<boolean> {
  await ensureDefaultRoles();
  return (await userCount()) === 0;
}

export async function createFirstAdmin(input: {
  name: string;
  email: string;
  password: string;
}) {
  await ensureDefaultRoles();
  const count = await userCount();
  if (count > 0) {
    throw new Error("An admin already exists. Sign in instead.");
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { key: "admin" },
  });

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      roleId: adminRole.id,
      active: true,
      theme: "light",
      emailVerifiedAt: new Date(),
    },
  });
}
