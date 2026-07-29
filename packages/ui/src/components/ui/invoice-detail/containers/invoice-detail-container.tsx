"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useInvoice,
  useWorkspaces,
  useWorkflowInstance,
  useWorkflowInstanceDetail,
  useWorkflow,
  usePerformWorkflowAction,
} from "@hisabche/api";
import {
  InvoiceDetailPage,
  type InvoiceDetailDisplay,
} from "../invoice-detail-page";
import InvoicePDFDownload from "../InvoicePDFDownload";
import { useQueryClient } from "@tanstack/react-query";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const STATUS_MAP: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  completed: "success",
  pending: "warning",
  partial: "secondary",
  cancelled: "destructive",
};

const getField = <T,>(a: T | undefined, b: T | undefined): T | undefined =>
  a ?? b;

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface WorkflowActionRecord {
  id: string;
  action: "approved" | "rejected" | "forwarded" | "cancelled";
  step_order: number;
  actor_user_id: string;
  actor_role?: string | null;
  comment?: string | null;
  created_at: string;
}

interface WorkflowStep {
  step_order: number;
  approver_role: string;
  is_final: boolean;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function InvoiceDetailContainer() {
  const t = useTranslations();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const documentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [exportingPNG, setExportingPNG] = useState(false);

  const { data: invoice, isLoading } = useInvoice(id);

  // ✅ فرض تک-workspace: اولین workspace کاربر — برای نمایش لوگو/مهر کسب‌وکار روی فاکتور
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = Array.isArray(workspaces)
    ? (workspaces[0] as { name?: string; logo_url?: string | null; stamp_url?: string | null } | undefined)
    : undefined;

  // ✅ FIX: قبلاً این سه کوئری مستقیم با supabaseClient (anon key) زده
  // می‌شد که هیچ session واقعی‌ای ندارد (auth واقعی از بک‌اند ماست، نه
  // Supabase Auth سمت کلاینت) — همین باعث ۴۰۱ Unauthorized می‌شد.
  // حالا از هوک‌های آماده که از apiClient (توکن backend) رد می‌شوند
  // استفاده می‌کند.
  const { data: workflowInstanceBase } = useWorkflowInstance("invoice", id ?? "");
  const { data: workflowDetail } = useWorkflowInstanceDetail(workflowInstanceBase?.id ?? "");
  const { data: workflowTemplate } = useWorkflow(workflowInstanceBase?.workflow_id ?? "");
  const { mutateAsync: performWorkflowAction } = usePerformWorkflowAction();

  const workflowData = useMemo(() => {
    if (!workflowInstanceBase) return null;
    return {
      instance: workflowInstanceBase,
      steps: (workflowTemplate?.steps ?? []) as WorkflowStep[],
      actions: (workflowDetail?.actions ?? []) as WorkflowActionRecord[],
    };
  }, [workflowInstanceBase, workflowTemplate, workflowDetail]);

  // ✅ FIX: استفاده از unknown به عنوان واسط
  const display: InvoiceDetailDisplay | null = useMemo(() => {
    if (!invoice) return null;
    const inv = invoice as unknown as Record<string, unknown>;
    const customer = (inv.customer as Record<string, unknown> | null) ?? null;
    return {
      id: inv.id as string,
      publicToken: (getField(inv.publicToken, inv.public_token) as string | undefined) ?? undefined,
      invoiceNumber:
        (getField(inv.invoiceNumber, inv.invoice_number) as string) ?? "",
      date: inv.date as string,
      dueDate:
        (getField(inv.dueDate, inv.due_date) as string | undefined) ?? null,
      status: inv.status as string,
      currency: (inv.currency as string) ?? "AFN",
      subtotal: (inv.subtotal as number) ?? 0,
      total: (inv.total as number) ?? 0,
      customerName:
        (getField(inv.customerName, inv.customer_name) as string) ?? "",
      customerPhone: (customer?.phone as string | undefined) ?? null,
      customerEmail: (customer?.email as string | undefined) ?? null,
      customerAddress: (customer?.address as string | undefined) ?? null,
      discountTotal:
        (getField(inv.discountTotal, inv.discount_total) as number) ?? 0,
      taxTotal: (getField(inv.taxTotal, inv.tax_total) as number) ?? 0,
      paidAmount:
        (getField(inv.paidAmount, inv.paid_amount) as number) ?? 0,
      createdAt:
        (getField(inv.createdAt, inv.created_at) as string) ??
        (inv.date as string),
      updatedAt:
        (getField(inv.updatedAt, inv.updated_at) as string | undefined) ??
        undefined,
      notes: (inv.notes as string | undefined) ?? null,
      // ✅ نام/لوگو/مهر کسب‌وکار از workspace فعلی کاربر خوانده می‌شود؛
      // در نبود workspace به نام اپ در کامپوننت سند fallback می‌شود.
      businessName: currentWorkspace?.name,
      businessLogoUrl: currentWorkspace?.logo_url ?? null,
      businessStampUrl: currentWorkspace?.stamp_url ?? null,
      items: (
        (inv.items as unknown[]) ??
        (inv.invoiceItems as unknown[]) ??
        (inv.invoice_items as unknown[]) ??
        []
      ).map((item: any) => ({
        id: item.id,
        productName: item.productName ?? item.product_name,
        product_name: item.product_name,
        quantity: item.quantity,
        // ⚠️ واحد (unit) در جدول invoice_items ذخیره نمی‌شود؛ عمداً
        // undefined می‌ماند تا کامپوننت سند به‌جای جعل داده، «—» نشان دهد.
        unit: item.unit,
        discount: item.discount ?? 0,
        unitPrice: item.unitPrice ?? item.unit_price,
        unit_price: item.unit_price,
        totalPrice: item.totalPrice ?? item.total_price,
        total_price: item.total_price,
      })),
    };
  }, [invoice, currentWorkspace]);

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key);
      return v && v !== key ? v : (fallback ?? key);
    },
    [t]
  );

  const buildMessage = useCallback(
    (inv: Record<string, unknown>) =>
      `🧾 ${t("invoices.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n📅 ${new Date(inv.date as string).toLocaleDateString("fa-AF")}\n${getField(inv.customerName, inv.customer_name) ? `👤 ${getField(inv.customerName, inv.customer_name)}\n` : ""}💰 *${((inv.total as number) ?? 0).toLocaleString()} ${(inv.currency as string) || "AFN"}*\n📌 ${t(`invoices.${(inv.status as string) || "pending"}`)}`,
    [t]
  );

  const handlePrint = useCallback(() => {
    if (!documentRef.current) return;
    const content = documentRef.current.innerHTML;
    let styles = "";
    document
      .querySelectorAll("style, link[rel='stylesheet']")
      .forEach((el) => {
        styles += el.outerHTML;
      });
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />${styles}</head><body style="margin:20px;print-color-adjust:exact">${content}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  }, []);

  const handleExportPNG = useCallback(async () => {
    if (!documentRef.current || exportingPNG) return;
    try {
      setExportingPNG(true);
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(documentRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `invoice-${id ?? "hisabche"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert(t("invoices.pngError"));
    } finally {
      setExportingPNG(false);
    }
  }, [exportingPNG, id, t]);

  const handleSharePDF = useCallback(async () => {
    if (!invoice) return;
    const inv = invoice as unknown as Record<string, unknown>;
    const text = buildMessage(inv).replace(
      /\*/g,
      ""
    );
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${(inv).invoiceNumber}`,
          text,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      alert(t("invoices.copiedToClipboard"));
    }
  }, [invoice, buildMessage, t]);

  const handleWhatsApp = useCallback(() => {
    if (!invoice) return;
    const inv = invoice as unknown as Record<string, unknown>;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(buildMessage(inv))}`,
      "_blank"
    );
  }, [invoice, buildMessage]);

  const handleTelegram = useCallback(() => {
    if (!invoice) return;
    const inv = invoice as unknown as Record<string, unknown>;
    window.open(
      `https://t.me/share/url?url=&text=${encodeURIComponent(buildMessage(inv))}`,
      "_blank"
    );
  }, [invoice, buildMessage]);

  const handleEmail = useCallback(() => {
    if (!invoice) return;
    const inv = invoice as unknown as Record<string, unknown>;
    window.open(
      `mailto:?subject=${encodeURIComponent(`${t("invoices.title")} #${getField(inv.invoiceNumber, inv.invoice_number)}`)}&body=${encodeURIComponent(`${t("invoices.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n${t("invoices.date")}: ${new Date(inv.date as string).toLocaleDateString("fa-AF")}\n${t("invoices.total")}: ${((inv.total as number) ?? 0).toLocaleString()} ${(inv.currency as string) || "AFN"}`)}`,
      "_blank"
    );
  }, [invoice, t]);

  const statusVariant = useCallback(
    (s: string) => STATUS_MAP[s] || "secondary",
    []
  );

  const handleWorkflowAction = useCallback(
    async (action: "approved" | "rejected" | "cancelled", comment?: string) => {
      if (!workflowInstanceBase?.id) return;
      await performWorkflowAction({ instanceId: workflowInstanceBase.id, action, ...(comment !== undefined && { comment }) });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
    [performWorkflowAction, workflowInstanceBase, queryClient, id]
  );

  return (
    <InvoiceDetailPage
      t={safeT}
      invoice={display}
      isLoading={isLoading}
      onBack={() => router.back()}
      onPrint={handlePrint}
      onSharePDF={handleSharePDF}
      onWhatsApp={handleWhatsApp}
      onTelegram={handleTelegram}
      onEmail={handleEmail}
      onExportPNG={handleExportPNG}
      exportingPNG={exportingPNG}
      pdfDownloadSlot={invoice ? <InvoicePDFDownload invoice={invoice} /> : null}
      documentRef={documentRef}
      statusVariant={statusVariant}
      workflowInstance={workflowData?.instance ?? null}
      workflowActions={workflowData?.actions ?? []}
      workflowSteps={workflowData?.steps ?? []}
      workflowPending={workflowData?.instance?.status === "in_progress"}
      onWorkflowAction={handleWorkflowAction}
    />
  );
}