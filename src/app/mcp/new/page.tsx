import { requireSection } from "@/server/auth/permissions";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { NewMcpServerForm } from "@/components/mcp/NewMcpServerForm";

export const dynamic = "force-dynamic";

export default async function NewMcpPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  await requireSection("connections");
  const { connection } = await searchParams;

  return (
    <>
      <PageHeader
        title="New MCP server"
        description="A hosted tool pack your agents can call through Argent’s gateway."
        crumbs={[
          { label: "MCP", href: "/mcp" },
          { label: "New" },
        ]}
      />
      <PageBody>
        <NewMcpServerForm focusConnectionId={connection ?? null} />
      </PageBody>
    </>
  );
}
