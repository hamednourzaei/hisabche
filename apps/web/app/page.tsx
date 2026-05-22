import { Suspense } from "react"
import { LandingPage } from "@hisabche/ui/landing/landing-page"

export const dynamic = "force-static"
export const revalidate = 3600

export const metadata = {
  title: "حسابچه — سیستم مدیریت کسب‌وکار",
  description: "حسابداری ساده، فاکتور سریع، گدام خودکار. بدون اینترنت.",
}

export default function RootPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
      </div>
    }>
      <LandingPage />
    </Suspense>
  )
}