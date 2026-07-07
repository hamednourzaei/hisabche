// apps/web/app/providers.tsx
"use client";

import React, { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@hisabche/i18n";
import { ToastProvider } from "@hisabche/ui";
import { useAuthStore, useWorkspaceStore } from "@hisabche/store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

const HeavyProviders = lazy(() =>
  import("./heavy-providers").then((m) => ({ default: m.HeavyProviders })),
);

// ✅ v1.1 — Fetch workspace data when user is authenticated
function WorkspaceLoader({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const { fetchWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (userId) fetchWorkspace(userId);
  }, [userId, fetchWorkspace]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <WorkspaceLoader>
            <Suspense fallback={<>{children}</>}>
              <HeavyProviders>{children}</HeavyProviders>
            </Suspense>
          </WorkspaceLoader>
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}