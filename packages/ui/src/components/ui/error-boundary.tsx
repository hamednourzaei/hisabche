"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   ErrorBoundary v3 — i18n-ready (fixed)
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Presentational fallback (بدون هیچ hook ای — هرگز نمی‌تواند throw کند) ──
function FallbackUI({
  title,
  description,
  retry,
  onReset,
  error,
}: {
  title: string;
  description: string;
  retry: string;
  onReset: () => void;
  error?: Error | null | undefined;
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-destructive)/0.1)]">
          <AlertTriangle className="size-8 text-[hsl(var(--color-destructive))]" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[hsl(var(--fg-primary))]">{title}</h2>
        <p className="mb-4 text-sm text-[hsl(var(--fg-secondary))]">{description}</p>
        {error?.message ? (
          <pre className="mb-6 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-3 text-start text-[11px] text-[hsl(var(--fg-secondary))]" dir="ltr">
            {error.name}: {error.message}
          </pre>
        ) : null}
        <button type="button" onClick={onReset}
          className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2.5", "text-sm font-medium", "border border-[hsl(var(--border-default))]", "text-[hsl(var(--fg-secondary))]", "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]", "transition-colors duration-150", "motion-reduce:transition-none")}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {retry}
        </button>
      </div>
    </div>
  );
}

// متن اضطراری وقتی context ترجمه در دسترس نیست.
const STATIC_TEXT = {
  title: "مشکلی پیش آمد",
  description: "در نمایش این بخش خطایی رخ داد. لطفاً دوباره تلاش کنید.",
  retry: "تلاش دوباره",
};

// ✅ FIX: نسخه‌ی ترجمه‌شده useTranslations() صدا می‌زند. اگر این کامپوننت
// بیرون از NextIntlClientProvider رندر شود، useTranslations خودش throw
// می‌کند — و چون این UI خودِ fallback ارور بود، خطا از ErrorBoundary فرار
// می‌کرد و کل سایت سیاه می‌شد. حالا با یک boundary داخلی محافظت شده است.
function TranslatedFallback({ onReset, error }: { onReset: () => void; error?: Error | null | undefined }) {
  const t = useTranslations();
  const tr = (key: string, fallback: string) => {
    try {
      const v = t(key as Parameters<typeof t>[0]);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };
  return (
    <FallbackUI
      title={tr("error.title", STATIC_TEXT.title)}
      description={tr("error.description", STATIC_TEXT.description)}
      retry={tr("action.retry", STATIC_TEXT.retry)}
      onReset={onReset}
      error={error}
    />
  );
}

// boundary داخلی: اگر ترجمه‌ها در دسترس نبودند، متن ثابت نمایش داده می‌شود
// به‌جای این‌که کل اپلیکیشن از کار بیفتد.
class ErrorFallback extends React.Component<
  { onReset: () => void; error?: Error | null | undefined },
  { intlFailed: boolean }
> {
  constructor(props: { onReset: () => void; error?: Error | null | undefined }) {
    super(props);
    this.state = { intlFailed: false };
  }

  static getDerivedStateFromError() {
    return { intlFailed: true };
  }

  render() {
    if (this.state.intlFailed) {
      return <FallbackUI {...STATIC_TEXT} onReset={this.props.onReset} error={this.props.error} />;
    }
    return <TranslatedFallback onReset={this.props.onReset} error={this.props.error} />;
  }
}

// ─── Class component ───────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // ✅ در پروداکشن فقط console.error زنده می‌ماند (removeConsole در
    // next.config همه‌ی console.log ها را حذف می‌کند)، پس عمداً error است.
    console.error(
      "[ErrorBoundary] پیام خطا:", error?.message || "(بدون پیام)",
      "\n[ErrorBoundary] نام:", error?.name,
      "\n[ErrorBoundary] کامپوننتی که کرش کرد:", errorInfo?.componentStack,
      "\n[ErrorBoundary] stack:", error?.stack
    );
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback onReset={this.handleReset} error={this.state.error} />;
    }
    return this.props.children;
  }
}

export { ErrorBoundary };