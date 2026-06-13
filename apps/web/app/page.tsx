import { Suspense } from "react";
import { LandingPage } from "@hisabche/ui/landing/landing-page";
import { AuthGate } from "./auth-gate";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   RootPage v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

export const revalidate = 3600;

export const metadata = {
  title: "حسابچه — سیستم مدیریت کسب‌وکار",
  description: "حسابداری ساده، فاکتور سریع، گدام خودکار. بدون اینترنت.",
};

export default function RootPage() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div
              className={cn(
                "h-8 w-8 animate-spin rounded-full",
                "border-2 border-[hsl(var(--color-primary))] border-t-transparent",
              )}
            />
          </div>
        }
      >
        <LandingPage />
      </Suspense>
    </AuthGate>
  );
}