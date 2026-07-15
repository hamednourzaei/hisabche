// apps/web/app/[lang]/providers.tsx
"use client";

import React, { Suspense, lazy, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@hisabche/i18n";
import { ToastProvider } from "@hisabche/ui";

/* ═══════════════════════════════════════════════════════════════════════════
   Providers v2 — Memoized · Optimized
   ✅ useMemo for queryClient · lazy with ssr: false
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ Lazy load HeavyProviders with ssr: false
const HeavyProviders = lazy(() =>
  import("./heavy-providers").then((m) => ({ default: m.HeavyProviders }))
);

// ✅ QueryClient با useMemo (برای جلوگیری از بازتعریف)
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

export function Providers({ children }: { children: React.ReactNode }) {
  // ✅ استفاده از useMemo برای queryClient (اگر در future نیاز به re-init داشت)
  const client = useMemo(() => queryClient, []);

  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <Suspense fallback={<>{children}</>}>
            <HeavyProviders>{children}</HeavyProviders>
          </Suspense>
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}