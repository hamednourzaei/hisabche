// packages/ui/src/lib/utils/chart.ts
import type { ChartDataPoint } from "../../components/ui/dashboard/sales-chart";

export function aggregateDataPoints(
  data: ChartDataPoint[],
  targetCount: number
): ChartDataPoint[] {
  const chunkSize = Math.ceil(data.length / targetCount);
  const result: ChartDataPoint[] = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    
    // اگر chunk خالی است، ادامه بده
    if (chunk.length === 0) continue;
    
    const avgValue = chunk.reduce((sum, d) => sum + d.value, 0) / chunk.length;
    const middleIndex = Math.floor(chunk.length / 2);
    
    // ✅ استفاده از non-null assertion چون chunk خالی نیست
    const middlePoint = chunk[middleIndex] || chunk[0]!;
    
    result.push({
      label: middlePoint.label,
      value: avgValue,
      date: middlePoint.date,
    });
  }
  
  return result;
}