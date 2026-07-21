// packages/ui/src/lib/dashboard/dashboard-utils.ts

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}