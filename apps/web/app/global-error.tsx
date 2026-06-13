"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   GlobalError v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface-base))] p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--color-destructive)/0.1)] flex items-center justify-center mx-auto mb-6">
              <AlertTriangle
                className="size-10 text-[hsl(var(--color-destructive))]"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] mb-3">
              خطای سیستمی
            </h1>
            <p className="text-sm text-[hsl(var(--fg-secondary))] mb-6">
              اطلاعات شما امن است. لطفاً دوباره تلاش کنید.
            </p>
            <button
              type="button"
              onClick={reset}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                "text-sm font-bold text-white",
                "bg-[var(--gradient-brand)]",
                "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                "motion-reduce:transition-none",
              )}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              تلاش دوباره
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}