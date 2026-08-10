import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Settings2 } from "lucide-react";
import { getConnection } from "@/server/connections/service";
import { listOperations } from "@/server/operations/queries";
import {
  canAccessConnection,
  filterCallableOperations,
} from "@/server/auth/api-grants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ExplorerShell } from "@/components/explorer/ExplorerShell";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function ExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ connectionId: string }>;
  searchParams: Promise<{ op?: string }>;
}) {
  const user = await requireSection("explorer");
  const { connectionId } = await params;
  const { op } = await searchParams;

  const connection = await getConnection(connectionId);
  if (!connection) notFound();
  if (!(await canAccessConnection(user, connectionId))) notFound();

  const operations = await filterCallableOperations(
    user,
    await listOperations(connectionId),
    connectionId,
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={connection.name}
        description={`${operations.length} endpoints. Anything marked read-only is safe to try.`}
        crumbs={[
          { label: "API Explorer", href: "/explorer" },
          { label: connection.name },
        ]}
        actions={
          <>
            <Link href={`/docs/${connectionId}`}>
              <Button variant="ghost">
                <BookOpen /> Docs
              </Button>
            </Link>
            <Link href={`/connections/${connectionId}`}>
              <Button variant="secondary">
                <Settings2 /> Settings
              </Button>
            </Link>
          </>
        }
      />

      <ExplorerShell
        connectionId={connectionId}
        connectionName={connection.name}
        baseUrl={connection.baseUrl}
        readOnly={connection.readOnly}
        operations={operations}
        initialOperationKey={op}
      />
    </div>
  );
}
