// apps/web/app/analytics-pageview.tsx
"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

// ✅ تعریف type دقیق برای gtag
interface GtagParams {
  page_path?: string
  [key: string]: string | number | boolean | undefined
}

declare global {
  interface Window {
    gtag: (command: string, targetId: string, params?: GtagParams) => void
  }
}

export function AnalyticsPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== "undefined" && window.gtag) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
      window.gtag("config", "G-T5XG907W4R", {
        page_path: url,
      })
    }
  }, [pathname, searchParams])

  return null
}