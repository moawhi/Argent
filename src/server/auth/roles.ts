import "server-only";

import { prisma } from "@/server/db";
import { APP_SECTIONS, type AppSection } from "@/lib/auth/sections";

export { isSystemRoleKey, SYSTEM_ROLE_KEYS } from "@/lib/auth/roles";

const DEFAULT_ROLES: {
  key: string;
  label: string;
  description: string;
  sections: AppSection[];
}[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Full access, including user and role management.",
    sections: [...APP_SECTIONS],
  },
  {
    key: "dev",
    label: "Dev",
    description: "Build connections, objects, and dashboards.",
    sections: APP_SECTIONS.filter((s) => s !== "users"),
  },
  {
    key: "sales",
    label: "Sales",
    description: "View dashboards, objects, and docs.",
    sections: ["dashboards", "objects", "docs"],
  },
  {
    key: "client",
    label: "Client",
    description: "View published sites and help docs.",
    sections: ["dashboards", "docs"],
  },
];

/** Idempotent seed of built-in roles. Does not overwrite custom labels or section picks. */
export async function ensureDefaultRoles() {
  for (const def of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        label: def.label,
        description: def.description,
      },
      update: {},
    });

    const existing = await prisma.sectionGrant.count({
      where: { roleId: role.id },
    });
    if (existing > 0) continue;

    await prisma.sectionGrant.createMany({
      data: def.sections.map((section) => ({ roleId: role.id, section })),
    });
  }
}
