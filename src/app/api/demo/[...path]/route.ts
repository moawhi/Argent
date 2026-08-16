import { NextResponse } from "next/server";
import {
  commissionRows,
  DEMO_CREDENTIALS,
  nextId,
  statsFor,
  store,
  summaryFor,
  type Account,
  type Campaign,
} from "@/server/demo/data";

/**
 * A local stand-in for the sample API. The bundled demo connection points
 * here, so Argent can be explored end to end with no external service.
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function notFound(what: string) {
  return NextResponse.json({ error: `No ${what} with that id.` }, { status: 404 });
}

function csv(rows: Record<string, unknown>[]): NextResponse {
  if (rows.length === 0) return new NextResponse("", { status: 200 });

  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const body = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8" },
  });
}

function dateRange(url: URL): { fromDate: string; toDate: string } {
  const today = new Date();
  const fallbackTo = today.toISOString().slice(0, 10);
  const fallbackFrom = new Date(today.getTime() - 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return {
    fromDate: url.searchParams.get("fromDate") || fallbackFrom,
    toDate: url.searchParams.get("toDate") || fallbackTo,
  };
}

function limit(url: URL, fallback = 100): number {
  const raw = Number(url.searchParams.get("limit"));
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1000) : fallback;
}

async function handle(request: Request, { params }: Params) {
  const { path } = await params;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (
    url.searchParams.get("apiu") !== DEMO_CREDENTIALS.apiu ||
    url.searchParams.get("apik") !== DEMO_CREDENTIALS.apik
  ) {
    return unauthorized(
      "apiu and apik are required. The demo account uses apiu=demo and apik=demo-key.",
    );
  }

  const data = store();
  const [root, second, third] = path;
  const id = Number(second);
  const wantsCsv = url.searchParams.get("format") === "csv";

  let body: Record<string, unknown> = {};
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    body = await request.json().catch(() => ({}));
  }

  const status = url.searchParams.get("status");
  const byStatus = <T extends { status: string }>(rows: T[]) =>
    status ? rows.filter((row) => row.status === status) : rows;

  /* ---------------------------------------------------------------- *
   * Accounts
   * ---------------------------------------------------------------- */

  if (root === "accounts") {
    if (!second) {
      if (method === "GET") {
        const groupId = Number(url.searchParams.get("accountGroupId"));
        let rows = byStatus(data.accounts);
        if (Number.isFinite(groupId) && groupId > 0) {
          rows = rows.filter((account) => account.accountGroupId === groupId);
        }
        return NextResponse.json(rows.slice(0, limit(url)));
      }

      if (method === "POST") {
        const account: Account = {
          id: nextId(),
          name: String(body.name ?? "Untitled account"),
          accountType: String(body.accountType ?? "advertiser"),
          status: String(body.status ?? "active"),
          contactEmail: String(body.contactEmail ?? ""),
          websiteUrl: String(body.websiteUrl ?? ""),
          balanceAmount: 0,
          commissionRate: Number(body.commissionRate ?? 10),
          accountGroupId: Number(body.accountGroupId ?? 100),
          createdAt: new Date().toISOString(),
        };
        data.accounts.unshift(account);
        return NextResponse.json(account, { status: 201 });
      }
    }

    const account = data.accounts.find((entry) => entry.id === id);
    if (!account) return notFound("account");

    if (third === "campaigns") {
      return NextResponse.json(
        byStatus(
          data.campaigns.filter((campaign) => campaign.accountId === account.id),
        ),
      );
    }

    if (method === "GET") return NextResponse.json(account);

    if (method === "PUT" || method === "PATCH") {
      Object.assign(account, {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.accountType !== undefined
          ? { accountType: String(body.accountType) }
          : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.contactEmail !== undefined
          ? { contactEmail: String(body.contactEmail) }
          : {}),
        ...(body.websiteUrl !== undefined
          ? { websiteUrl: String(body.websiteUrl) }
          : {}),
        ...(body.commissionRate !== undefined
          ? { commissionRate: Number(body.commissionRate) }
          : {}),
      });
      return NextResponse.json(account);
    }

    if (method === "DELETE") {
      data.accounts = data.accounts.filter((entry) => entry.id !== id);
      return NextResponse.json({ id, deleted: true });
    }
  }

  /* ---------------------------------------------------------------- *
   * Account groups
   * ---------------------------------------------------------------- */

  if (root === "account-groups") {
    if (!second) {
      if (method === "GET") return NextResponse.json(byStatus(data.accountGroups));

      if (method === "POST") {
        const group = {
          id: nextId(),
          name: String(body.name ?? "Untitled group"),
          description: String(body.description ?? ""),
          accountCount: 0,
          status: String(body.status ?? "active"),
          createdAt: new Date().toISOString(),
        };
        data.accountGroups.unshift(group);
        return NextResponse.json(group, { status: 201 });
      }
    }

    const group = data.accountGroups.find((entry) => entry.id === id);
    if (!group) return notFound("account group");

    if (third === "accounts") {
      return NextResponse.json(
        data.accounts.filter((account) => account.accountGroupId === group.id),
      );
    }

    if (method === "GET") return NextResponse.json(group);

    if (method === "PUT" || method === "PATCH") {
      Object.assign(group, {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.description !== undefined
          ? { description: String(body.description) }
          : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
      });
      return NextResponse.json(group);
    }

    if (method === "DELETE") {
      data.accountGroups = data.accountGroups.filter((entry) => entry.id !== id);
      return NextResponse.json({ id, deleted: true });
    }
  }

  /* ---------------------------------------------------------------- *
   * Campaigns
   * ---------------------------------------------------------------- */

  if (root === "campaigns") {
    if (!second) {
      if (method === "GET") {
        const accountId = Number(url.searchParams.get("accountId"));
        const groupId = Number(url.searchParams.get("campaignGroupId"));
        let rows = byStatus(data.campaigns);
        if (Number.isFinite(accountId) && accountId > 0) {
          rows = rows.filter((campaign) => campaign.accountId === accountId);
        }
        if (Number.isFinite(groupId) && groupId > 0) {
          rows = rows.filter((campaign) => campaign.campaignGroupId === groupId);
        }
        return NextResponse.json(rows.slice(0, limit(url)));
      }

      if (method === "POST") {
        const campaign: Campaign = {
          id: nextId(),
          name: String(body.name ?? "Untitled campaign"),
          accountId: Number(body.accountId ?? data.accounts[0]?.id ?? 1000),
          campaignGroupId: Number(body.campaignGroupId ?? 200),
          status: String(body.status ?? "active"),
          dailyBudget: Number(body.dailyBudget ?? 500),
          totalSpend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          clickThroughRate: 0,
          startDate: String(
            body.startDate ?? new Date().toISOString().slice(0, 10),
          ),
          endDate: String(body.endDate ?? ""),
          landingPageUrl: String(body.landingPageUrl ?? ""),
        };
        data.campaigns.unshift(campaign);
        return NextResponse.json(campaign, { status: 201 });
      }
    }

    const campaign = data.campaigns.find((entry) => entry.id === id);
    if (!campaign) return notFound("campaign");

    if (third === "pause" && method === "POST") {
      campaign.status = "paused";
      return NextResponse.json(campaign);
    }

    if (third === "resume" && method === "POST") {
      campaign.status = "active";
      return NextResponse.json(campaign);
    }

    if (method === "GET") return NextResponse.json(campaign);

    if (method === "PUT" || method === "PATCH") {
      Object.assign(campaign, {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.dailyBudget !== undefined
          ? { dailyBudget: Number(body.dailyBudget) }
          : {}),
        ...(body.campaignGroupId !== undefined
          ? { campaignGroupId: Number(body.campaignGroupId) }
          : {}),
        ...(body.startDate !== undefined
          ? { startDate: String(body.startDate) }
          : {}),
        ...(body.endDate !== undefined ? { endDate: String(body.endDate) } : {}),
        ...(body.landingPageUrl !== undefined
          ? { landingPageUrl: String(body.landingPageUrl) }
          : {}),
      });
      return NextResponse.json(campaign);
    }

    if (method === "DELETE") {
      data.campaigns = data.campaigns.filter((entry) => entry.id !== id);
      return NextResponse.json({ id, deleted: true });
    }
  }

  /* ---------------------------------------------------------------- *
   * Campaign groups
   * ---------------------------------------------------------------- */

  if (root === "campaign-groups") {
    if (!second) {
      if (method === "GET") {
        return NextResponse.json(
          byStatus(data.campaignGroups).slice(0, limit(url)),
        );
      }

      if (method === "POST") {
        const group = {
          id: nextId(),
          name: String(body.name ?? "Untitled group"),
          description: String(body.description ?? ""),
          status: String(body.status ?? "active"),
          campaignCount: 0,
          monthlyBudget: Number(body.monthlyBudget ?? 0),
          totalSpend: 0,
          ownerEmail: String(body.ownerEmail ?? ""),
          createdAt: new Date().toISOString(),
        };
        data.campaignGroups.unshift(group);
        return NextResponse.json(group, { status: 201 });
      }
    }

    const group = data.campaignGroups.find((entry) => entry.id === id);
    if (!group) return notFound("campaign group");

    if (third === "campaigns") {
      return NextResponse.json(
        byStatus(
          data.campaigns.filter(
            (campaign) => campaign.campaignGroupId === group.id,
          ),
        ),
      );
    }

    if (method === "GET") return NextResponse.json(group);

    if (method === "PUT" || method === "PATCH") {
      Object.assign(group, {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.description !== undefined
          ? { description: String(body.description) }
          : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.monthlyBudget !== undefined
          ? { monthlyBudget: Number(body.monthlyBudget) }
          : {}),
        ...(body.ownerEmail !== undefined
          ? { ownerEmail: String(body.ownerEmail) }
          : {}),
      });
      return NextResponse.json(group);
    }

    if (method === "DELETE") {
      data.campaignGroups = data.campaignGroups.filter(
        (entry) => entry.id !== id,
      );
      return NextResponse.json({ id, deleted: true });
    }
  }

  /* ---------------------------------------------------------------- *
   * Stats
   * ---------------------------------------------------------------- */

  if (root === "stats" && method === "GET") {
    const { fromDate, toDate } = dateRange(url);

    if (second === "summary") {
      return NextResponse.json(summaryFor(fromDate, toDate));
    }

    if (second === "daily") {
      const campaignId = Number(url.searchParams.get("campaignId"));
      const rows = statsFor(
        fromDate,
        toDate,
        url.searchParams.get("groupBy") ?? "day",
        Number.isFinite(campaignId) && campaignId > 0 ? campaignId : undefined,
      );

      if (wantsCsv) return csv(rows as unknown as Record<string, unknown>[]);

      return NextResponse.json({
        fromDate,
        toDate,
        timezone: url.searchParams.get("timezone") ?? "UTC",
        stats: rows,
      });
    }

    if (second === "campaigns") {
      return NextResponse.json(
        [...data.campaigns]
          .sort((a, b) => b.conversions - a.conversions)
          .slice(0, limit(url)),
      );
    }

    if (second === "accounts") {
      return NextResponse.json(data.accounts);
    }
  }

  /* ---------------------------------------------------------------- *
   * Commission reports
   * ---------------------------------------------------------------- */

  if (root === "reports" && second === "commission" && method === "GET") {
    const { fromDate, toDate } = dateRange(url);
    const rows = commissionRows(fromDate, toDate);

    if (!third) {
      const accountId = Number(url.searchParams.get("accountId"));
      const payoutStatus = url.searchParams.get("payoutStatus");

      let filtered = rows;
      if (Number.isFinite(accountId) && accountId > 0) {
        filtered = filtered.filter((row) => row.accountId === accountId);
      }
      if (payoutStatus) {
        filtered = filtered.filter((row) => row.payoutStatus === payoutStatus);
      }

      if (wantsCsv) return csv(filtered as unknown as Record<string, unknown>[]);

      return NextResponse.json({
        fromDate,
        toDate,
        totalCommission: Math.round(
          filtered.reduce((total, row) => total + row.commissionAmount, 0),
        ),
        currency: "USD",
        rows: filtered,
      });
    }

    if (third === "summary") {
      const total = rows.reduce((sum, row) => sum + row.commissionAmount, 0);
      const paid = rows
        .filter((row) => row.payoutStatus === "paid")
        .reduce((sum, row) => sum + row.commissionAmount, 0);

      return NextResponse.json({
        fromDate,
        toDate,
        totalCommission: Math.round(total),
        paidCommission: Math.round(paid),
        pendingCommission: Math.round(total - paid),
        currency: "USD",
      });
    }

    if (third === "daily") {
      const stats = statsFor(
        fromDate,
        toDate,
        url.searchParams.get("groupBy") ?? "day",
      ).map((row) => ({
        date: row.date,
        conversions: row.conversions,
        revenue: row.revenue,
        commissionAmount: Math.round(row.revenue * 0.12 * 100) / 100,
      }));

      return NextResponse.json({ fromDate, toDate, stats });
    }
  }

  return NextResponse.json(
    { error: `The demo API has no ${method} ${url.pathname}.` },
    { status: 404 },
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
