// Server Component - بدون "use client"
interface LCPMetricProps {
  amount: number
}

export function LCPMetric({ amount }: LCPMetricProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm text-muted-foreground">فروش امروز</h3>
      <p className="text-2xl font-bold tabular-nums sm:text-3xl text-foreground">
        {amount.toLocaleString("fa-AF")} AFN
      </p>
    </div>
  )
}