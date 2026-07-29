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

// ─── Simple functional fallback with hooks ─────────────────────────────────
function ErrorFallback({ onReset }: { onReset: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-destructive)/0.1)]">
          <AlertTriangle className="size-8 text-[hsl(var(--color-destructive))]" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[hsl(var(--fg-primary))]">
          {t("error.title")}
        </h2>
        <p className="mb-6 text-sm text-[hsl(var(--fg-secondary))]">
          {t("error.description")}
        </p>
        <button type="button" onClick={onReset}
          className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2.5", "text-sm font-medium", "border border-[hsl(var(--border-default))]", "text-[hsl(var(--fg-secondary))]", "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]", "transition-colors duration-150", "motion-reduce:transition-none")}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("action.retry")}
        </button>
      </div>
    </div>
  );
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
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

export { ErrorBoundary };