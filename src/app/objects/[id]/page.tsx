import { notFound } from "next/navigation";
import { getObject } from "@/server/objects/service";
import { listConnections } from "@/server/connections/service";
import { listOperations } from "@/server/operations/queries";
import {
  filterAccessibleConnections,
  filterCallableOperations,
} from "@/server/auth/api-grants";
import { PageHeader } from "@/components/layout/PageHeader";
import { ObjectBuilder } from "@/components/builder/ObjectBuilder";
import { normalizeTableConfig } from "@/lib/objects/row-actions";
import type { ObjectKind, TableConfig } from "@/lib/objects/types";
import type { ParamBindings } from "@/lib/gateway/types";
import type { OperationListItem } from "@/server/operations/queries";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function EditObjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSection("objects");
  const { id } = await params;
  const object = await getObject(id);
  if (!object || !object.operationId) notFound();

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
        title={object.name}
        description="Changes are previewed against real data and only saved when you press save."
        crumbs={[
          { label: "Objects", href: "/objects" },
          { label: object.name },
        ]}
      />

      <ObjectBuilder
        connections={connections.map((entry) => ({
          id: entry.id,
          name: entry.name,
          readOnly: entry.readOnly,
          type: entry.type,
        }))}
        operationsByConnection={operationsByConnection}
        initial={{
          id: object.id,
          name: object.name,
          kind: object.kind as ObjectKind,
          // Older tables predate row buttons having ids, which the editor
          // needs before it can tell one button from another.
          config:
            object.kind === "table"
              ? normalizeTableConfig(object.config as unknown as TableConfig)
              : object.config,
          paramBindings: (object.paramBindings as ParamBindings) ?? {},
          operationId: object.operationId,
        }}
      />
    </div>
  );
}
