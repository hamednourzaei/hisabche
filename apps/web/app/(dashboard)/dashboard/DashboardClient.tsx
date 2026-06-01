

import dynamic from "next/dynamic"
import { DashboardSkeleton } from "../page"

const DashboardContainer = dynamic(
  () => import("@hisabche/ui").then(m => ({ default: m.DashboardContainer })),
  {
    ssr: true,
    loading: () => <DashboardSkeleton />,
  }
)

export default function DashboardClient() {
  return <DashboardContainer />
}