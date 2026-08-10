// packages/ui/src/components/ui/chart.tsx
'use client'

// کامپوننت رسمی chart از shadcn/ui — روی recharts ساخته شده است.
// عمداً MUI اضافه نشد چون یک کتابخانه‌ی UI کاملاً جدید به باندل تحمیل می‌کرد،
// در حالی که recharts از قبل در پروژه استفاده می‌شود.

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '../../lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
  }
>

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }
  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          'flex justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick_text]:fill-[hsl(var(--fg-tertiary))]',
          '[&_.recharts-cartesian-grid_line]:stroke-[hsl(var(--border-default))]',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-[hsl(var(--border-strong))]',
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          '[&_.recharts-layer]:outline-none',
          '[&_.recharts-sector]:outline-none',
          '[&_.recharts-surface]:outline-none',
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

// رنگ هر سری را به‌صورت متغیر CSS (--color-<key>) در دسترس می‌گذارد تا در
// recharts با fill/stroke="var(--color-<key>)" قابل استفاده باشد.
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, cfg]) => cfg.color)
  if (!colorConfig.length) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colorConfig
          .map(([key, cfg]) => (cfg.color ? `  --color-${key}: ${cfg.color};` : null))
          .filter(Boolean)
          .join('\n')}\n}`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    active?: boolean | undefined
    payload?: any[] | undefined
    label?: any
    hideLabel?: boolean | undefined
    hideIndicator?: boolean | undefined
    indicator?: 'line' | 'dot' | undefined
    labelFormatter?: ((value: any, payload: any[]) => React.ReactNode) | undefined
    formatter?: ((value: any, name: any, item: any) => React.ReactNode) | undefined
    labelKey?: string | undefined
  }
>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      formatter,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart()

    if (!active || !payload?.length) return null

    const rawLabel = labelKey ? payload[0]?.payload?.[labelKey] : label
    const resolvedLabel = labelFormatter ? labelFormatter(rawLabel, payload) : rawLabel

    return (
      <div
        ref={ref}
        className={cn(
          'min-w-[8rem] rounded-xl border px-3 py-2 shadow-lg',
          'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md',
          className,
        )}
      >
        {!hideLabel && resolvedLabel != null ? (
          <p className="mb-1 text-[11px] text-[hsl(var(--fg-tertiary))]">{resolvedLabel}</p>
        ) : null}
        <div className="grid gap-1">
          {payload.map((item: any, index: number) => {
            const key = String(item.dataKey ?? item.name ?? 'value')
            const itemConfig = config[key]
            const indicatorColor = item.color || itemConfig?.color

            return (
              <div key={`${key}-${index}`} className="flex w-full items-center gap-2">
                {!hideIndicator ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-[2px]',
                      indicator === 'dot' ? 'h-2.5 w-2.5' : 'h-0.5 w-3',
                    )}
                    style={{ backgroundColor: indicatorColor }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="text-[11px] text-[hsl(var(--fg-secondary))]">
                  {itemConfig?.label ?? item.name}
                </span>
                <span className="ms-auto font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                  {formatter ? formatter(item.value, item.name, item) : item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    payload?: any[] | undefined
    verticalAlign?: 'top' | 'bottom' | undefined
    hideIcon?: boolean | undefined
    onToggle?: ((dataKey: string) => void) | undefined
    hidden?: string[] | undefined
  }
>(
  (
    { className, payload, verticalAlign = 'bottom', hideIcon = false, onToggle, hidden = [] },
    ref,
  ) => {
    const { config } = useChart()
    const hiddenKeys: string[] = hidden
    if (!payload?.length) return null

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className,
        )}
      >
        {payload.map((item: any) => {
          const key = String(item.dataKey ?? item.value ?? 'value')
          const itemConfig = config[key]
          const isHidden = hiddenKeys.includes(key)

          const content = (
            <>
              {!hideIcon ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
              ) : null}
              {itemConfig?.label ?? key}
            </>
          )

          // وقتی onToggle داده شود، لجند تعاملی می‌شود (کلیک = نمایش/مخفی‌کردن سری)
          return onToggle ? (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={!isHidden}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-opacity',
                'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
                'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]',
                isHidden && 'opacity-40',
              )}
            >
              {content}
            </button>
          ) : (
            <span
              key={key}
              className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--fg-secondary))]"
            >
              {content}
            </span>
          )
        })}
      </div>
    )
  },
)
ChartLegendContent.displayName = 'ChartLegendContent'

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
