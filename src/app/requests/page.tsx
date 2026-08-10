import Link from "next/link";
import { Plus, Send } from "lucide-react";
import { prisma } from "@/server/db";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { SavedRequestList } from "@/components/requests/SavedRequestList";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  await requireSection("requests");
  const requests = await prisma.savedRequest.findMany({
    orderBy: { updatedAt: "desc" },
    include: { connection: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Request builder"
        description="For endpoints your API description file does not cover. Build a request by hand, test it, then turn it into something you can chart."
        actions={
          <Link href="/requests/new">
            <Button>
              <Plus /> New request
            </Button>
          </Link>
        }
      />

      <PageBody>
        {requests.length === 0 ? (
          <EmptyState
            icon={<Send className="size-5" />}
            title="No saved requests"
            description="Build a request the way you would in Postman — method, address, params, headers and body — send it, and see the result. Save the ones you want to keep."
            action={
              <Link href="/requests/new">
                <Button>
                  <Plus /> Build a request
                </Button>
              </Link>
            }
          />
        ) : (
          <SavedRequestList
            requests={requests.map((request) => ({
              id: request.id,
              name: request.name,
              method: request.method,
              url: request.url,
              connectionName: request.connection?.name ?? null,
              lastStatus: request.lastStatus,
              lastDurationMs: request.lastDurationMs,
              lastRunAt: request.lastRunAt?.toISOString() ?? null,
              updatedAt: request.updatedAt.toISOString(),
            }))}
          />
        )}
      </PageBody>
    </>
  );
}
