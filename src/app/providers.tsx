"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import type { ThemeId } from "@/lib/theme";

export function Providers({
  children,
  initialTheme = "light",
  persistTheme,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeId;
  persistTheme?: (theme: ThemeId) => Promise<void>;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dashboard widgets hit the gateway; avoid hammering upstream APIs
            // on every focus change.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider
        initialTheme={initialTheme}
        persistToServer={persistTheme}
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
