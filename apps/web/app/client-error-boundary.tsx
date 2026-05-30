"use client"

import dynamic from "next/dynamic"
import type { ReactNode } from "react"

const ErrorBoundary = dynamic(
  () => import("@hisabche/ui").then((m) => m.ErrorBoundary),
  { ssr: false }
)

export function ClientErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}