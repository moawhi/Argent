import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { listObjects } from "@/server/objects/service";
import { listConnections } from "@/server/connections/service";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { ObjectLibrary } from "@/components/builder/ObjectLibrary";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function ObjectsPage() {
  await requireSection("objects");
  const [objects, connections] = await Promise.all([
    listObjects(),
    listConnections(),
  ]);

  return (
    <>
      <PageHeader
        title="Objects"
        description="Reusable pieces of your dashboards. Build one once, then drop it onto as many pages as you like."
        actions={
          connections.length > 0 ? (
            <Link href="/objects/new">
              <Button>
                <Plus /> New object
              </Button>
            </Link>
          ) : null
        }
      />

      <PageBody>
        {connections.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" />}
            title="Connect an API first"
            description="Objects read their data from an endpoint, so Argent needs to know about at least one API before you can build one."
            action={
              <Link href="/connections/new">
                <Button>
                  <Plus /> Import an API
                </Button>
              </Link>
            }
          />
        ) : objects.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" />}
            title="No objects yet"
            description="Pick an endpoint and Argent will suggest whether it works best as a table, a chart, a number card or a form."
            action={
              <Link href="/objects/new">
                <Button>
                  <Plus /> Build your first object
                </Button>
              </Link>
            }
          />
        ) : (
          <ObjectLibrary
            objects={objects.map((object) => ({
              id: object.id,
              name: object.name,
              kind: object.kind,
              connectionName: object.connection.name,
              connectionId: object.connectionId,
              method: object.operation?.method ?? null,
              path: object.operation?.path ?? null,
              summary: object.operation?.summary ?? null,
              widgetCount: object._count.widgets,
              updatedAt: object.updatedAt.toISOString(),
            }))}
          />
        )}
      </PageBody>
    </>
  );
}
