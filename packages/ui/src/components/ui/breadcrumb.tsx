// packages/ui/src/components/ui/breadcrumb.tsx
"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChevronLeft, Home } from "lucide-react";
import Link from "next/link";

// ─── Route label mapping (i18n keys) ────────────────────────
const ROUTE_LABELS: Record<string, { key: string; fallback: string }> = {
  dashboard: { key: "nav.dashboard", fallback: "داشبورد" },
  godam: { key: "nav.godam", fallback: "ګدام" },
  invoices: { key: "nav.faktoor", fallback: "فاکتورها" },
  baqidari: { key: "nav.baqidari", fallback: "باقی‌داری" },
  hr: { key: "nav.hr", fallback: "منابع انسانی" },
  projects: { key: "nav.projects", fallback: "پروژه‌ها" },
  permissions: { key: "nav.permissions", fallback: "دسترسی‌ها" },
  audit: { key: "nav.audit", fallback: "حسابرسی" },
  workspace: { key: "workspace.title", fallback: "فضای کاری" },
  settings: { key: "nav.settings", fallback: "تنظیمات" },
  "quick-invoice": { key: "quickInvoice.title", fallback: "فاکتور سریع" },
  "sync-center": { key: "sync.title", fallback: "همگام‌سازی" },
  onboarding: { key: "onboarding.title", fallback: "راه‌اندازی" },
};

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  // حذف locale prefix و split
  const segments = pathname
    .replace(/^\/(fa-AF|fa-IR|en)/, "")
    .split("/")
    .filter(Boolean);

  // ساختن breadcrumb items
  const items = segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);

    // اگه UUID هست، "جزئیات" نشون بده
    if (isUUID) {
      return {
        href,
        label: t("common.details", "جزئیات"),
        isLast,
        isClickable: false,
      };
    }

    const routeLabel = ROUTE_LABELS[segment];
    return {
      href,
      label: routeLabel ? t(routeLabel.key, routeLabel.fallback) : segment,
      isLast,
      isClickable: !isLast,
    };
  });

  // اگه فقط dashboard هست، نشون نده
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm", className)}
    >
      {/* Home icon */}
      <Link
        href="/dashboard"
        className="text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
      >
        <Home className="size-4" />
      </Link>

      {items.map((item, index) => (
        <span key={item.href} className="flex items-center gap-1.5">
          {/* Separator */}
          <ChevronLeft className="size-3.5 text-[hsl(var(--fg-tertiary))]" />

          {/* Item */}
          {item.isLast ? (
            <span className="text-[hsl(var(--fg-primary))] font-medium truncate max-w-[200px]">
              {item.label}
            </span>
          ) : item.isClickable ? (
            <Link
              href={item.href}
              className="text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] transition-colors truncate max-w-[150px]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[hsl(var(--fg-secondary))] truncate max-w-[200px]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}