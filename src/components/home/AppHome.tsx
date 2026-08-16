import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  LayoutDashboard,
  Plug,
  Send,
  Telescope,
} from "lucide-react";
import { prisma } from "@/server/db";
import { hasMasterKey } from "@/server/crypto";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge, Card, StatusDot } from "@/components/ui/primitives";
import { OnboardingChecklist } from "@/components/layout/OnboardingChecklist";
import { LoadDemoButton } from "@/components/layout/LoadDemoButton";
import { FirstRunTour } from "@/components/layout/FirstRunTour";
import { formatRelativeTime } from "@/lib/utils";
import {
  canAccessSection,
  filterViewableDashboards,
  isAdmin,
  type SessionUser,
} from "@/server/auth/permissions";
import { filterAccessibleConnections } from "@/server/auth/api-grants";
import { isDemoDashboardSlug } from "@/server/demo/access";
import {
  HideDemoButton,
  ShowDemoButton,
} from "@/components/demo/HideDemoButton";
import { isDemoInstalled } from "@/server/demo/seed";

export async function AppHome({ user }: { user: SessionUser }) {
  const [rawConnections, objectCount, allDashboards, recentLogs, installed] =
    await Promise.all([
      canAccessSection(user, "connections")
        ? prisma.connection.findMany({
            orderBy: { createdAt: "asc" },
            include: { _count: { select: { operations: true } } },
          })
        : Promise.resolve([]),
      canAccessSection(user, "objects")
        ? prisma.dataObject.count()
        : Promise.resolve(0),
      canAccessSection(user, "dashboards")
        ? prisma.dashboard.findMany({
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
            take: 20,
            include: { _count: { select: { widgets: true } } },
          })
        : Promise.resolve([]),
      canAccessSection(user, "connections")
        ? prisma.requestLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              ok: true,
              method: true,
              url: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      isDemoInstalled(),
    ]);

  const connections = await filterAccessibleConnections(user, rawConnections);

  const dashboards = (
    await filterViewableDashboards(user, allDashboards)
  ).slice(0, 4);

  const keyConfigured = hasMasterKey();
  const showConnections = canAccessSection(user, "connections");
  const showObjects = canAccessSection(user, "objects");
  const showRequests = canAccessSection(user, "requests");
  const showDocs = canAccessSection(user, "docs");
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        title="Welcome to Argent"
        description="Import an OpenAPI spec, pick endpoints for agents, and get a hosted MCP URL — dashboards come along for free."
        actions={
          <div className="flex flex-wrap gap-2">
            {showDocs ? (
              <Link href="/docs/guides">
                <Button variant="secondary">
                  <BookOpen /> Guides
                </Button>
              </Link>
            ) : null}
            {showConnections ? (
              <Link href="/connections/new">
                <Button>
                  <Plug /> Connect an API
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <PageBody className="space-y-6">
        {showConnections ? (
          <FirstRunTour show={connections.length === 0} />
        ) : null}

        {!keyConfigured && showConnections ? (
          <Card className="border-warning/40 bg-warning-soft p-4">
            <p className="text-sm font-medium text-ink">
              Finish setting up before you save any credentials
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              <code className="font-mono">APP_MASTER_KEY</code> is not set, so
              Argent cannot encrypt API keys. Add one to your{" "}
              <code className="font-mono">.env</code> file and restart:
            </p>
            <pre className="mt-2 overflow-auto rounded-md bg-ink px-3 py-2 font-mono text-[11px] text-canvas">
              {`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`}
            </pre>
          </Card>
        ) : null}

        {showConnections && connections.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 border-brand/30 bg-brand-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                Want to see it working first?
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-soft">
                Load the bundled sample: 32 endpoints, saved sign-in
                details, nine ready-made tiles and a finished dashboard. It runs
                against a mock API inside Argent, so nothing leaves this machine,
                and you can delete it from the connection&apos;s settings
                whenever you like.
              </p>
            </div>
            <LoadDemoButton variant="primary" label="Load the example" />
          </Card>
        ) : null}

        {showConnections ? (
          <OnboardingChecklist
            hasConnection={connections.length > 0}
            hasObject={objectCount > 0}
            hasDashboard={dashboards.length > 0}
          />
        ) : null}

        {user.hideDemo && installed && !admin && canAccessSection(user, "dashboards") ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-soft">
              You hid the bundled sample.
            </p>
            <ShowDemoButton />
          </Card>
        ) : null}

        {dashboards.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-end justify-between">
              <h2 className="text-sm font-semibold">Your dashboards</h2>
              <Link
                href="/dashboards"
                className="text-xs text-brand hover:underline"
              >
                See all
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboards.map((dashboard) => {
                const demo = isDemoDashboardSlug(dashboard.slug);
                return (
                  <Card
                    key={dashboard.id}
                    className="h-full p-4 transition-shadow hover:shadow-md"
                  >
                    <Link
                      href={`/dashboards/${dashboard.slug}`}
                      className="block"
                    >
                      <LayoutDashboard className="mb-2 size-4 text-brand" />
                      <p className="truncate text-sm font-semibold">
                        {dashboard.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {dashboard._count.widgets} tile
                        {dashboard._count.widgets === 1 ? "" : "s"}
                      </p>
                    </Link>
                    {demo && !admin ? (
                      <div className="mt-3 border-t border-line pt-2">
                        <HideDemoButton />
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {showConnections && connections.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-end justify-between">
              <h2 className="text-sm font-semibold">Connected APIs</h2>
              <Link
                href="/connections"
                className="text-xs text-brand hover:underline"
              >
                Manage
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {connections.map((connection) => (
                <Card key={connection.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {connection.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                        <StatusDot status={connection.status} />
                        {connection._count.operations} endpoints
                      </p>
                    </div>
                    {connection.readOnly ? (
                      <Badge tone="neutral">Read only</Badge>
                    ) : (
                      <Badge tone="warning">Writes on</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {canAccessSection(user, "explorer") ? (
                      <Link href={`/explorer/${connection.id}`}>
                        <Button size="sm" variant="ghost">
                          <Telescope /> Explore
                        </Button>
                      </Link>
                    ) : null}
                    {showDocs ? (
                      <Link href={`/docs/${connection.id}`}>
                        <Button size="sm" variant="ghost">
                          <BookOpen /> Docs
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {showObjects || showRequests || showDocs ? (
          <section className="grid gap-3 md:grid-cols-3">
            {showObjects ? (
              <ShortcutCard
                href="/objects/new"
                icon={<Boxes className="size-4" />}
                title="Build an object"
                description="Turn an endpoint into a table, chart, card or form."
              />
            ) : null}
            {showRequests ? (
              <ShortcutCard
                href="/requests/new"
                icon={<Send className="size-4" />}
                title="Add an endpoint by hand"
                description="For anything your API file does not cover."
              />
            ) : null}
            {showDocs ? (
              <ShortcutCard
                href="/docs"
                icon={<BookOpen className="size-4" />}
                title="Guides & docs"
                description="What APIs, OpenAPI, and MCP are — plus reference from your connections."
              />
            ) : null}
          </section>
        ) : null}

        {recentLogs.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Latest requests</h2>
            <Card className="divide-y divide-line">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-4 py-2 text-xs"
                >
                  <StatusDot status={log.ok ? "healthy" : "failing"} />
                  <span className="font-mono text-[11px] text-ink-faint">
                    {log.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">
                    {log.url}
                  </span>
                  <span className="shrink-0 text-ink-faint">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="group h-full p-4 transition-shadow hover:shadow-md">
        <span className="mb-2 flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
          {icon}
        </span>
        <p className="flex items-center gap-1 text-sm font-semibold">
          {title}
          <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">{description}</p>
      </Card>
    </Link>
  );
}
