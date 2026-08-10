import { prisma } from "@/server/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequestBuilder } from "@/components/requests/RequestBuilder";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  await requireSection("requests");
  const { connection } = await searchParams;

  const connections = await prisma.connection.findMany({
    orderBy: { createdAt: "asc" },
    include: { authProfile: { select: { secretKeys: true } } },
  });

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

  const preferred =
    options.find((entry) => entry.id === connection) ?? options[0];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Request builder"
        description="Build any request by hand, send it, and see exactly what comes back. Save it, or turn it into an endpoint you can chart."
        crumbs={[{ label: "Request Builder", href: "/requests" }, { label: "New" }]}
      />

      <div className="flex-1 overflow-y-auto">
        <RequestBuilder
          connections={options}
          initial={
            preferred
              ? {
                  name: "",
                  connectionId: preferred.id,
                  method: "GET",
                  url: "",
                  queryParams: [{ key: "", value: "", enabled: true }],
                  headers: [{ key: "", value: "", enabled: true }],
                  bodyMode: "none",
                  body: "",
                  authMode: "inherit",
                  authConfig: {},
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
