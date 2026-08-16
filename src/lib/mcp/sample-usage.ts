/**
 * Demo prompts and tool examples for the sample MCP (`sample`).
 * Safe for client components — no server-only imports.
 */

export const SAMPLE_MCP_PROMPTS = [
  {
    title: "List accounts",
    prompt:
      "Using the sample MCP, list all affiliate accounts and summarize how many there are.",
  },
  {
    title: "Account detail",
    prompt:
      "Call getAccount with id 1 and tell me the account name and status.",
  },
  {
    title: "Campaigns for an account",
    prompt:
      "List campaigns for account id 1, then pick the first campaign and show its daily stats for the last 7 days.",
  },
  {
    title: "Portfolio stats",
    prompt:
      "Fetch getStatsSummary and getDailyStats, then explain whether performance is trending up or down.",
  },
] as const;

export const SAMPLE_MCP_TOOL_EXAMPLES = [
  {
    tool: "listAccounts",
    description: "Browse affiliate accounts (no args required).",
    args: {},
  },
  {
    tool: "getAccount",
    description: "Load one account by id.",
    args: { id: 1 },
  },
  {
    tool: "listAccountCampaigns",
    description: "Campaigns belonging to an account.",
    args: { id: 1 },
  },
  {
    tool: "getStatsSummary",
    description: "High-level performance snapshot.",
    args: {},
  },
  {
    tool: "getDailyStats",
    description: "Day-by-day stats (optional date filters if the tool exposes them).",
    args: {},
  },
] as const;

export function formatToolExampleCall(example: {
  tool: string;
  args: Record<string, unknown>;
}): string {
  const hasArgs = Object.keys(example.args).length > 0;
  if (!hasArgs) return `${example.tool}()`;
  return `${example.tool}(${JSON.stringify(example.args)})`;
}
