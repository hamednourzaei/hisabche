// packages/ui/src/components/ui/workflow/approval-card.tsx
"use client";

import { useState, useCallback } from "react";
import { Steps, Button, ButtonGroup, Textarea } from "@chakra-ui/react";
import { Check, X, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface TimelineAction {
  id: string;
  action: "approved" | "rejected" | "forwarded" | "cancelled";
  step_order: number;
  actor_user_id: string;
  actor_role?: string | null;
  comment?: string | null;
  created_at: string;
}

interface TimelineStep {
  step_order: number;
  approver_role: string;
  is_final: boolean;
}

type WorkflowAction = "approved" | "rejected" | "cancelled";

interface ApprovalCardProps {
  actions: TimelineAction[];
  steps: TimelineStep[];
  currentStep: number;
  status: string;
  instanceId: string;
  isPending: boolean;
  onAction: (action: WorkflowAction, comment?: string) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  disabled?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Reject Modal
   ═══════════════════════════════════════════════════════════════ */

function RejectModal({
  open, onClose, onConfirm, loading, t,
}: {
  open: boolean; onClose: () => void; onConfirm: (comment: string) => void; loading: boolean; t: (key: string, fallback?: string) => string;
}) {
  const [comment, setComment] = useState("");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[hsl(var(--surface-base)/0.8)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-[hsl(var(--fg-primary))]">{t("workflow.rejectReason", "دلیل رد درخواست")}</h3>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t("workflow.rejectDescription", "لطفاً دلیل رد را توضیح دهید.")}</p>
        <Textarea
          value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={t("workflow.rejectPlaceholder", "مثلاً: مبلغ فاکتور با قرارداد مطابقت ندارد...")}
          rows={3} autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>{t("action.cancel", "انصراف")}</Button>
          <Button colorPalette="red" disabled={!comment.trim() || loading} onClick={() => onConfirm(comment)}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            {t("workflow.confirmReject", "تأیید رد")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function ApprovalCard({
  actions, steps, currentStep, status, isPending, onAction, t, disabled = false,
}: ApprovalCardProps) {
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState<WorkflowAction | null>(null);

  const completedStep = actions.some(a => a.action === "approved") ? currentStep - 1 : currentStep;
  const isDisabled = disabled || !isPending || loading !== null;

  const handleAction = useCallback(async (action: WorkflowAction, comment?: string) => {
    setLoading(action);
    try { await onAction(action, comment); }
    finally { setLoading(null); setShowReject(false); }
  }, [onAction]);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 sm:p-5 space-y-4">
      <h4 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
        {t("workflow.title", "فرآیند تأیید")}
      </h4>

      <Steps.Root defaultStep={completedStep} count={steps.length} colorPalette="green">
        <Steps.List>
          {steps.map((step, index) => {
            const action = actions.find((a) => a.step_order === step.step_order);
            const isCompleted = action?.action === "approved";
            const isRejected = action?.action === "rejected";
            const isCurrent = step.step_order === currentStep && status === "in_progress";

            return (
              <Steps.Item
                key={step.step_order}
                index={index}
                title={t(`roles.${step.approver_role}`, step.approver_role)}
                className={cn(
                  isCompleted && "text-[hsl(var(--color-success))]",
                  isRejected && "text-[hsl(var(--color-destructive))]",
                  isCurrent && "text-[hsl(var(--color-warning))]",
                )}
              >
                <Steps.Indicator>
                  {isCompleted ? <Check className="size-4" /> : isRejected ? <X className="size-4" /> : isCurrent ? <Clock className="size-4" /> : null}
                </Steps.Indicator>
                <Steps.Title>{t(`roles.${step.approver_role}`, step.approver_role)}</Steps.Title>
                {step.is_final && (
                  <span className="inline-flex items-center rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--color-primary))] ms-2">
                    {t("workflow.final", "نهایی")}
                  </span>
                )}
                <Steps.Separator />
              </Steps.Item>
            );
          })}
        </Steps.List>

        {/* Action details per step */}
        {steps.map((step, index) => {
          const action = actions.find((a) => a.step_order === step.step_order);
          return (
            <Steps.Content key={step.step_order} index={index}>
              {action ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-[hsl(var(--fg-secondary))]">
                    {t(`workflow.${action.action}`, action.action)} — {formatDateTime(action.created_at)}
                  </p>
                  {action.comment && (
                    <p className="text-xs text-[hsl(var(--fg-tertiary))] italic">«{action.comment}»</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[hsl(var(--fg-tertiary))]">
                  {step.step_order === currentStep ? t("workflow.inProgress", "در حال بررسی") : t("workflow.pending", "در انتظار")}
                </p>
              )}
            </Steps.Content>
          );
        })}

        <Steps.CompletedContent>
          <p className="text-sm text-[hsl(var(--color-success))] font-medium">{t("workflow.completed", "همه مراحل تکمیل شد")}</p>
        </Steps.CompletedContent>
      </Steps.Root>

      {/* Action Buttons */}
      {isPending && (
        <div className="flex gap-2 pt-2">
          <Button
            colorPalette="green"
            disabled={isDisabled}
            onClick={() => handleAction("approved")}
            className="flex-1"
          >
            {loading === "approved" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {t("workflow.approve", "تأیید")}
          </Button>
          <Button
            colorPalette="red"
            variant="outline"
            disabled={isDisabled}
            onClick={() => setShowReject(true)}
            className="flex-1"
          >
            <X className="size-4" />
            {t("workflow.reject", "رد")}
          </Button>
        </div>
      )}

      <RejectModal
        open={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={(comment) => handleAction("rejected", comment)}
        loading={loading === "rejected"}
        t={t}
      />
    </div>
  );
}