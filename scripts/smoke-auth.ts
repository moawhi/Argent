/**
 * Smoke test for login, roles, section ACL, and dashboard grants.
 * Usage: npx tsx --conditions react-server scripts/smoke-auth.ts
 */
import { prisma } from "../src/server/db";
import { ensureDefaultRoles } from "../src/server/auth/roles";
import { hashPassword, verifyPassword } from "../src/server/auth/password";
import {
  createSessionToken,
  verifySessionToken,
} from "../src/server/auth/session";
import {
  canAccessSection,
  canEditSites,
  canViewDashboard,
  type SessionUser,
} from "../src/server/auth/acl";
import { createRole, deleteRole, setDashboardAccess } from "../src/server/auth/users";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function main() {
  await ensureDefaultRoles();

  const roles = await prisma.role.findMany();
  const byKey = Object.fromEntries(roles.map((r) => [r.key, r]));
  assert(byKey.admin && byKey.dev && byKey.sales && byKey.client, "roles");

  const stamp = Date.now();
  const password = "smoke-test-password";
  const passwordHash = await hashPassword(password);
  assert(await verifyPassword(password, passwordHash), "password verify");

  const admin = await prisma.user.create({
    data: {
      email: `smoke-admin-${stamp}@example.com`,
      name: "Smoke Admin",
      passwordHash,
      roleId: byKey.admin.id,
      emailVerifiedAt: new Date(),
    },
  });
  const client = await prisma.user.create({
    data: {
      email: `smoke-client-${stamp}@example.com`,
      name: "Smoke Client",
      passwordHash,
      roleId: byKey.client.id,
      emailVerifiedAt: new Date(),
    },
  });

  const token = await createSessionToken(admin.id);
  const payload = await verifySessionToken(token);
  assert(payload?.userId === admin.id, "session token");

  const adminUser = await loadSession(admin.id);
  const clientUser = await loadSession(client.id);
  assert(adminUser && clientUser, "load users");

  assert(canAccessSection(adminUser, "users"), "admin users");
  assert(canAccessSection(adminUser, "connections"), "admin connections");
  assert(!canAccessSection(clientUser, "users"), "client no users");
  assert(!canAccessSection(clientUser, "connections"), "client no connections");
  assert(canAccessSection(clientUser, "dashboards"), "client dashboards");
  assert(canAccessSection(clientUser, "docs"), "client docs");
  assert(!canEditSites(clientUser), "client cannot edit sites");
  assert(canEditSites(adminUser), "admin can edit sites");

  const dashboard = await prisma.dashboard.create({
    data: {
      name: `Smoke ${stamp}`,
      slug: `smoke-${stamp}`,
    },
  });

  assert(
    !(await canViewDashboard(clientUser, dashboard.id)),
    "client no unpublished site",
  );

  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: { published: true },
  });

  assert(
    await canViewDashboard(clientUser, dashboard.id),
    "client sees published open site",
  );

  await setDashboardAccess(dashboard.id, {
    roleIds: [byKey.admin.id],
    userIds: [],
  });

  assert(
    await canViewDashboard(adminUser, dashboard.id),
    "admin still sees restricted",
  );
  assert(
    !(await canViewDashboard(clientUser, dashboard.id)),
    "client blocked after grants",
  );

  await setDashboardAccess(dashboard.id, {
    roleIds: [],
    userIds: [client.id],
  });
  assert(
    await canViewDashboard(clientUser, dashboard.id),
    "client allowed by user grant",
  );

  const custom = await createRole({
    label: `Finance ${stamp}`,
    description: "Custom group",
    sections: ["dashboards", "objects"],
  });
  assert(custom.key.startsWith("finance"), "custom role key");
  const financeUser = await prisma.user.create({
    data: {
      email: `smoke-finance-${stamp}@example.com`,
      name: "Smoke Finance",
      passwordHash,
      roleId: custom.id,
      emailVerifiedAt: new Date(),
    },
  });
  const financeSession = await loadSession(financeUser.id);
  assert(canAccessSection(financeSession, "dashboards"), "custom dashboards");
  assert(canAccessSection(financeSession, "objects"), "custom objects");
  assert(!canAccessSection(financeSession, "connections"), "custom no connections");
  assert(!canAccessSection(financeSession, "users"), "custom no users");
  assert(canEditSites(financeSession), "objects role can edit sites");

  let deleteBlocked = false;
  try {
    await deleteRole(custom.id);
  } catch {
    deleteBlocked = true;
  }
  assert(deleteBlocked, "cannot delete role with users");

  await prisma.user.delete({ where: { id: financeUser.id } });
  await deleteRole(custom.id);
  assert(
    (await prisma.role.findUnique({ where: { id: custom.id } })) === null,
    "custom role deleted",
  );

  // Cleanup
  await prisma.dashboardGrant.deleteMany({ where: { dashboardId: dashboard.id } });
  await prisma.dashboard.delete({ where: { id: dashboard.id } });
  await prisma.user.deleteMany({
    where: { id: { in: [admin.id, client.id] } },
  });

  console.log("smoke-auth: ok");
}

async function loadSession(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      role: { include: { sectionGrants: true } },
      sectionGrants: true,
    },
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    theme: "light",
    mustChangePassword: user.mustChangePassword,
    onboardingCompletedAt: user.onboardingCompletedAt,
    hideDemo: user.hideDemo,
    role: {
      id: user.role.id,
      key: user.role.key,
      label: user.role.label,
    },
    roleSections: user.role.sectionGrants.map((g) => g.section),
    sectionOverrides: user.sectionGrants.map((g) => g.section),
  };
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
