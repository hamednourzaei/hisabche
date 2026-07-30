// packages/ui/src/components/ui/workflow/approvals-view.tsx
"use client";

import { memo, type ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   ApprovalsView — پیور presentational، بدون hook داده‌ای
   جواب یک جمله می‌دهد: «آمدم اینجا چون می‌خواهم ببینم چه چیزی منتظر تأیید من است»
   ═══════════════════════════════════════════════════════════════════════════ */

interface ApprovalsViewProps {
  t: (key: string, fallback?: string) => string;
  isLoading: boolean;
  isEmpty: boolean;
  cards: ReactNode[];
}

export const ApprovalsView = memo(function ApprovalsView({
  t,
  isLoading,
  isEmpty,
  cards,
}: ApprovalsViewProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t("nav.approvals", "در انتظار تأیید شما")}
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-12 text-center">
          <ClipboardCheck className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
          <p className="text-[hsl(var(--fg-secondary))]">
            {t("nav.approvals_empty", "چیزی در انتظار تأیید شما نیست")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">{cards}</div>
      )}
    </div>
  );
});

ApprovalsView.displayName = "ApprovalsView";
