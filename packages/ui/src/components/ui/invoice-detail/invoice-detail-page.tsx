"use client";

import { useState, type RefObject } from "react";
import { ArrowRight, Loader2, FileText } from "lucide-react";
import { ApprovalCard } from "../workflow/approval-timeline";
import {
  InvoiceDocument,
  type InvoiceDocumentData,
  type InvoiceDocumentDisplaySettings,
} from "./invoice-document";
import { InvoiceSidebar, type InvoiceSidebarActions } from "./invoice-sidebar";

interface InvoiceItem {
  id?: string | undefined; productName?: string | undefined; product_name?: string | undefined;
  quantity?: number | undefined; unit?: string | undefined; discount?: number | undefined;
  unitPrice?: number | undefined; unit_price?: number | undefined;
  totalPrice?: number | undefined; total_price?: number | undefined;
}

interface TimelineAction {
  id: string; action: "approved" | "rejected" | "forwarded" | "cancelled";
  step_order: number; actor_user_id: string; actor_role?: string | null;
  comment?: string | null; created_at: string;
}

interface TimelineStep { step_order: number; approver_role: string; is_final: boolean; }

export interface InvoiceDetailDisplay {
  id: string; invoiceNumber: string; date: string; dueDate?: string | null | undefined; status: string; currency: string;
  subtotal: number; total: number; customerName: string;
  customerPhone?: string | null | undefined; customerEmail?: string | null | undefined; customerAddress?: string | null | undefined;
  discountTotal: number; taxTotal: number; paidAmount: number;
  createdAt: string; updatedAt?: string | undefined; notes?: string | null | undefined;
  businessName?: string | undefined; items: InvoiceItem[];
}

export interface InvoiceDetailPageProps {
  t: (key: string, fallback?: string) => string;
  invoice: InvoiceDetailDisplay | null; isLoading: boolean;
  onBack: () => void; onPrint: () => void; onSharePDF: () => void;
  onWhatsApp: () => void; onTelegram: () => void; onEmail: () => void;
  onExportPNG?: () => void; exportingPNG?: boolean;
  pdfDownloadSlot?: React.ReactNode;
  documentRef?: RefObject<HTMLDivElement>;
  statusVariant: (status: string) => "success" | "warning" | "destructive" | "secondary";
  workflowInstance?: { id: string; status: string; current_step: number; total_steps: number } | null;
  workflowActions?: TimelineAction[]; workflowSteps?: TimelineStep[];
  workflowPending?: boolean;
  onWorkflowAction?: (action: "approved" | "rejected" | "cancelled", comment?: string) => Promise<void>;
}

const ghostBtn = "inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";
const outlineBtn = "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none";

const DEFAULT_DISPLAY: InvoiceDocumentDisplaySettings = {
  showSignature: true,
  showNotes: true,
  showBarcode: true,
};

export function InvoiceDetailPage({
  t, invoice, isLoading, onBack, onPrint, onSharePDF, onWhatsApp, onTelegram, onEmail,
  onExportPNG, exportingPNG, pdfDownloadSlot, documentRef,
  statusVariant, workflowInstance, workflowActions = [], workflowSteps = [],
  workflowPending = false, onWorkflowAction,
}: InvoiceDetailPageProps) {
  const [display, setDisplay] = useState<InvoiceDocumentDisplaySettings>(DEFAULT_DISPLAY);

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
        <p className="text-lg text-[hsl(var(--fg-secondary))]">{t("invoices.notFound", "فاکتور پیدا نشد")}</p>
        <button type="button" onClick={onBack} className={outlineBtn}>{t("action.back", "بازگشت")}</button>
      </div>
    );
  }

  const {
    invoiceNumber, date, dueDate, status, currency, subtotal, total, customerName,
    customerPhone, customerEmail, customerAddress, discountTotal, taxTotal, paidAmount,
    createdAt, updatedAt, notes, businessName, items,
  } = invoice;

  const documentData: InvoiceDocumentData = {
    invoiceNumber,
    date,
    dueDate,
    business: { name: businessName || t("app.name", "Hisabche") },
    customer: customerName || customerPhone || customerEmail || customerAddress
      ? { name: customerName, phone: customerPhone, email: customerEmail, address: customerAddress }
      : null,
    items: items.map((item, i) => ({
      id: item.id ?? String(i),
      productName: item.productName ?? item.product_name ?? "",
      quantity: item.quantity ?? 0,
      unit: item.unit,
      unitPrice: item.unitPrice ?? item.unit_price ?? 0,
      discount: item.discount ?? 0,
      totalPrice: item.totalPrice ?? item.total_price ?? 0,
    })),
    currency,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    paidAmount,
    notes,
  };

  const actions: InvoiceSidebarActions = {
    onPrint,
    onSharePDF,
    onWhatsApp,
    onTelegram,
    onEmail,
    onExportPNG,
    exportingPNG,
    pdfDownloadSlot,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 no-print">
        <button type="button" onClick={onBack} className={ghostBtn}><ArrowRight className="size-5" /></button>
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("invoices.detail", "جزئیات فاکتور")} #{invoiceNumber}</h1>
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

      {/* Document + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoiceDocument ref={documentRef} t={t} data={documentData} display={display} />
        </div>
        <div className="no-print lg:col-span-1">
          <InvoiceSidebar
            t={t}
            statusInfo={{ status, variant: statusVariant(status) }}
            summary={{ total, paidAmount, currency }}
            metadata={{ invoiceNumber, createdAt, updatedAt }}
            actions={actions}
            display={display}
            onDisplayChange={(key, value) => setDisplay((prev) => ({ ...prev, [key]: value }))}
          />
        </div>
      </div>
    </div>
  );
}
