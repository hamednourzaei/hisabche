// packages/ui/src/components/ui/customers/customer-interactions-tab.tsx
"use client"

import { Phone, Mail, MessageSquare, Calendar, FileText, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomerInteractionsTabProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  interactions: any[]
}

const cardBase = "rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm"
const outlineBtn = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none"

const iconMap: Record<string, any> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Calendar,
  note: FileText,
}

const iconColors: Record<string, string> = {
  call: "bg-[hsl(var(--color-info)/0.1)] text-[hsl(var(--color-info))]",
  email: "bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]",
  sms: "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]",
  meeting: "bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]",
  note: "bg-[hsl(var(--fg-tertiary)/0.1)] text-[hsl(var(--fg-secondary))]",
}

export function CustomerInteractionsTab({ t, fmt, interactions }: CustomerInteractionsTabProps) {
  return (
    <div className={cn(cardBase, "animate-fade-in-up")}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border-default))]">
        <h3 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
          {t("customers.interactions", "تعاملات")}
        </h3>
        <button type="button" className={outlineBtn}>
          <Plus className="size-4" aria-hidden="true" />
          {t("customers.addInteraction", "افزودن")}
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {interactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
              <Phone className="size-6 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t("customers.noInteractions", "هنوز تعاملی ثبت نشده")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interactions.map((interaction: any) => {
              const Icon = iconMap[interaction.type] || FileText
              const colorClass = iconColors[interaction.type] || iconColors.note
              
              return (
                <div
                  key={interaction.id}
                  className="flex gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4"
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", colorClass)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                        {interaction.subject || interaction.type}
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-tertiary))] shrink-0">
                        {new Date(
                          interaction.interactionDate || 
                          interaction.interaction_date || 
                          interaction.created_at
                        ).toLocaleDateString('fa-IR')}
                      </p>
                    </div>
                    {interaction.content && (
                      <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))] line-clamp-2">
                        {interaction.content}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}