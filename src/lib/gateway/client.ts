"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { ExecuteRequestBody, ExecuteResponseBody } from "./types";

export async function executeGateway(
  body: ExecuteRequestBody,
): Promise<ExecuteResponseBody> {
  const response = await fetch("/api/gateway/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      durationMs: 0,
      contentType: null,
      error: {
        kind: "network",
        message: "seeIt could not reach its own server. Is the app still running?",
        detail: `The gateway responded with HTTP ${response.status}.`,
      },
    };
  }

  return (await response.json()) as ExecuteResponseBody;
}

/**
 * Runs a read through the gateway and keeps it in the query cache.
 * Disabled automatically until every prompted parameter has a value.
 */
export function useGatewayData(
  key: unknown[],
  body: ExecuteRequestBody,
  options?: Partial<UseQueryOptions<ExecuteResponseBody>>,
) {
  return useQuery<ExecuteResponseBody>({
    queryKey: ["gateway", ...key],
    queryFn: () => executeGateway(body),
    ...options,
  });
}
