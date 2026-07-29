"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, FileText } from "lucide-react";
import { InvoiceDocument, type InvoiceDocumentData } from "../invoice-document";

/* ═══════════════════════════════════════════════════════════
   PublicInvoiceContainer — read-only, no-login invoice view.
   Fetches GET /api/public/invoices/:token (no auth header, no
   sidebar/actions requiring login). Used by
   apps/web/app/[lang]/public-invoice/[token]/page.tsx
   ═══════════════════════════════════════════════════════════ */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.hisabche.com/api";

interface PublicInvoiceResponse {
  id: string;
  invoiceNumber?: string;
  date: string;
  dueDate?: string | null;
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
  paidAmount?: number;
  currency: string;
  notes?: string | null;
  customer?: { full_name?: string; phone?: string; email?: string; address?: string } | null;
  items: Array<{
    id?: string;
    product_name?: string;
    quantity?: number;
    unit_price?: number;
    discount?: number;
    total_price?: number;
  }>;
}

export function PublicInvoiceContainer({ token }: { token: string }) {
  const t = useTranslations();
  const [data, setData] = useState<PublicInvoiceResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`${BASE_URL}/public/invoices/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("not ok");
        return res.json();
      })
      .then((json: PublicInvoiceResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const safeT = (key: string, fallback?: string) => {
    const v = t(key);
    return v && v !== key ? v : (fallback ?? key);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[hsl(var(--color-primary))]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <FileText className="size-16 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-lg text-[hsl(var(--fg-secondary))]">
          {safeT("invoices.notFound", "فاکتور پیدا نشد")}
        </p>
      </div>
    );
  }

  const documentData: InvoiceDocumentData = {
    invoiceNumber: data.invoiceNumber,
    date: data.date,
    dueDate: data.dueDate,
    business: { name: safeT("app.name", "Hisabche") },
    customer: data.customer
      ? {
          name: data.customer.full_name ?? null,
          phone: data.customer.phone ?? null,
          email: data.customer.email ?? null,
          address: data.customer.address ?? null,
        }
      : null,
    items: (data.items || []).map((item, i) => ({
      id: item.id ?? String(i),
      productName: item.product_name ?? "",
      quantity: item.quantity ?? 0,
      unitPrice: item.unit_price ?? 0,
      discount: item.discount ?? 0,
      totalPrice: item.total_price ?? 0,
    })),
    currency: data.currency,
    subtotal: data.subtotal,
    discountTotal: data.discountTotal ?? 0,
    taxTotal: data.taxTotal ?? 0,
    total: data.total,
    paidAmount: data.paidAmount ?? 0,
    notes: data.notes,
    // ⚠️ no invoiceId/publicToken passed here on purpose — this is
    // already the public view; the document shouldn't render another
    // QR pointing back at itself.
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <InvoiceDocument
        t={safeT}
        data={documentData}
        display={{ showSignature: true, showNotes: true, showBarcode: false }}
      />
      <p className="text-center text-sm text-[hsl(var(--fg-tertiary))]">
        {safeT("invoices.publicFooter", "این فاکتور توسط حسابچه صادر شده")}
      </p>
    </div>
  );
}
