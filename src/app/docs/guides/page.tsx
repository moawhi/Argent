import Link from "next/link";
import { BookOpen, Cable, FileJson, Plug } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/primitives";
import { GUIDES } from "@/lib/docs/guides";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

const ICONS = {
  api: Plug,
  openapi: FileJson,
  mcp: Cable,
  setup: BookOpen,
} as const;

export default async function GuidesIndexPage() {
  await requireSection("docs");

  return (
    <>
      <PageHeader
        title="Guides"
        description="What APIs, OpenAPI, and MCP are — and how to wire them in Argent."
        crumbs={[
          { label: "Help & Docs", href: "/docs" },
          { label: "Guides" },
        ]}
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2">
          {GUIDES.map((guide) => {
            const Icon = ICONS[guide.slug];
            return (
              <Link key={guide.slug} href={`/docs/guides/${guide.slug}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-md">
                  <Icon className="mb-3 size-4 text-brand" />
                  <p className="font-[family-name:var(--font-landing-display)] text-lg font-medium tracking-tight">
                    {guide.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {guide.summary}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
