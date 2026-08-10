import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequestBuilder } from "@/components/requests/RequestBuilder";
import type {
  AuthConfig,
  AuthMode,
  BodyMode,
  KeyValueEntry,
} from "@/lib/requests/types";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function SavedRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSection("requests");
  const { id } = await params;

  const [saved, connections] = await Promise.all([
    prisma.savedRequest.findUnique({ where: { id } }),
    prisma.connection.findMany({
      orderBy: { createdAt: "asc" },
      include: { authProfile: { select: { secretKeys: true } } },
    }),
  ]);

  if (!saved) notFound();

  const options = connections.map((entry) => ({
    id: entry.id,
    name: entry.name,
    baseUrl: entry.baseUrl,
    readOnly: entry.readOnly,
    secretKeys: entry.authProfile?.secretKeys ?? [],
    variableKeys: Object.keys(
      (entry.variables as Record<string, unknown>) ?? {},
    ),
  }));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={saved.name}
        description="Change anything and send it again."
        crumbs={[
          { label: "Request Builder", href: "/requests" },
          { label: saved.name },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        <RequestBuilder
          connections={options}
          savedRequestId={saved.id}
          initial={{
            name: saved.name,
            connectionId: saved.connectionId,
            method: saved.method,
            url: saved.url,
            queryParams: (saved.queryParams as unknown as KeyValueEntry[]) ?? [],
            headers: (saved.headers as unknown as KeyValueEntry[]) ?? [],
            bodyMode: (saved.bodyMode as BodyMode) ?? "none",
            body: saved.body ?? "",
            authMode: (saved.authMode as AuthMode) ?? "inherit",
            authConfig: (saved.authConfig as unknown as AuthConfig) ?? {},
          }}
        />
      </div>
    </div>
  );
}
