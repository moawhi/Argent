import "server-only";

/**
 * A self-contained stand-in for the AdLogic API, so the bundled demo works
 * without any external service or network access. Everything is generated from
 * a fixed seed, so figures are stable between reloads; writes are held in
 * memory and reset when the server restarts.
 */

export const DEMO_CREDENTIALS = { apiu: "demo", apik: "demo-key" };

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-randomness
 * ------------------------------------------------------------------ */

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A stable 0..1 value for any string key. */
function rand(key: string): number {
  return hash(key) / 4294967295;
}

function between(key: string, min: number, max: number): number {
  return min + rand(key) * (max - min);
}

function pick<T>(key: string, options: readonly T[]): T {
  return options[Math.floor(rand(key) * options.length) % options.length];
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

export interface AccountGroup {
  id: number;
  name: string;
  description: string;
  accountCount: number;
  status: string;
  createdAt: string;
}

export interface Account {
  id: number;
  name: string;
  accountType: string;
  status: string;
  contactEmail: string;
  websiteUrl: string;
  balanceAmount: number;
  commissionRate: number;
  accountGroupId: number;
  createdAt: string;
}

export interface CampaignGroup {
  id: number;
  name: string;
  description: string;
  status: string;
  campaignCount: number;
  monthlyBudget: number;
  totalSpend: number;
  ownerEmail: string;
  createdAt: string;
}

export interface Campaign {
  id: number;
  name: string;
  accountId: number;
  campaignGroupId: number;
  status: string;
  dailyBudget: number;
  totalSpend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  clickThroughRate: number;
  startDate: string;
  endDate: string;
  landingPageUrl: string;
}

const GROUP_NAMES = [
  "Retail Partners",
  "Travel Network",
  "Finance Vertical",
  "Home & Garden",
  "Health & Beauty",
  "Technology Direct",
];

const CAMPAIGN_GROUP_NAMES = [
  "Summer Retail Push",
  "Always-On Search",
  "Travel Q3 Brand",
  "Card Acquisition",
  "Home Renovation",
  "Beauty Launch",
  "Device Upgrades",
  "Winter Clearance",
];

const BRANDS = [
  "Northwind",
  "Blue Harbour",
  "Copperfield",
  "Meridian",
  "Aster Lane",
  "Ironbark",
  "Solstice",
  "Quay Street",
  "Fernwood",
  "Halcyon",
  "Redgum",
  "Waverley",
];

const CHANNELS = [
  "Search",
  "Display",
  "Social",
  "Native",
  "Email",
  "Retargeting",
  "Video",
];

const STATUSES = ["active", "active", "active", "paused", "archived"] as const;

function isoDaysAgo(days: number): string {
  const date = new Date(Date.UTC(2026, 6, 25));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function buildAccountGroups(): AccountGroup[] {
  return GROUP_NAMES.map((name, index) => ({
    id: 100 + index,
    name,
    description: `Accounts reported on together as ${name.toLowerCase()}.`,
    accountCount: 4,
    status: index === 5 ? "paused" : "active",
    createdAt: isoDaysAgo(400 - index * 30),
  }));
}

function buildAccounts(): Account[] {
  const accounts: Account[] = [];

  for (let index = 0; index < 24; index += 1) {
    const key = `account:${index}`;
    const brand = BRANDS[index % BRANDS.length];
    const suffix = index < BRANDS.length ? "Group" : "Media";
    const groupId = 100 + (index % GROUP_NAMES.length);

    accounts.push({
      id: 1000 + index,
      name: `${brand} ${suffix}`,
      accountType: index % 3 === 0 ? "publisher" : "advertiser",
      status: pick(`${key}:status`, STATUSES),
      contactEmail: `ops@${brand.toLowerCase().replace(/\s+/g, "")}.example.com`,
      websiteUrl: `https://www.${brand.toLowerCase().replace(/\s+/g, "")}.example.com`,
      balanceAmount: round(between(`${key}:balance`, -2500, 48000)),
      commissionRate: round(between(`${key}:rate`, 3, 22), 1),
      accountGroupId: groupId,
      createdAt: isoDaysAgo(Math.floor(between(`${key}:created`, 40, 720))),
    });
  }

  return accounts;
}

function buildCampaignGroups(): CampaignGroup[] {
  return CAMPAIGN_GROUP_NAMES.map((name, index) => {
    const key = `campaignGroup:${index}`;
    const budget = round(between(`${key}:budget`, 20000, 180000), 0);
    return {
      id: 200 + index,
      name,
      description: `Campaigns grouped under ${name.toLowerCase()}.`,
      status: index === 7 ? "archived" : index === 4 ? "paused" : "active",
      campaignCount: 5,
      monthlyBudget: budget,
      totalSpend: round(budget * between(`${key}:spend`, 0.3, 0.95)),
      ownerEmail: `${name.split(" ")[0].toLowerCase()}@adlogic.example.com`,
      createdAt: isoDaysAgo(Math.floor(between(`${key}:created`, 60, 500))),
    };
  });
}

function buildCampaigns(accounts: Account[]): Campaign[] {
  const campaigns: Campaign[] = [];

  for (let index = 0; index < 40; index += 1) {
    const key = `campaign:${index}`;
    const account = accounts[index % accounts.length];
    const channel = CHANNELS[index % CHANNELS.length];
    const brand = account.name.split(" ")[0];

    const impressions = Math.floor(between(`${key}:impressions`, 40_000, 2_400_000));
    const clicks = Math.floor(impressions * between(`${key}:ctr`, 0.004, 0.062));
    const conversions = Math.floor(clicks * between(`${key}:cvr`, 0.012, 0.14));
    const dailyBudget = round(between(`${key}:budget`, 150, 4200), 0);

    campaigns.push({
      id: 5000 + index,
      name: `${brand} ${channel} ${2026 - (index % 2)}`,
      accountId: account.id,
      campaignGroupId: 200 + (index % CAMPAIGN_GROUP_NAMES.length),
      status: pick(`${key}:status`, STATUSES),
      dailyBudget,
      totalSpend: round(dailyBudget * between(`${key}:days`, 8, 120)),
      impressions,
      clicks,
      conversions,
      clickThroughRate: round((clicks / impressions) * 100, 2),
      startDate: isoDaysAgo(Math.floor(between(`${key}:start`, 30, 300))).slice(0, 10),
      endDate: isoDaysAgo(-Math.floor(between(`${key}:end`, 5, 120))).slice(0, 10),
      landingPageUrl: `https://www.${brand.toLowerCase()}.example.com/offers/${5000 + index}`,
    });
  }

  return campaigns;
}

/* ------------------------------------------------------------------ *
 * In-memory store
 * ------------------------------------------------------------------ */

interface DemoStore {
  accountGroups: AccountGroup[];
  accounts: Account[];
  campaignGroups: CampaignGroup[];
  campaigns: Campaign[];
  nextId: number;
}

const globalStore = globalThis as unknown as { __seeitDemo?: DemoStore };

export function store(): DemoStore {
  if (!globalStore.__seeitDemo) {
    const accounts = buildAccounts();
    globalStore.__seeitDemo = {
      accountGroups: buildAccountGroups(),
      accounts,
      campaignGroups: buildCampaignGroups(),
      campaigns: buildCampaigns(accounts),
      nextId: 9000,
    };
  }
  return globalStore.__seeitDemo;
}

export function nextId(): number {
  const current = store();
  current.nextId += 1;
  return current.nextId;
}

/* ------------------------------------------------------------------ *
 * Time series
 * ------------------------------------------------------------------ */

export interface StatRow {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  clickThroughRate: number;
  conversionRate: number;
}

function eachBucket(
  fromDate: string,
  toDate: string,
  groupBy: string,
): Date[] {
  const start = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const buckets: Date[] = [];
  const cursor = new Date(start);
  const limit = 800;

  while (cursor <= end && buckets.length < limit) {
    buckets.push(new Date(cursor));
    switch (groupBy) {
      case "hour":
        cursor.setUTCHours(cursor.getUTCHours() + 1);
        break;
      case "week":
        cursor.setUTCDate(cursor.getUTCDate() + 7);
        break;
      case "month":
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        break;
      default:
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return buckets;
}

/**
 * Figures for one bucket. A weekly rhythm plus a slow upward trend makes the
 * charts look like real traffic rather than noise.
 */
export function statsFor(
  fromDate: string,
  toDate: string,
  groupBy = "day",
  campaignId?: number,
): StatRow[] {
  const scope = campaignId ? `campaign:${campaignId}` : "all";
  const multiplier = campaignId ? 0.06 : 1;

  return eachBucket(fromDate, toDate, groupBy).map((date) => {
    const key = `${scope}:${date.toISOString()}`;
    const dayOfWeek = date.getUTCDay();
    const weekend = dayOfWeek === 0 || dayOfWeek === 6 ? 0.62 : 1;
    const trend = 1 + date.getUTCDate() / 220;
    const size =
      groupBy === "hour" ? 1 / 18 : groupBy === "week" ? 6.4 : groupBy === "month" ? 27 : 1;

    const impressions = Math.floor(
      between(`${key}:impressions`, 320_000, 520_000) *
        weekend *
        trend *
        multiplier *
        size,
    );
    const clicks = Math.floor(impressions * between(`${key}:ctr`, 0.018, 0.041));
    const conversions = Math.floor(clicks * between(`${key}:cvr`, 0.031, 0.092));
    const spend = round(clicks * between(`${key}:cpc`, 0.42, 1.35));
    const revenue = round(conversions * between(`${key}:aov`, 34, 128));

    return {
      date: date.toISOString(),
      impressions,
      clicks,
      conversions,
      spend,
      revenue,
      clickThroughRate: round((clicks / Math.max(impressions, 1)) * 100, 2),
      conversionRate: round((conversions / Math.max(clicks, 1)) * 100, 2),
    };
  });
}

export function summaryFor(fromDate: string, toDate: string) {
  const rows = statsFor(fromDate, toDate);
  const total = rows.reduce(
    (accumulator, row) => ({
      impressions: accumulator.impressions + row.impressions,
      clicks: accumulator.clicks + row.clicks,
      conversions: accumulator.conversions + row.conversions,
      spend: accumulator.spend + row.spend,
      revenue: accumulator.revenue + row.revenue,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 },
  );

  return {
    totalSpend: round(total.spend),
    totalRevenue: round(total.revenue),
    totalConversions: total.conversions,
    totalClicks: total.clicks,
    totalImpressions: total.impressions,
    activeCampaigns: store().campaigns.filter(
      (campaign) => campaign.status === "active",
    ).length,
    returnOnAdSpend: round(total.revenue / Math.max(total.spend, 1), 2),
    conversionRate: round(
      (total.conversions / Math.max(total.clicks, 1)) * 100,
      2,
    ),
  };
}

export interface CommissionRow {
  accountId: number;
  accountName: string;
  campaignId: number;
  campaignName: string;
  conversions: number;
  revenue: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  payoutStatus: string;
}

export function commissionRows(
  fromDate: string,
  toDate: string,
): CommissionRow[] {
  const current = store();
  const days = Math.max(eachBucket(fromDate, toDate, "day").length, 1);

  return current.campaigns
    .filter((campaign) => campaign.status !== "archived")
    .map((campaign) => {
      const account = current.accounts.find(
        (entry) => entry.id === campaign.accountId,
      );
      const key = `commission:${campaign.id}:${fromDate}:${toDate}`;
      const conversions = Math.max(
        1,
        Math.floor((campaign.conversions / 90) * days * between(key, 0.7, 1.3)),
      );
      const revenue = round(conversions * between(`${key}:aov`, 38, 142));
      const rate = account?.commissionRate ?? 10;

      return {
        accountId: campaign.accountId,
        accountName: account?.name ?? "Unknown",
        campaignId: campaign.id,
        campaignName: campaign.name,
        conversions,
        revenue,
        commissionRate: rate,
        commissionAmount: round((revenue * rate) / 100),
        currency: "USD",
        payoutStatus: pick(`${key}:payout`, [
          "paid",
          "approved",
          "pending",
          "approved",
        ]),
      };
    })
    .sort((a, b) => b.commissionAmount - a.commissionAmount);
}
