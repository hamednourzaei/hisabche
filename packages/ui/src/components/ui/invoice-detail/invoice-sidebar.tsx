"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "../switch";
import {
  Printer,
  Share2,
  MessageCircle,
  Send,
  Mail,
  Image as ImageIcon,
} from "lucide-react";
import type { InvoiceDocumentDisplaySettings } from "./invoice-document";

/* ═══════════════════════════════════════════════════════════
   InvoiceSidebar — status + actions + payment summary + metadata
   + display-settings toggles. Used on the invoice detail page
   (full) and reused (trimmed, no actions/metadata) by the
   quick-invoice preview step.
   ═══════════════════════════════════════════════════════════ */

export interface InvoiceSidebarStatus {
  status: string;
  variant: "success" | "warning" | "destructive" | "secondary";
}

export interface InvoiceSidebarActions {
  onPrint?: (() => void) | undefined;
  onSharePDF?: (() => void) | undefined;
  onWhatsApp?: (() => void) | undefined;
  onTelegram?: (() => void) | undefined;
  onEmail?: (() => void) | undefined;
  onExportPNG?: (() => void) | undefined;
  exportingPNG?: boolean | undefined;
  pdfDownloadSlot?: ReactNode;
}

export interface InvoiceSidebarMetadata {
  invoiceNumber?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface InvoiceSidebarSummary {
  total: number;
  paidAmount: number;
  currency: string;
}

export interface InvoiceSidebarProps {
  t: (key: string, fallback?: string) => string;
  statusInfo?: InvoiceSidebarStatus | null;
  summary: InvoiceSidebarSummary;
  metadata?: InvoiceSidebarMetadata | null;
  actions?: InvoiceSidebarActions | null;
  display: InvoiceDocumentDisplaySettings;
  onDisplayChange: (key: keyof InvoiceDocumentDisplaySettings, value: boolean) => void;
  locale?: string;
}

const statusBadgeStyles: Record<string, string> = {
  success: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  destructive: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  secondary: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

const outlineBtn = "inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed";

const fmtDate = (d: string, locale: string) => {
  try {
    return `${new Date(d).toLocaleDateString(locale)} ${new Date(d).toLocaleTimeString(locale)}`;
  } catch {
    return d;
  }
};

// ✅ FIX: قبلاً یک سویچ دستی جداگانه با همان باگ rtl:/translate-x
// کامپوننت مشترک (packages/ui/.../switch.tsx) اینجا کپی شده بود —
// حالا از همان کامپوننت مشترک (که با inset-inline-start درست شد)
// استفاده می‌شود تا یک پیاده‌سازی سویچ در کل پروژه وجود داشته باشد.
const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
    <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} size="sm" />
  </label>
);

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
    <p className="mb-3 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{title}</p>
    {children}
  </div>
);

export function InvoiceSidebar({
  t,
  statusInfo,
  summary,
  metadata,
  actions,
  display,
  onDisplayChange,
  locale = "fa-AF",
}: InvoiceSidebarProps) {
  const remaining = summary.total - summary.paidAmount;

  return (
    <div className="space-y-4">
      {statusInfo && (
        <div className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{t("common.status", "وضعیت")}</span>
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", statusBadgeStyles[statusInfo.variant] ?? statusBadgeStyles.secondary)}>
            {t(`invoices.${statusInfo.status}`, statusInfo.status)}
          </span>
        </div>
      )}

      {actions && (
        <Card title={t("invoices.actions", "عملیات")}>
          <div className="space-y-2">
            {actions.pdfDownloadSlot}
            {actions.onExportPNG && (
              <button type="button" onClick={actions.onExportPNG} disabled={actions.exportingPNG} className={outlineBtn}>
                <ImageIcon className="size-4" />
                {actions.exportingPNG ? t("invoices.exporting", "در حال خروجی...") : t("invoices.exportPNG", "خروجی تصویر")}
              </button>
            )}
            {actions.onPrint && (
              <button type="button" onClick={actions.onPrint} className={outlineBtn}>
                <Printer className="size-4" />
                {t("action.print", "چاپ")}
              </button>
            )}
            {actions.onSharePDF && (
              <button type="button" onClick={actions.onSharePDF} className={outlineBtn}>
                <Share2 className="size-4" />
                {t("action.share", "اشتراک‌گذاری")}
              </button>
            )}
            {actions.onWhatsApp && (
              <button type="button" onClick={actions.onWhatsApp} className={outlineBtn}>
                <MessageCircle className="size-4" />
                WhatsApp
              </button>
            )}
            {actions.onTelegram && (
              <button type="button" onClick={actions.onTelegram} className={outlineBtn}>
                <Send className="size-4" />
                Telegram
              </button>
            )}
            {actions.onEmail && (
              <button type="button" onClick={actions.onEmail} className={outlineBtn}>
                <Mail className="size-4" />
                {t("action.email", "ایمیل")}
              </button>
            )}
          </div>
        </Card>
      )}

      <Card title={t("invoices.paymentSummary", "خلاصه پرداخت")}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--fg-secondary))]">{t("invoices.total", "مجموع")}</span>
            <span className="font-bold tabular-nums text-[hsl(var(--fg-primary))]">{summary.total.toLocaleString()} {summary.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--fg-secondary))]">{t("invoices.paid", "پرداخت شده")}</span>
            <span className="font-medium tabular-nums text-[hsl(var(--color-success))]">{summary.paidAmount.toLocaleString()} {summary.currency}</span>
          </div>
          <div className="flex justify-between border-t border-[hsl(var(--border-default))] pt-2">
            <span className="text-[hsl(var(--fg-secondary))]">{t("invoices.remaining", "باقیمانده")}</span>
            <span className={cn("font-bold tabular-nums", remaining > 0 ? "text-[hsl(var(--color-destructive))]" : "text-[hsl(var(--color-success))]")}>
              {remaining.toLocaleString()} {summary.currency}
            </span>
          </div>
        </div>
      </Card>

      {metadata && (
        <Card title={t("invoices.metadata", "اطلاعات فاکتور")}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--fg-secondary))]">{t("invoices.invoiceNumber", "شماره فاکتور")}</span>
              <span className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">{metadata.invoiceNumber ? `#${metadata.invoiceNumber}` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--fg-secondary))]">{t("invoices.createdAt", "تاریخ ثبت")}</span>
              <span className="text-[hsl(var(--fg-primary))]">{metadata.createdAt ? fmtDate(metadata.createdAt, locale) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--fg-secondary))]">{t("invoices.updatedAt", "آخرین بروزرسانی")}</span>
              <span className="text-[hsl(var(--fg-primary))]">{metadata.updatedAt ? fmtDate(metadata.updatedAt, locale) : "—"}</span>
            </div>
          </div>
        </Card>
      )}

      <Card title={t("invoices.displaySettings", "تنظیمات نمایش")}>
        <Toggle
          label={t("invoices.showSignature", "نمایش امضا")}
          checked={display.showSignature}
          onChange={(v) => onDisplayChange("showSignature", v)}
        />
        <Toggle
          label={t("invoices.showNotes", "نمایش یادداشت")}
          checked={display.showNotes}
          onChange={(v) => onDisplayChange("showNotes", v)}
        />
        <Toggle
          label={t("invoices.showBarcode", "نمایش بارکد")}
          checked={display.showBarcode}
          onChange={(v) => onDisplayChange("showBarcode", v)}
        />
      </Card>
    </div>
  );
}
