import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { DatabaseWizard } from "@/components/connections/DatabaseWizard";
import { requireSection } from "@/server/auth/permissions";

export const metadata = { title: "Connect a database — Argent" };

export default async function NewDatabaseConnectionPage() {
  await requireSection("connections");
  return (
    <>
      <PageHeader
        title="Connect a database"
        description="PostgreSQL, MariaDB or ClickHouse. Schemas are mapped after a successful test."
        crumbs={[
          { label: "Connections", href: "/connections" },
          { label: "Add", href: "/connections/new" },
          { label: "Database" },
        ]}
      />
      <PageBody className="max-w-3xl">
        <DatabaseWizard />
      </PageBody>
    </>
  );
}
