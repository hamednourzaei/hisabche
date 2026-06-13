import { type LucideIcon } from "lucide-react";

type StockTone = "default" | "success" | "warning" | "destructive";

interface StockStatsCardProps {
  value: number | string;
  label: string;
  icon: LucideIcon;
  tone?: StockTone;
}

const toneMap: Record<
  StockTone,
  { bg: string; icon: string; bar: string }
> = {
  default: {
    bg: "hsl(var(--surface-muted))",
    icon: "hsl(var(--fg-primary))",
    bar: "hsl(var(--color-primary))",
  },
  success: {
    bg: "hsl(var(--color-success)/0.12)",
    icon: "hsl(var(--color-success))",
    bar: "hsl(var(--color-success))",
  },
  warning: {
    bg: "hsl(var(--color-warning)/0.12)",
    icon: "hsl(var(--color-warning))",
    bar: "hsl(var(--color-warning))",
  },
  destructive: {
    bg: "hsl(var(--color-destructive)/0.12)",
    icon: "hsl(var(--color-destructive))",
    bar: "hsl(var(--color-destructive))",
  },
};

export function StockStatsCard({
  value,
  label,
  icon: Icon,
  tone = "default",
}: StockStatsCardProps) {
  const colors = toneMap[tone];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] transition-shadow duration-200 hover:shadow-[var(--ledger-shadow,0_4px_24px_rgba(0,0,0,0.12))]"
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 inset-x-0 h-1"
        style={{ background: colors.bar }}
      />

      <div className="flex items-center gap-3 p-4">
        {/* Icon container */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: colors.bg }}
        >
          <Icon className="size-5" style={{ color: colors.icon }} aria-hidden="true" />
        </div>

        {/* Value + Label */}
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))] truncate">
            {value}
          </p>
          <p className="text-xs text-[hsl(var(--fg-secondary))] truncate">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}