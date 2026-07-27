"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useInvoice } from "@hisabche/api";
import {
  InvoiceDetailPage,
  type InvoiceDetailDisplay,
} from "../invoice-detail-page";
import InvoicePDFDownload from "../InvoicePDFDownload";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@hisabche/auth";

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
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const documentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [exportingPNG, setExportingPNG] = useState(false);

  const { data: invoice, isLoading } = useInvoice(id);

  // ✅ Workflow instance hook — inside component
  const { data: workflowData } = useQuery({
    queryKey: ["workflow-instance", id],
    queryFn: async () => {
      if (!id) return null;

      const { data: instances } = await supabaseClient
        .from("workflow_instances")
        .select("id, status, current_step, total_steps, workflow_id")
        .eq("entity_type", "invoice")
        .eq("entity_id", id)
        .limit(1);

      const instance = instances?.[0];
      if (!instance) return null;

      const { data: steps } = await supabaseClient
        .from("workflow_steps")
        .select("step_order, approver_role, is_final")
        .eq("workflow_id", instance.workflow_id)
        .order("step_order");

      const { data: actions } = await supabaseClient
        .from("workflow_actions")
        .select("*")
        .eq("instance_id", instance.id)
        .order("created_at", { ascending: false });

      return {
        instance: {
          id: instance.id,
          status: instance.status,
          current_step: instance.current_step,
          total_steps: instance.total_steps,
        },
        steps: (steps || []) as WorkflowStep[],
        actions: (actions || []) as WorkflowActionRecord[],
      };
    },
    enabled: !!id,
  });

  const workflowMutation = useMutation({
    mutationFn: async ({
      action,
      comment,
    }: {
      action: "approved" | "rejected" | "cancelled";
      comment?: string;
    }) => {
      const token = (await supabaseClient.auth.getSession()).data.session
        ?.access_token;
      if (!token) throw new Error("No token");

      const body: Record<string, string> = { action };
      if (comment) body.comment = comment;

      const res = await fetch(
        `https://hisabche.onrender.com/api/v1/workflows/instances/${workflowData?.instance?.id}/action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) throw new Error("Failed to perform workflow action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-instance", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    },
  });

  // ✅ FIX: استفاده از unknown به عنوان واسط
  const display: InvoiceDetailDisplay | null = useMemo(() => {
    if (!invoice) return null;
    const inv = invoice as unknown as Record<string, unknown>;
    const customer = (inv.customer as Record<string, unknown> | null) ?? null;
    return {
      id: inv.id as string,
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
      // ✅ نام کسب‌وکار هنوز از هیچ هوکی fetch نمی‌شود (نیازمند
      // شناسایی workspace فعال است) — فعلاً fallback به نام اپ در
      // کامپوننت سند اعمال می‌شود.
      businessName: undefined,
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
  }, [invoice]);

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
      alert(t("invoices.pngError", "خطا در ساخت خروجی تصویر."));
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
      await workflowMutation.mutateAsync({ action, comment: comment ?? "" });
    },
    [workflowMutation]
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