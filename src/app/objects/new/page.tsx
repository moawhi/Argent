import { listConnections } from "@/server/connections/service";
import { listOperations } from "@/server/operations/queries";
import {
  filterAccessibleConnections,
  filterCallableOperations,
} from "@/server/auth/api-grants";
import { PageHeader } from "@/components/layout/PageHeader";
import { ObjectBuilder } from "@/components/builder/ObjectBuilder";
import type { OperationListItem } from "@/server/operations/queries";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function NewObjectPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; operation?: string }>;
}) {
  const user = await requireSection("objects");
  const { connection, operation } = await searchParams;
  const connections = await filterAccessibleConnections(
    user,
    await listConnections(),
  );

  const operationsByConnection: Record<string, OperationListItem[]> = {};
  for (const entry of connections) {
    operationsByConnection[entry.id] = await filterCallableOperations(
      user,
      await listOperations(entry.id),
      entry.id,
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="New object"
        description="Choose an endpoint, pick how it should look, then save it for your dashboards."
        crumbs={[{ label: "Objects", href: "/objects" }, { label: "New" }]}
      />

      <ObjectBuilder
        connections={connections.map((entry) => ({
          id: entry.id,
          name: entry.name,
          readOnly: entry.readOnly,
          type: entry.type,
        }))}
        operationsByConnection={operationsByConnection}
        initialConnectionId={connection}
        initialOperationId={operation}
      />
    </div>
  );
}
