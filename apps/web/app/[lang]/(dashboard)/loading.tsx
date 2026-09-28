// The loading floor for every dashboard route that has no skeleton of its own.
//
// It used to import a hand-drawn `DashboardSkeleton` from the group's own
// `page.tsx` — a page that `/[lang]` never serves (the landing page owns that
// URL), kept alive only so this file and `/dashboard` could borrow from it, and
// drawn in `white/10` rather than design tokens. `PageSkeleton` is the shared
// floor; three stats and three rows keep the dashboard's shape.
import { PageSkeleton } from '@hisabche/ui'

export default function Loading() {
  return <PageSkeleton stats={3} rows={3} />
}
