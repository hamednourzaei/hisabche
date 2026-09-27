// The shared loading floor — a hand-drawn copy in `white/10` used to live
// beside this file. Four stats for the product's figures, then its history.
import { PageSkeleton } from '@hisabche/ui'

export default function Loading() {
  return (
    <main className="section">
      <PageSkeleton stats={4} rows={3} />
    </main>
  )
}
