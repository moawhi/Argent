import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { ImportWizard } from "@/components/connections/ImportWizard";
import { requireSection } from "@/server/auth/permissions";

export const metadata = { title: "Connect an API — Argent" };

export default async function NewApiConnectionPage() {
  await requireSection("connections");
  return (
    <>
      <PageHeader
        title="Connect an API"
        description="Point Argent at an API description file and it will do the rest."
        crumbs={[
          { label: "Connections", href: "/connections" },
          { label: "Add", href: "/connections/new" },
          { label: "API" },
        ]}
      />
      <PageBody className="max-w-3xl">
        <ImportWizard />
      </PageBody>
    </>
  );
}
