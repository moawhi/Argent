export const APP_NAME = "Argent";
export const APP_TAGLINE = "Turn your OpenAPI into MCP.";
export const APP_DESCRIPTION =
  "Import an OpenAPI spec, pick the endpoints agents may call, and get a hosted MCP URL for Cursor and Claude — credentials never leave the gateway. Dashboards come along for free.";

export function mcpClientKey(slug: string): string {
  return `argent-${slug}`;
}

export function mcpServerInfoName(slug: string): string {
  return `argent-${slug}`;
}
