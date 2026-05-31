import { Suspense } from "react"
import { LandingPage } from "@hisabche/ui/landing/landing-page"
import { AuthGate } from "./auth-gate"

export const revalidate = 3600

export const metadata = {
  title: "حسابچه — سیستم مدیریت کسب‌وکار",
  description:
    "حسابداری ساده، فاکتور سریع، گدام خودکار. بدون اینترنت.",
}

export default function RootPage() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
          </div>
        }
      >
        <LandingPage />
      </Suspense>
    </AuthGate>
  )
}