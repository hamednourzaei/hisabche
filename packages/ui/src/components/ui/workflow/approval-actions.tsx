// ============================================
// packages/ui/src/components/ui/workflow/approval-actions.tsx
// Hisabche v1.2 — Approve / Reject buttons with reason modal
// ✅ Memoized · Performance Optimized
// Generic — works with any entity type
// ============================================

"use client";

import { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type WorkflowAction = "approved" | "rejected" | "cancelled";

interface ApprovalActionsProps {
  instanceId: string;
  isPending: boolean;
  onAction: (action: WorkflowAction, comment?: string) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  disabled?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Reject Modal (با memo)
   ═══════════════════════════════════════════════════════════════ */

const RejectModal = memo(function RejectModal({
  open,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  loading: boolean;
  t: (key: string, fallback?: string) => string;
}) {
  const [comment, setComment] = useState("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[hsl(var(--surface-base)/0.8)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl",
          "border border-[hsl(var(--border-default))]",
          "bg-[hsl(var(--surface-elevated))]",
          "shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
          "p-6 space-y-4"
        )}
      >
        {/* Title */}
        <h3
          id="reject-modal-title"
          className="text-lg font-bold text-[hsl(var(--fg-primary))]"
        >
          {t("workflow.rejectReason", "دلیل رد درخواست")}
        </h3>

        {/* Description */}
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t(
            "workflow.rejectDescription",
            "لطفاً دلیل رد این درخواست را توضیح دهید."
          )}
        </p>

        {/* Textarea */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t(
            "workflow.rejectPlaceholder",
            "مثلاً: مبلغ فاکتور با قرارداد مطابقت ندارد..."
          )}
          rows={3}
          autoFocus
          className={cn(
            "w-full rounded-xl p-3 text-sm resize-none",
            "border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-base))]",
            "text-[hsl(var(--fg-primary))]",
            "placeholder:text-[hsl(var(--fg-tertiary))]",
            "focus:outline-none focus:border-[hsl(var(--color-destructive)/0.5)]",
            "focus:ring-1 focus:ring-[hsl(var(--color-destructive)/0.3)]",
            "transition-colors duration-200"
          )}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex items-center rounded-full px-4",
              "min-h-[44px] sm:min-h-[40px]",
              "text-sm font-medium",
              "text-[hsl(var(--fg-secondary))]",
              "hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150"
            )}
          >
            {t("action.cancel", "انصراف")}
          </button>

          {/* Confirm reject */}
          <button
            type="button"
            disabled={!comment.trim() || loading}
            onClick={() => onConfirm(comment)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5",
              "min-h-[44px] sm:min-h-[40px]",
              "text-sm font-bold text-white",
              "bg-[hsl(var(--color-destructive))]",
              "transition-all duration-200",
              "hover:brightness-110 active:scale-[0.98]",
              "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
            {t("workflow.confirmReject", "تأیید رد")}
          </button>
        </div>
      </div>
    </div>
  );
});

RejectModal.displayName = "RejectModal";

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT (با memo)
   ═══════════════════════════════════════════════════════════════ */

export const ApprovalActions = memo(function ApprovalActions({
  instanceId,
  isPending,
  onAction,
  t,
  disabled = false,
}: ApprovalActionsProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<WorkflowAction | null>(null);

  const handleAction = useCallback(
    async (action: WorkflowAction) => {
      setLoading(action);
      try {
        await onAction(action, action === "rejected" ? comment : undefined);
        setComment("");
        setShowRejectModal(false);
      } finally {
        setLoading(null);
      }
    },
    [onAction, comment]
  );

  const handleCloseModal = useCallback(() => {
    setShowRejectModal(false);
    setComment("");
  }, []);

  const handleConfirmReject = useCallback(
    (commentText: string) => {
      handleAction("rejected");
    },
    [handleAction]
  );

  const isDisabled = disabled || !isPending || loading !== null;

  return (
    <>
      {/* Action buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Approve */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => handleAction("approved")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5",
            "min-h-[44px] sm:min-h-[40px]",
            "text-sm font-bold text-white",
            "bg-[hsl(var(--color-success))]",
            "shadow-sm shadow-[hsl(var(--color-success)/0.2)]",
            "transition-all duration-200",
            "hover:brightness-110 active:scale-[0.98]",
            "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
            "motion-reduce:transition-none motion-reduce:active:scale-100",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {loading === "approved" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          {t("workflow.approve", "تأیید")}
        </button>

        {/* Reject */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => setShowRejectModal(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5",
            "min-h-[44px] sm:min-h-[40px]",
            "text-sm font-bold",
            "border border-[hsl(var(--color-destructive)/0.3)]",
            "text-[hsl(var(--color-destructive))]",
            "bg-transparent",
            "hover:bg-[hsl(var(--color-destructive)/0.08)]",
            "active:bg-[hsl(var(--color-destructive)/0.12)]",
            "transition-colors duration-150",
            "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none",
            "motion-reduce:transition-none",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <X className="size-4" aria-hidden="true" />
          {t("workflow.reject", "رد")}
        </button>
      </div>

      {/* Reject reason modal */}
      <RejectModal
        open={showRejectModal}
        onClose={handleCloseModal}
        onConfirm={handleConfirmReject}
        loading={loading === "rejected"}
        t={t}
      />
    </>
  );
});

ApprovalActions.displayName = "ApprovalActions";