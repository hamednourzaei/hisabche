"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoices, useDeleteInvoice } from "@hisabche/api"
import { Button, Badge, Card, CardContent, EmptyState, Input } from "@hisabche/ui"
import { Plus, Search, Trash2, Eye, FileText } from "lucide-react"
import type { InvoiceFilters } from "@hisabche/validation"

interface Invoice {
  id?: string; _id?: string; invoiceId?: string; invoice_id?: string
  invoiceNumber?: string; invoice_number?: string
  date?: string; status?: string; total?: number; currency?: string
}

export function InvoicesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1, limit: 10, sortDirection: "desc" })
  const { data, isLoading } = useInvoices(filters)
  const deleteInvoice = useDeleteInvoice()

  const statusVariant = (status: string): "success" | "warning" | "destructive" | "secondary" => {
    const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
      completed: "success", pending: "warning", partial: "secondary", cancelled: "destructive",
    }
    return map[status] || "secondary"
  }

  const getInvId = (inv: Invoice): string => inv.id ?? inv._id ?? inv.invoiceId ?? inv.invoice_id ?? ""
  const goToInvoice = (inv: Invoice) => { const i = getInvId(inv); if (i) router.push(`/invoices/${i}`) }
  const handleDelete = (e: React.MouseEvent, inv: Invoice) => { e.stopPropagation(); const i = getInvId(inv); if (i) deleteInvoice.mutate(i) }
  const invoices: Invoice[] = (data?.invoices as Invoice[]) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("faktoor.title")}</h1>
          <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">{t("faktoor.description", "مدیریت و مشاهده فاکتورها")}</p>
        </div>
        <Button onClick={() => router.push("/quick-invoice")} icon={<Plus className="size-4" />}>{t("faktoor.newFaktoor")}</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input placeholder={t("action.search")} leftIcon={<Search className="size-4" />} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} className="max-w-sm" />
        <Button variant="outline" size="sm" onClick={() => setFilters({ page: 1, limit: 10, sortDirection: "desc" })}>{t("action.clear")}</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-shimmer h-44" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState icon="invoice" title={t("faktoor.noFaktoors")} description={t("faktoor.noFaktoorsDesc", "هنوز هیچ فاکتوری ثبت نشده است.")} action={{ label: t("faktoor.newFaktoor"), onClick: () => router.push("/quick-invoice") }} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invoices.map((inv: Invoice) => (
            <div key={inv.id ?? inv._id ?? Math.random()} onClick={() => goToInvoice(inv)} className="cursor-pointer">
              <Card className="interactive-card h-full">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--hisab-primary)]/10">
                        <FileText className="size-5 text-[var(--hisab-primary)]" />
                      </div>
                      <div>
                        <p className="font-semibold">#{inv.invoiceNumber ?? inv.invoice_number ?? "???"}</p>
                        <p className="text-xs text-[var(--hisab-muted-fg)]">{inv.date ? new Date(inv.date).toLocaleDateString("fa-AF") : ""}</p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(inv.status ?? "")} size="sm">{t(`faktoor.${inv.status}`)}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--hisab-muted-fg)]">{t("faktoor.total")}</p>
                    <p className="text-2xl font-bold">{(inv.total ?? 0)?.toLocaleString()} {inv.currency ?? "AFN"}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" className="ghost-btn" onClick={(e) => { e.stopPropagation(); goToInvoice(inv) }}><Eye className="size-4" /></button>
                    <button type="button" className="ghost-btn ghost-danger" onClick={(e) => handleDelete(e, inv)}><Trash2 className="size-4" /></button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {data && (data.total ?? 0) > 10 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="outline" size="sm" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}>{t("action.previous")}</Button>
          <span className="text-sm text-[var(--hisab-muted-fg)]">{filters.page} / {Math.ceil((data.total ?? 0) / 10)}</span>
          <Button variant="outline" size="sm" disabled={(filters.page ?? 1) * 10 >= (data.total ?? 0)} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>{t("action.next")}</Button>
        </div>
      )}
    </div>
  )
}