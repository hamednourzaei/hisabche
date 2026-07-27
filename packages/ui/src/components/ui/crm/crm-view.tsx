// packages/ui/src/components/ui/crm/crm-view.tsx
"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCurrency } from "../../../hooks/use-currency";
import { Handshake, MessageSquare, Briefcase, Plus, X } from "lucide-react";
import { CustomerPicker } from "../customer-picker";
import type { Interaction, Opportunity } from "@hisabche/api";

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CrmView — Memoized · Performance Optimized
   ✅ memo · props صریح · بدون hook داده‌ای مستقیم
   ═══════════════════════════════════════════════════════════════════════════ */

export type CrmTabId = "interactions" | "opportunities";

interface CrmViewProps {
  t: (key: string, fallback?: string) => string;
  activeTab: CrmTabId;
  onTabChange: (tab: CrmTabId) => void;
  interactions: Interaction[];
  opportunities: Opportunity[];
  isLoading: boolean;
  error?: string | null;
  isCreatingInteraction: boolean;
  onCreateInteraction: (input: { customerId: string; type: string; subject: string; content: string }) => Promise<void>;
}

const INTERACTION_TYPES = ["call", "meeting", "email", "note"] as const;

const STAGE_BADGE_MAP: Record<string, string> = {
  lead: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]",
  qualified: "bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]",
  proposal: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
  negotiation: "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]",
  closed_won: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
  closed_lost: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
};

function formatDate(date?: string): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("fa-AF", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export const CrmView = memo(function CrmView({
  t,
  activeTab,
  onTabChange,
  interactions,
  opportunities,
  isLoading,
  error,
  isCreatingInteraction,
  onCreateInteraction,
}: CrmViewProps) {
  const { format: formatMoney } = useCurrency();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [type, setType] = useState<string>("call");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!customer || !subject.trim()) return;
    await onCreateInteraction({ customerId: customer.id, type, subject: subject.trim(), content: content.trim() });
    setCustomer(null);
    setType("call");
    setSubject("");
    setContent("");
    setIsFormOpen(false);
  }, [customer, type, subject, content, onCreateInteraction]);

  const stageLabel = useMemo(
    () => (stage: string) => {
      const map: Record<string, string> = {
        lead: t("crm.stage.lead", "سرنخ"),
        qualified: t("crm.stage.qualified", "واجد شرایط"),
        proposal: t("crm.stage.proposal", "پیشنهاد"),
        negotiation: t("crm.stage.negotiation", "مذاکره"),
        closed_won: t("crm.stage.closedWon", "موفق"),
        closed_lost: t("crm.stage.closedLost", "ناموفق"),
      };
      return map[stage] || stage;
    },
    [t]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Handshake className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t("nav.followUp", "پیگیری فروش")}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border-default))]">
        <button
          type="button"
          onClick={() => onTabChange("interactions")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "interactions"
              ? "border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]"
              : "border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          )}
        >
          <MessageSquare className="size-4" />
          {t("crm.tabs.interactions", "تعاملات")}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("opportunities")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "opportunities"
              ? "border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]"
              : "border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          )}
        >
          <Briefcase className="size-4" />
          {t("crm.tabs.opportunities", "فرصت‌های فروش")}
        </button>
        {activeTab === "interactions" && (
          <button
            type="button"
            onClick={() => setIsFormOpen((v) => !v)}
            className="ms-auto mb-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 transition-all"
          >
            {isFormOpen ? <X className="size-4" /> : <Plus className="size-4" />}
            {t("crm.interactions.new", "تعامل جدید")}
          </button>
        )}
      </div>

      {/* New Interaction Form */}
      {activeTab === "interactions" && isFormOpen && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-4">
          <CustomerPicker
            value={customer}
            onChange={setCustomer}
            placeholder={t("customer.pickPlaceholder", "انتخاب مشتری...")}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
            >
              {INTERACTION_TYPES.map((it) => (
                <option key={it} value={it}>
                  {t(`crm.interactions.type.${it}`, it)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("crm.interactions.subject", "موضوع")}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("crm.interactions.contentPlaceholder", "توضیحات (اختیاری)")}
            rows={2}
            className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))] resize-none"
          />
          <button
            type="button"
            disabled={!customer || !subject.trim() || isCreatingInteraction}
            onClick={handleSubmit}
            className="w-full rounded-full px-5 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 disabled:opacity-40 transition-all"
          >
            {t("crm.interactions.create", "ثبت تعامل")}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center text-[hsl(var(--color-destructive))]">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            ))}
          </div>
        ) : activeTab === "interactions" ? (
          interactions.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
              <p className="text-[hsl(var(--fg-secondary))]">
                {t("crm.interactions.empty", "هیچ تعاملی ثبت نشده")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("crm.interactions.subject", "موضوع")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("crm.interactions.type", "نوع")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                      {t("crm.interactions.date", "تاریخ")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {interactions.map((interaction) => (
                    <tr
                      key={interaction.id}
                      className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">{interaction.subject}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">{interaction.type}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                        {formatDate(interaction.interactionDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : opportunities.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">
              {t("crm.opportunities.empty", "هیچ فرصت فروشی ثبت نشده")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("crm.opportunities.title", "عنوان")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("crm.opportunities.stage", "مرحله")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("crm.opportunities.value", "ارزش")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs hidden sm:table-cell">
                    {t("crm.opportunities.probability", "احتمال")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs hidden md:table-cell">
                    {t("crm.opportunities.expectedCloseDate", "تاریخ تخمینی")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opportunity) => (
                  <tr
                    key={opportunity.id}
                    className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">{opportunity.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          STAGE_BADGE_MAP[opportunity.stage] || STAGE_BADGE_MAP.lead
                        )}
                      >
                        {stageLabel(opportunity.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                      {formatMoney(opportunity.value)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden sm:table-cell">
                      {opportunity.probability}%
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden md:table-cell whitespace-nowrap">
                      {formatDate(opportunity.expectedCloseDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

CrmView.displayName = "CrmView";
