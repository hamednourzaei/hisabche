"use client";

import { cn } from "@/lib/utils";
import {
  ArrowRight, Printer, Share2, MessageCircle, Send, Mail,
  Loader2, FileText, Calendar, User,
} from "lucide-react";
import InvoicePDFDownload from "./InvoicePDFDownload";
import { ApprovalCard } from "../workflow/approval-timeline";

interface InvoiceItem {
  id?: string; productName?: string; product_name?: string;
  quantity?: number; unitPrice?: number; unit_price?: number;
  totalPrice?: number; total_price?: number;
}

interface TimelineAction {
  id: string; action: "approved" | "rejected" | "forwarded" | "cancelled";
  step_order: number; actor_user_id: string; actor_role?: string | null;
  comment?: string | null; created_at: string;
}

interface TimelineStep { step_order: number; approver_role: string; is_final: boolean; }

export interface InvoiceDetailDisplay {
  id: string; invoiceNumber: string; date: string; status: string; currency: string;
  subtotal: number; total: number; customerName: string; discountTotal: number;
  taxTotal: number; paidAmount: number; createdAt: string; items: InvoiceItem[];
}

export interface InvoiceDetailPageProps {
  t: (key: string, fallback?: string) => string;
  invoice: InvoiceDetailDisplay | null; isLoading: boolean;
  onBack: () => void; onPrint: () => void; onSharePDF: () => void;
  onWhatsApp: () => void; onTelegram: () => void; onEmail: () => void;
  statusVariant: (status: string) => "success" | "warning" | "destructive" | "secondary";
  workflowInstance?: { id: string; status: string; current_step: number; total_steps: number } | null;
  workflowActions?: TimelineAction[]; workflowSteps?: TimelineStep[];
  workflowPending?: boolean;
  onWorkflowAction?: (action: "approved" | "rejected" | "cancelled", comment?: string) => Promise<void>;
}

const statusBadgeStyles: Record<string, string> = {
  success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

const outlineBtn = "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";
const ghostBtn = "inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";

export function InvoiceDetailPage({
  t, invoice, isLoading, onBack, onPrint, onSharePDF, onWhatsApp, onTelegram, onEmail,
  statusVariant, workflowInstance, workflowActions = [], workflowSteps = [],
  workflowPending = false, onWorkflowAction,
}: InvoiceDetailPageProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[hsl(var(--color-primary))]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <FileText className="size-16 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-lg text-[hsl(var(--fg-secondary))]">{t("faktoor.notFound", "فاکتور پیدا نشد")}</p>
        <button type="button" onClick={onBack} className={outlineBtn}>{t("action.back", "بازگشت")}</button>
      </div>
    );
  }

  const { invoiceNumber, date, status, currency, subtotal, total, customerName, discountTotal, taxTotal, paidAmount, createdAt, items } = invoice;
  const badgeStyle = statusBadgeStyles[statusVariant(status)] ?? statusBadgeStyles.secondary;
  const remaining = total - paidAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className={ghostBtn}><ArrowRight className="size-5" /></button>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("faktoor.detail", "جزئیات فاکتور")} #{invoiceNumber}</h1>
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0", badgeStyle)}>{t(`faktoor.${status}`, status)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onWhatsApp} className={outlineBtn}><MessageCircle className="size-4" /><span className="hidden sm:inline">WhatsApp</span></button>
          <button type="button" onClick={onTelegram} className={outlineBtn}><Send className="size-4" /><span className="hidden sm:inline">Telegram</span></button>
          <button type="button" onClick={onEmail} className={outlineBtn}><Mail className="size-4" /><span className="hidden sm:inline">{t("action.email", "ایمیل")}</span></button>
          <button type="button" onClick={onSharePDF} className={outlineBtn}><Share2 className="size-4" /><span className="hidden sm:inline">{t("action.share", "اشتراک")}</span></button>
          <button type="button" onClick={onPrint} className={outlineBtn}><Printer className="size-4" /><span className="hidden sm:inline">{t("action.print", "چاپ")}</span></button>
          <InvoicePDFDownload invoice={invoice} />
        </div>
      </div>

      {/* Workflow Approval Card */}
      {workflowInstance && workflowSteps.length > 0 && onWorkflowAction && (
        <ApprovalCard
          actions={workflowActions}
          steps={workflowSteps}
          currentStep={workflowInstance.current_step}
          status={workflowInstance.status}
          instanceId={workflowInstance.id}
          isPending={workflowPending}
          onAction={onWorkflowAction}
          t={t}
          disabled={workflowInstance.status !== "in_progress"}
        />
      )}

      {/* Invoice Paper */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6 sm:p-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><h2 className="text-3xl font-bold text-[hsl(var(--color-primary))]">Hisabche</h2><p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">hisabche.com</p></div>
            <div className="text-end">
              <p className="text-2xl font-bold text-[hsl(var(--fg-primary))]">#{invoiceNumber}</p>
              <div className="mt-2 space-y-1 text-sm text-[hsl(var(--fg-secondary))]">
                <div className="flex items-center justify-end gap-2"><Calendar className="size-3.5" />{new Date(date).toLocaleDateString("fa-AF")}</div>
                {customerName && <div className="flex items-center justify-end gap-2"><User className="size-3.5" />{customerName}</div>}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[hsl(var(--border-default))]"><th className="px-2 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">#</th><th className="px-2 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">{t("godam.productName", "نام محصول")}</th><th className="px-2 py-3 text-center font-medium text-[hsl(var(--fg-secondary))]">{t("faktoor.quantity", "تعداد")}</th><th className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-secondary))]">{t("faktoor.unitPrice", "قیمت واحد")}</th><th className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-secondary))]">{t("faktoor.totalPrice", "قیمت کل")}</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id || i} className="border-b border-[hsl(var(--border-default))]">
                    <td className="px-2 py-3 text-[hsl(var(--fg-tertiary))]">{i + 1}</td>
                    <td className="px-2 py-3 font-medium text-[hsl(var(--fg-primary))]">{item.productName ?? item.product_name}</td>
                    <td className="px-2 py-3 text-center text-[hsl(var(--fg-primary))]">{item.quantity}</td>
                    <td className="px-2 py-3 text-end tabular-nums text-[hsl(var(--fg-primary))]">{(item.unitPrice ?? item.unit_price)?.toLocaleString()} {currency}</td>
                    <td className="px-2 py-3 text-end font-medium tabular-nums text-[hsl(var(--fg-primary))]">{(item.totalPrice ?? item.total_price)?.toLocaleString()} {currency}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-primary))]">{t("faktoor.subtotal", "جمع")}</td><td className="px-2 py-3 text-end font-medium tabular-nums text-[hsl(var(--fg-primary))]">{subtotal.toLocaleString()} {currency}</td></tr>
                {discountTotal > 0 && <tr><td colSpan={4} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("faktoor.discount", "تخفیف")}</td><td className="px-2 py-2 text-end text-[hsl(var(--color-destructive))] tabular-nums">-{discountTotal.toLocaleString()} {currency}</td></tr>}
                {taxTotal > 0 && <tr><td colSpan={4} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("faktoor.tax", "مالیات")}</td><td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">{taxTotal.toLocaleString()} {currency}</td></tr>}
                <tr className="border-t-2 border-[hsl(var(--border-default))]"><td colSpan={4} className="px-2 py-3 text-end text-lg font-bold text-[hsl(var(--fg-primary))]">{t("faktoor.total", "مجموع")}</td><td className="px-2 py-3 text-end text-lg font-bold text-[hsl(var(--color-primary))] tabular-nums">{total.toLocaleString()} {currency}</td></tr>
                {paidAmount > 0 && <tr><td colSpan={4} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("faktoor.paid", "پرداخت شده")}</td><td className="px-2 py-2 text-end text-[hsl(var(--color-success))] tabular-nums">-{paidAmount.toLocaleString()} {currency}</td></tr>}
                {remaining > 0 && <tr><td colSpan={4} className="px-2 py-2 text-end font-medium text-[hsl(var(--color-destructive))]">{t("faktoor.remaining", "باقیمانده")}</td><td className="px-2 py-2 text-end font-medium text-[hsl(var(--color-destructive))] tabular-nums">{remaining.toLocaleString()} {currency}</td></tr>}
              </tfoot>
            </table>
          </div>
          <div className="mt-8 border-t border-[hsl(var(--border-default))] pt-4 text-center text-sm text-[hsl(var(--fg-secondary))]">
            <p>{t("faktoor.generatedBy", "ایجاد شده توسط")} Hisabche — hisabche.com</p>
            <p className="mt-1">{new Date(createdAt).toLocaleDateString("fa-AF")} {new Date(createdAt).toLocaleTimeString("fa-AF")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}