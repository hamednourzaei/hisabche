// apps/web/app/[lang]/pricing/page.tsx
"use client";

import { PricingContainer } from '@hisabche/ui'
import { Suspense } from 'react'

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PricingContainer />
    </Suspense>
  )
}