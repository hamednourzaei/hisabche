// packages/ui/src/components/ui/baqidari/baqidari-customer-list.tsx
"use client"

import { Card, CardContent } from "../card"
import { Button } from "../button"
import { Badge } from "../badge"
import { User, DollarSign } from "lucide-react"
import type { CustomerWithDebt } from "../../../lib/baqidari/baqidari-types"

interface BaqidariCustomerListProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  customers: CustomerWithDebt[]
  onSelectCustomer: (id: string) => void
  onPaymentClick: (customer: CustomerWithDebt, e: React.MouseEvent) => void
}

export function BaqidariCustomerList({
  t,
  fmt,
  customers,
  onSelectCustomer,
  onPaymentClick,
}: BaqidariCustomerListProps) {
  return (
    <div className="space-y-3">
      {customers.map((customer) => {
        const hasDebt = (customer.totalDebt ?? 0) > 0
        const customerName = customer.fullName || customer.name || ""
        
        return (
          <Card
            key={customer.id}
            className="interactive-card cursor-pointer border-border hover:border-primary/30 transition-all"
            onClick={() => onSelectCustomer(customer.id)}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    hasDebt ? "bg-rose-500/10" : "bg-emerald-500/10"
                  }`}
                >
                  <User
                    className={`size-5 ${
                      hasDebt ? "text-rose-500" : "text-emerald-500"
                    }`}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {customerName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant={hasDebt ? "destructive" : "success"}>
                      {hasDebt
                        ? t("baqidari.debtor", "بدهکار")
                        : t("baqidari.settled", "تسویه")}
                    </Badge>
                    {(customer.openCount ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {customer.openCount} {t("baqidari.openDeals", "معامله باز")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ms-3 flex shrink-0 items-center gap-3">
                {hasDebt && (
                  <div className="text-end">
                    <p className="font-bold tabular-nums text-rose-500">
                      {fmt(customer.totalDebt ?? 0)} AFN
                    </p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => onPaymentClick(customer, e)}
                  aria-label={`${t("baqidari.recordPaymentFor", "ثبت پرداخت برای")} ${customerName}`}
                >
                  <DollarSign className="size-4 text-emerald-500" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}