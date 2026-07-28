// apps/web/app/[lang]/accept-invite/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiClient } from "@hisabche/api";
import { useAuthStore } from "@hisabche/store";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   AcceptInvitePage v2 — SaaS-Level · Production-Ready · Memoized
   ✅ memo · useCallback · useMemo · AbortController · RTL-ready
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ─────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "success" | "error";

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
  message?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getErrorMessage(err: ApiError, t: (key: string, fallback?: string) => string): string {
  if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  if (err?.message) {
    return err.message;
  }
  return t("workspace.inviteExpired", "لینک دعوت منقضی شده یا نامعتبر است.");
}

function extractToken(params: URLSearchParams): string | null {
  return params.get("token");
}

// ─── Status Components ─────────────────────────────────────────────────────

const StatusIcon = memo(function StatusIcon({
  status,
}: {
  status: Status;
}) {
  if (status === "loading") {
    return (
      <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--color-primary)/0.1)] flex items-center justify-center">
        <Loader2 className="size-8 text-[hsl(var(--color-primary))] animate-spin" />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--color-success)/0.15)] flex items-center justify-center">
        <CheckCircle className="size-8 text-[hsl(var(--color-success))]" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--color-destructive)/0.15)] flex items-center justify-center">
        <XCircle className="size-8 text-[hsl(var(--color-destructive))]" />
      </div>
    );
  }

  return null;
});
StatusIcon.displayName = "StatusIcon";

// ─── Main Component ────────────────────────────────────────────────────────

const AcceptInvitePage = memo(function AcceptInvitePage() {
  const { t: tOriginal } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();

  // ✅ safeT wrapper
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // ✅ Extract token with useMemo
  const token = useMemo(() => extractToken(params), [params]);

  // ✅ Accept invite handler with AbortController
  const handleAcceptInvite = useCallback(async () => {
    if (!token) {
      setStatus("error");
      setMessage(t("workspace.inviteInvalidToken", "لینک دعوت نامعتبر است."));
      return;
    }

    setStatus("loading");

    // ✅ Create abort controller
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      // ✅ FIX: قبلاً سشن را از سرویس Supabase مستقیم چک می‌کرد، اما
      // لاگین واقعی برنامه (useAuthStore) از بک‌اند سفارشی خودمان است
      // و هرگز سشن Supabase نمی‌سازد — یعنی این چک همیشه false بود و
      // بعد از لاگین موفق دوباره کاربر را به /login برمی‌گرداند
      // (حلقه‌ی بی‌نهایت). حالا از همان store واقعی auth چک می‌شود.
      const isAuthenticated = useAuthStore.getState().isAuthenticated;

      if (!isAuthenticated) {
        // ✅ Redirect to login with return URL
        const redirectUrl = `/login?redirect=${encodeURIComponent(
          `/accept-invite?token=${token}`
        )}`;
        router.push(redirectUrl);
        controller.abort();
        return;
      }

      // ✅ Accept invite
      await apiClient.post(
        "/workspaces/accept-invite",
        { token },
        { signal }
      );

      setStatus("success");
      setMessage(
        t(
          "workspace.inviteAccepted",
          "دعوت با موفقیت پذیرفته شد! در حال انتقال به ورک‌اسپیس..."
        )
      );

      // ✅ Redirect after success
      setTimeout(() => {
        router.push("/workspace");
      }, 2000);
    } catch (err) {
      // ✅ Ignore abort errors
      if ((err as Error).name === "AbortError") {
        return;
      }

      const error = err as ApiError;
      setStatus("error");
      setMessage(getErrorMessage(error, t));
    } finally {
      // ✅ Cleanup
      controller.abort();
    }
  }, [token, router, t]);

  // ✅ Effect with cleanup
  useEffect(() => {
    handleAcceptInvite();

    // ✅ Cleanup: abort any pending request
    return () => {
      // The abort controller is handled inside handleAcceptInvite
    };
  }, [handleAcceptInvite]);

  // ✅ Navigation handlers
  const handleGoToWorkspace = useCallback(() => {
    router.push("/workspace");
  }, [router]);

  const handleRetry = useCallback(() => {
    setStatus("idle");
    setMessage("");
    handleAcceptInvite();
  }, [handleAcceptInvite]);

  // ✅ Loading state (initial)
  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center space-y-4">
          <StatusIcon status="loading" />
          <p className="text-lg text-[hsl(var(--fg-secondary))]">
            {t("workspace.inviteChecking", "در حال بررسی دعوت...")}
          </p>
        </div>
      </div>
    );
  }

  // ✅ Success state
  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <StatusIcon status="success" />
          <p className="text-lg font-bold text-[hsl(var(--color-success))]">
            {message}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <Loader2 className="size-4 animate-spin" />
            {t("workspace.redirecting", "در حال انتقال...")}
          </div>
        </div>
      </div>
    );
  }

  // ✅ Error state
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <StatusIcon status="error" />
        <div>
          <p className="text-lg font-bold text-[hsl(var(--color-destructive))]">
            {t("workspace.inviteError", "خطا")}
          </p>
          <p className="text-sm text-[hsl(var(--fg-secondary))] mt-2">
            {message}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            className={cn(
              "inline-flex items-center justify-center gap-2",
              "rounded-full px-6 py-2.5 text-sm font-bold",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-all duration-200",
            )}
          >
            <Loader2 className="size-4" />
            {t("action.retry", "تلاش مجدد")}
          </button>

          <button
            onClick={handleGoToWorkspace}
            className={cn(
              "inline-flex items-center justify-center gap-2",
              "rounded-full px-6 py-2.5 text-sm font-bold",
              "bg-[hsl(var(--color-primary))] text-white",
              "hover:brightness-110 active:scale-[0.98]",
              "transition-all duration-200",
            )}
          >
            {t("workspace.goToWorkspace", "رفتن به ورک‌اسپیس")}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

AcceptInvitePage.displayName = "AcceptInvitePage";

export default AcceptInvitePage;