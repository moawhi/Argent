import "server-only";

import { prisma } from "@/server/db";
import { APP_SECTIONS, type AppSection } from "@/lib/auth/sections";

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
    description: "View shared dashboards and help docs.",
    sections: ["dashboards", "docs"],
  },
];

/** Idempotent seed of built-in roles and their default section grants. */
export async function ensureDefaultRoles() {
  for (const def of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        label: def.label,
        description: def.description,
      },
      update: {
        label: def.label,
        description: def.description,
      },
    });

    const existing = await prisma.sectionGrant.findMany({
      where: { roleId: role.id },
    });
    const have = new Set(existing.map((g) => g.section));
    for (const section of def.sections) {
      if (have.has(section)) continue;
      await prisma.sectionGrant.create({
        data: { roleId: role.id, section },
      });
    }
  }
}
