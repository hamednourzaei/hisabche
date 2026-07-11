// apps/web/app/[lang]/accept-invite/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiClient } from "@hisabche/api";
import { supabaseClient } from "@hisabche/auth";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AcceptInvitePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(t("workspace.inviteInvalidToken", "لینک دعوت نامعتبر است."));
      return;
    }

    const accept = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();

      if (!sessionData.session) {
        router.push(`/login?redirect=/accept-invite?token=${token}`);
        return;
      }

      try {
        await apiClient.post("/workspaces/accept-invite", { token });
        setStatus("success");
        setMessage(t("workspace.inviteAccepted", "دعوت با موفقیت پذیرفته شد! در حال انتقال به ورک‌اسپیس..."));
        setTimeout(() => router.push("/workspace"), 2000);
      } catch (err) {
        const error = err as ApiError;
        setStatus("error");
        setMessage(error?.response?.data?.error || t("workspace.inviteExpired", "لینک دعوت منقضی شده یا نامعتبر است."));
      }
    };

    accept();
  }, [token, router, t]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="text-center space-y-4">
        {status === "loading" && (
          <p className="text-lg text-[hsl(var(--fg-secondary))]">
            {t("workspace.inviteChecking", "در حال بررسی دعوت...")}
          </p>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--color-success)/0.15)] flex items-center justify-center">
              <svg className="size-8 text-[hsl(var(--color-success))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[hsl(var(--color-success))]">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--color-destructive)/0.15)] flex items-center justify-center">
              <svg className="size-8 text-[hsl(var(--color-destructive))]" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4L12 12M12 4L4 12" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[hsl(var(--color-destructive))]">
              {t("workspace.inviteError", "خطا")}
            </p>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{message}</p>
            <button
              onClick={() => router.push("/workspace")}
              className="rounded-full px-6 py-2 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 transition-all duration-200 active:scale-[0.98]"
            >
              {t("workspace.goToWorkspace", "رفتن به ورک‌اسپیس")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}