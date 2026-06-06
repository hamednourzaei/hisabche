// packages/ui/src/components/ui/invoices/invoices-card.tsx
"use client"

import { Card, CardContent } from "../card"
import { Button } from "../button"
import { Badge } from "../badge"
import { Eye, Trash2, FileText } from "lucide-react"
import type { Invoice } from "../../../lib/invoices/invoices-types"

interface InvoiceCardProps {
  inv: Invoice
  t: (key: string, fallback?: string) => string
  onNavigate: (id: string) => void
  onDelete: (id: string) => void
  statusVariant: (status: string) => "success" | "warning" | "destructive" | "secondary"
}

export function InvoiceCard({ inv, t, onNavigate, onDelete, statusVariant }: InvoiceCardProps) {
  return (
    <div onClick={() => onNavigate(inv.id)} className="cursor-pointer">
      <Card className="interactive-card h-full border-border transition-all hover:border-primary/30">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 text-start">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="size-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  #{inv.invoiceNumber}
                </p>
                <p className="text-xs text-muted-foreground">{inv.date}</p>
              </div>
            </div>
            <Badge variant={statusVariant(inv.status)}>
              {t(`faktoor.${inv.status}`, inv.status)}
            </Badge>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">{t("faktoor.total", "مجموع")}</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {inv.total.toLocaleString()} {inv.currency}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onNavigate(inv.id)
              }}
              aria-label={t("action.view", "مشاهده")}
            >
              <Eye className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(inv.id)
              }}
              aria-label={t("action.delete", "حذف")}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}