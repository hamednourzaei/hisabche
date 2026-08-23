'use client'

import { PageSkeleton } from '@hisabche/ui'

export default function Loading() {
  return (
    <main className="section">
      <PageSkeleton stats={0} rows={6} />
    </main>
  )
}
