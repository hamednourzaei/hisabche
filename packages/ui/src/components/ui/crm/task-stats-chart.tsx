"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import type { EmployeeTaskStat } from "./task-stats-chart-internal";
export type { EmployeeTaskStat } from "./task-stats-chart-internal";

interface TaskStatsChartProps {
  data: EmployeeTaskStat[];
  height?: number;
  labels: { pending: string; in_progress: string; completed: string };
  emptyLabel: string;
}

// Lazy-load Recharts (no SSR) — same convention as sales-chart.tsx.
const DynamicBarChart = dynamic(() => import("./task-stats-chart-internal"), {
  ssr: false,
  loading: () => <ChartSkeleton height={260} />,
});

const ChartSkeleton = memo(function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  );
});
ChartSkeleton.displayName = "ChartSkeleton";

export const TaskStatsChart = memo(function TaskStatsChart({
  data,
  height = 260,
  labels,
  emptyLabel,
}: TaskStatsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
        style={{ height }}
      >
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
      <DynamicBarChart data={data} height={height} labels={labels} />
    </section>
  );
});

TaskStatsChart.displayName = "TaskStatsChart";
