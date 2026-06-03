import dynamic from "next/dynamic"
import { DashboardSkeleton } from "../page"

const DashboardContainer = dynamic(
  () =>
    import("@hisabche/ui/components/ui/dashboard/containers/dashboard-container")
      .then((m) => ({ default: m.DashboardContainer })),
  {
    ssr: true,
    loading: () => <DashboardSkeleton />,
  }
)

export default function DashboardClient() {
  return <DashboardContainer />
}