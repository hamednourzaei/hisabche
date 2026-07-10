// apps/web/app/analytics-pageview.tsx
"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function AnalyticsPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
      ;(window as any).gtag("config", "G-T5XG907W4R", {
        page_path: url,
      })
    }
  }, [pathname, searchParams])

  return null
}