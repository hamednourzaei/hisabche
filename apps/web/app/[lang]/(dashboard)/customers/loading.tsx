// apps/web/app/(dashboard)/customers/loading.tsx
"use client"

import { customersSkeleton } from "@hisabche/ui"

export default function Loading() {
  return (
    <main className="section">
      {customersSkeleton()}
    </main>
  )
}