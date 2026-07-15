// apps/web/app/[lang]/forgot-password/ForgotPasswordClient.tsx
"use client";

import { useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { apiClient } from "@hisabche/api";

/* ═══════════════════════════════════════════════════════════════════════════
   ForgotPasswordClient v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · UX بهبود
   ═══════════════════════════════════════════════════════════════════════════ */

export const ForgotPasswordClient = memo(function ForgotPasswordClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedEmail = email.trim();
      if (!trimmedEmail) return;

      setLoading(true);
      setError("");

      try {
        await apiClient.post("/auth/forgot-password", { email: trimmedEmail });
        setSent(true);
      } catch {
        // ✅ Still show success to prevent email enumeration
        setSent(true);
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      if (error) setError("");
    },
    [error]
  );

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleGoToLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          type="button"
          onClick={handleGoBack}
          className={cn(
            "mb-6 inline-flex items-center gap-2 text-sm font-medium",
            "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          )}
        >
          <ArrowLeft className="size-4" />
          {t("action.back", "بازگشت")}
        </button>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)]">
            {sent ? (
              <CheckCircle className="size-8 text-[hsl(var(--color-success))]" />
            ) : (
              <Mail className="size-8 text-[hsl(var(--color-primary))]" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {sent
              ? t("auth.resetLinkSent", "لینک ارسال شد")
              : t("auth.forgotPassword", "فراموشی رمز عبور")}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {sent
              ? t("auth.checkEmail", "لطفاً ایمیل خود را بررسی کنید. لینک بازنشانی تا ۱ ساعت معتبر است.")
              : t("auth.enterEmailForReset", "ایمیل خود را وارد کنید تا لینک بازنشانی برای شما ارسال شود")}
          </p>
        </div>

        {/* Form */}
        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 size-5 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder={t("auth.email", "ایمیل")}
                autoFocus
                required
                className={cn(
                  "w-full rounded-xl ps-10 pe-4 py-3 text-sm",
                  "border-2 border-[hsl(var(--border-default))]",
                  "bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]",
                  "placeholder:text-[hsl(var(--fg-tertiary))]",
                  "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]",
                  "transition-colors duration-200"
                )}
              />
            </div>

            {error && (
              <p className="text-sm text-[hsl(var(--color-destructive))]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
                "text-sm font-bold text-white",
                "bg-[hsl(var(--color-primary))]",
                "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
                "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("auth.sendResetLink", "ارسال لینک بازنشانی")}
            </button>
          </form>
        )}

        {/* Back to login */}
        <p className="mt-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
          <button
            type="button"
            onClick={handleGoToLogin}
            className="text-[hsl(var(--color-primary))] hover:underline font-semibold"
          >
            {t("action.back", "بازگشت به ورود")}
          </button>
        </p>
      </div>
    </div>
  );
});

ForgotPasswordClient.displayName = "ForgotPasswordClient";