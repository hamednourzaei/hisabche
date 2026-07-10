"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@hisabche/store";

/* ═══════════════════════════════════════════════════════════════════════════
   SaveIndicator v3 — i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SaveIndicatorProps {
  show?: boolean;
  message?: string;
}

const SaveIndicator: React.FC<SaveIndicatorProps> = ({ show = false, message }) => {
  const { t } = useTranslation();
  const { saveStatus } = useSyncStore();
  const isVisible = saveStatus !== "idle" || show;
  if (!isVisible) return null;

  return (
    <div role="status" aria-live="polite" className="fixed start-1/2 top-4 z-50 -translate-x-1/2">
      <div className={cn("flex items-center gap-2 rounded-full px-4 py-2.5", "text-sm font-medium", "shadow-lg", "bg-[hsl(var(--surface-elevated))]", "border border-[hsl(var(--border-strong))]")}>
        {saveStatus === "saving" || (show && saveStatus === "idle") ? (
          <>
            <Loader2 className="size-4 animate-spin text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <span className="text-[hsl(var(--fg-secondary))]">{message || t("common.saving", "در حال ذخیره...")}</span>
          </>
        ) : saveStatus === "saved" ? (
          <>
            <Check className="size-4 text-[hsl(var(--color-success))]" aria-hidden="true" />
            <span className="text-[hsl(var(--color-success))]">{message || t("common.saved", "ذخیره شد")}</span>
          </>
        ) : null}
      </div>
    </div>
  );
};

export { SaveIndicator };