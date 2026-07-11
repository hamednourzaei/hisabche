// apps/web/app/[lang]/reset-password/ResetPasswordClient.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Lock, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import { apiClient } from "@hisabche/api";

export function ResetPasswordClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(t("auth.invalidToken", "لینک نامعتبر یا منقضی شده است"));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !token) return;

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch", "رمز عبور با تکرارش مطابقت ندارد"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordMinLength", "رمز عبور حداقل ۸ حرف باشد"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await apiClient.post("/auth/reset-password", {
        token,
        password,
      });

      if (data?.message) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || t("auth.invalidToken", "لینک نامعتبر یا منقضی شده است"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className={cn(
            "mb-6 inline-flex items-center gap-2 text-sm font-medium",
            "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          )}
        >
          <ArrowLeft className="size-4" />
          {t("action.back", "بازگشت به ورود")}
        </button>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)]">
            {success ? (
              <CheckCircle className="size-8 text-[hsl(var(--color-success))]" />
            ) : token ? (
              <Lock className="size-8 text-[hsl(var(--color-primary))]" />
            ) : (
              <XCircle className="size-8 text-[hsl(var(--color-destructive))]" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {success
              ? t("auth.resetSuccess", "رمز عبور با موفقیت تغییر کرد")
              : token
                ? t("auth.resetPassword", "بازنشانی رمز عبور")
                : t("auth.invalidToken", "لینک نامعتبر")}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {success
              ? t("auth.redirectingToLogin", "در حال انتقال به صفحه ورود...")
              : token
                ? t("auth.enterNewPassword", "رمز عبور جدید خود را وارد کنید")
                : t("auth.tokenExpired", "این لینک منقضی شده یا قبلاً استفاده شده است")}
          </p>
        </div>

        {/* Form */}
        {token && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 size-5 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.newPassword", "رمز عبور جدید")}
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

            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 size-5 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("auth.confirmPassword", "تکرار رمز عبور")}
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
              disabled={loading || !password || !confirmPassword}
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
              {t("auth.resetPassword", "بازنشانی رمز عبور")}
            </button>
          </form>
        )}

        {/* Invalid token — back to login */}
        {!token && !success && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
                "text-sm font-bold text-white",
                "bg-[hsl(var(--color-primary))]",
                "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
                "transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              )}
            >
              {t("action.back", "بازگشت به ورود")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}