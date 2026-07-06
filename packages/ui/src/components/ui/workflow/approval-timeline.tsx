// ============================================
// packages/ui/src/components/ui/workflow/approval-timeline.tsx
// Hisabche v1.1 — Vertical timeline for approval history
// Generic — works with any entity type
// ============================================

"use client";

import { cn } from "@/lib/utils";
import { Check, X, Forward, Clock, User } from "lucide-react";

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

interface ApprovalTimelineProps {
  actions: TimelineAction[];
  steps: TimelineStep[];
  currentStep: number;
  status: string;
  t: (key: string, fallback?: string) => string;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const actionIcons: Record<string, typeof Check> = {
  approved: Check,
  rejected: X,
  forwarded: Forward,
  cancelled: X,
};

const actionColors: Record<string, string> = {
  approved:
    "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  rejected:
    "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  forwarded:
    "bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))] border-[hsl(var(--color-info)/0.2)]",
  cancelled:
    "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))] border-[hsl(var(--border-default))]",
};

const actionLabels: Record<string, string> = {
  approved: "workflow.approved",
  rejected: "workflow.rejected",
  forwarded: "workflow.forwarded",
  cancelled: "workflow.cancelled",
};

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function ApprovalTimeline({
  actions,
  steps,
  currentStep,
  status,
  t,
}: ApprovalTimelineProps) {
  const stepsWithActions = steps.map((step) => {
    const action = actions.find((a) => a.step_order === step.step_order);
    return { ...step, action };
  });

  return (
    <div className="space-y-1">
      {stepsWithActions.map((step, index) => {
        const isActive = step.step_order === currentStep && status === "in_progress";
        const isCompleted = !!step.action?.action && step.action.action !== "rejected";
        const isRejected = step.action?.action === "rejected";
        const isPending = !step.action && !isActive;
        const isLast = index === stepsWithActions.length - 1;

        const IconComponent = step.action
          ? (actionIcons[step.action.action] ?? Clock)
          : isActive
            ? Clock
            : User;

        return (
          <div key={step.step_order} className="relative flex gap-3">
            {/* Vertical line */}
            {!isLast && (
              <div
                className={cn(
                  "absolute top-9 bottom-0 w-0.5",
                  isCompleted
                    ? "bg-[hsl(var(--color-primary)/0.5)]"
                    : "bg-[hsl(var(--border-default))]"
                )}
                style={{ insetInlineStart: 19 }}
              />
            )}

            {/* Icon circle */}
            <div
              className={cn(
                "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                isCompleted &&
                  "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.12)]",
                isActive &&
                  "border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning)/0.12)] animate-pulse",
                isRejected &&
                  "border-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.12)]",
                isPending &&
                  "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]"
              )}
            >
              <IconComponent
                className={cn(
                  "size-4",
                  isCompleted && "text-[hsl(var(--color-success))]",
                  isActive && "text-[hsl(var(--color-warning))]",
                  isRejected && "text-[hsl(var(--color-destructive))]",
                  isPending && "text-[hsl(var(--fg-tertiary))]"
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isCompleted && "text-[hsl(var(--color-success))]",
                    isActive && "text-[hsl(var(--color-warning))]",
                    isRejected && "text-[hsl(var(--color-destructive))]",
                    isPending && "text-[hsl(var(--fg-tertiary))]"
                  )}
                >
                  {t(`roles.${step.approver_role}`, step.approver_role)}
                </span>

                {step.is_final && (
                  <span className="inline-flex items-center rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--color-primary))]">
                    {t("workflow.final", "نهایی")}
                  </span>
                )}
              </div>

              {/* Action badge */}
              {step.action && (
                <div className="mt-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border",
                      actionColors[step.action.action] ?? actionColors.cancelled
                    )}
                  >
                    {t(
                      actionLabels[step.action.action] ?? "workflow.unknown",
                      step.action.action
                    )}
                  </span>
                  <span className="ms-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
                    {formatDateTime(step.action.created_at)}
                  </span>
                </div>
              )}

              {/* Comment */}
              {step.action?.comment && (
                <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))] italic">
                  «{step.action.comment}»
                </p>
              )}

              {/* Pending placeholder */}
              {isPending && !isActive && (
                <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                  {t("workflow.pending", "در انتظار")}
                </p>
              )}

              {isActive && (
                <p className="mt-1 text-xs text-[hsl(var(--color-warning))] font-medium">
                  {t("workflow.inProgress", "در حال بررسی")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}