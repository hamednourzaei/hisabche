"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface EmployeeTaskStat {
  employee: string;
  pending: number;
  in_progress: number;
  completed: number;
}

interface TaskStatsChartInternalProps {
  data: EmployeeTaskStat[];
  height: number;
  labels: { pending: string; in_progress: string; completed: string };
}

const GRID_STROKE = "hsl(var(--border-default))";

export default memo(function TaskStatsChartInternal({ data, height, labels }: TaskStatsChartInternalProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">هیچ داده‌ای برای نمایش وجود ندارد</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="employee"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--fg-tertiary))" }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--fg-tertiary))" }}
          allowDecimals={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid hsl(var(--border-default))",
            background: "hsl(var(--surface-elevated) / 0.98)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="pending" name={labels.pending} stackId="status" fill="hsl(var(--color-warning))" radius={[0, 0, 0, 0]} />
        <Bar dataKey="in_progress" name={labels.in_progress} stackId="status" fill="hsl(var(--color-info))" radius={[0, 0, 0, 0]} />
        <Bar dataKey="completed" name={labels.completed} stackId="status" fill="hsl(var(--color-success))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});
