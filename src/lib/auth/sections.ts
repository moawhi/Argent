export const APP_SECTIONS = [
  "dashboards",
  "objects",
  "explorer",
  "requests",
  "connections",
  "docs",
  "users",
] as const;

export type AppSection = (typeof APP_SECTIONS)[number];

export const SECTION_META: Record<
  AppSection,
  { label: string; href: string; hint: string }
> = {
  dashboards: {
    label: "Dashboards",
    href: "/dashboards",
    hint: "Your pages of charts and tables",
  },
  objects: {
    label: "Objects",
    href: "/objects",
    hint: "Tables, charts, cards and forms",
  },
  explorer: {
    label: "API Explorer",
    href: "/explorer",
    hint: "Browse and test every endpoint",
  },
  requests: {
    label: "Request Builder",
    href: "/requests",
    hint: "Add an endpoint by hand",
  },
  connections: {
    label: "Connections",
    href: "/connections",
    hint: "Imported API specs and keys",
  },
  docs: {
    label: "Help & Docs",
    href: "/docs",
    hint: "Guides from APIs and database catalogs",
  },
  users: {
    label: "Users",
    href: "/users",
    hint: "People, roles, API access, and activity",
  },
};

export function isAppSection(value: string): value is AppSection {
  return (APP_SECTIONS as readonly string[]).includes(value);
}

/** Path prefix → section for middleware and page gates. */
export function sectionForPath(pathname: string): AppSection | null {
  if (pathname === "/" || pathname.startsWith("/settings")) return null;
  if (pathname.startsWith("/dashboards")) return "dashboards";
  if (pathname.startsWith("/objects")) return "objects";
  if (pathname.startsWith("/explorer")) return "explorer";
  if (pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/connections")) return "connections";
  if (pathname.startsWith("/docs")) return "docs";
  if (pathname.startsWith("/users")) return "users";
  return null;
}
