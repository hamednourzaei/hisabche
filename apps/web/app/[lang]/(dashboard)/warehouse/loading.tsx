'use client'

import { warehouseSkeleton } from '@hisabche/ui'

export default function Loading() {
  return <main className="section">{warehouseSkeleton()}</main>
}
