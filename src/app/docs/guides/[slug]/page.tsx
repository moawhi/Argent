import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { getGuide, GUIDES } from "@/lib/docs/guides";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSection("docs");
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const index = GUIDES.findIndex((item) => item.slug === guide.slug);
  const previous = index > 0 ? GUIDES[index - 1] : null;
  const next = index < GUIDES.length - 1 ? GUIDES[index + 1] : null;

  return (
    <>
      <PageHeader
        title={guide.title}
        description={guide.summary}
        crumbs={[
          { label: "Help & Docs", href: "/docs" },
          { label: "Guides", href: "/docs/guides" },
          { label: guide.title },
        ]}
      />
      <PageBody className="max-w-3xl space-y-8">
        {guide.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="font-[family-name:var(--font-landing-display)] text-xl font-medium tracking-tight">
              {section.heading}
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-ink-soft [&_code]:rounded-md [&_code]:bg-canvas [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-ink [&_strong]:font-semibold [&_strong]:text-ink">
              {section.body}
            </div>
          </section>
        ))}

        <nav className="flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-sm">
          {previous ? (
            <Link
              href={`/docs/guides/${previous.slug}`}
              className="text-brand hover:underline"
            >
              ← {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/docs/guides/${next.slug}`}
              className="text-brand hover:underline"
            >
              {next.title} →
            </Link>
          ) : (
            <Link href="/docs/guides" className="text-brand hover:underline">
              All guides
            </Link>
          )}
        </nav>
      </PageBody>
    </>
  );
}
