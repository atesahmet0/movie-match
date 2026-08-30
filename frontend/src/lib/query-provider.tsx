"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes fresh cache
            gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
            refetchOnWindowFocus: false, // Prevent redundant anti-bot scraper hits
            retry: (failureCount) => {
              // Retry at most 2 times on network failures
              if (failureCount >= 2) return false;
              return true;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
