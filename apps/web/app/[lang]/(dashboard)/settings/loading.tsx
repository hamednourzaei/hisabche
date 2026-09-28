// The shared loading floor — a hand-drawn copy in `white/10` used to live
// beside this file. No stat row: settings is a stack of sections.
import { PageSkeleton } from '@hisabche/ui'

export default function Loading() {
  return <PageSkeleton stats={0} rows={5} />
}
