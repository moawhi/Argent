import Link from "next/link";
import { Database, FileCode2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/primitives";
import { requireSection } from "@/server/auth/permissions";

export const metadata = { title: "Add a connection — Argent" };

export default async function NewConnectionChooserPage() {
  await requireSection("connections");
  return (
    <>
      <PageHeader
        title="Add a connection"
        description="Connect an HTTP API from an OpenAPI file, or a SQL database you can query."
        crumbs={[
          { label: "Connections", href: "/connections" },
          { label: "Add" },
        ]}
      />
      <PageBody className="max-w-3xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/connections/new/api" className="group">
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <FileCode2 className="size-5" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-ink group-hover:text-brand">
                Connect an API
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Import an OpenAPI or Swagger file. Argent lists every endpoint and
                turns them into tables, charts and forms.
              </p>
            </Card>
          </Link>

          <Link href="/connections/new/database" className="group">
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Database className="size-5" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-ink group-hover:text-brand">
                Connect a database
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                PostgreSQL, MariaDB or ClickHouse. Browse schemas, write SQL with
                parameters, and build objects from the results.
              </p>
            </Card>
          </Link>
        </div>
      </PageBody>
    </>
  );
}
