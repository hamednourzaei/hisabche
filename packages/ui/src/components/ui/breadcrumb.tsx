// packages/ui/src/components/ui/breadcrumb.tsx
"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Breadcrumb as ChakraBreadcrumb } from "@chakra-ui/react";
import { ChevronLeft, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, { key: string; fallback: string }> = {
  dashboard: { key: "nav.dashboard", fallback: "داشبورد" },
  warehouse: { key: "nav.warehouse", fallback: "انبار" },
  invoices: { key: "nav.invoices", fallback: "فاکتورها" },
  customers: { key: "nav.customers", fallback: "مشتریان" },
  "human-resources": { key: "nav.human-resources", fallback: "منابع انسانی" },
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

  const segments = pathname
    .replace(/^\/(fa-AF|fa-IR|en)/, "")
    .split("/")
    .filter(Boolean);

  const items = segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);

    if (isUUID) {
      return { href, label: t("common.details", "جزئیات"), isLast };
    }

    const routeLabel = ROUTE_LABELS[segment];
    return {
      href,
      label: routeLabel ? t(routeLabel.key, routeLabel.fallback) : segment,
      isLast,
    };
  });

  if (items.length <= 1) return null;

  return (
    <ChakraBreadcrumb.Root className={className}>
      <ChakraBreadcrumb.List gap="1.5">
        {/* Home */}
        <ChakraBreadcrumb.Item>
          <ChakraBreadcrumb.Link asChild>
            <Link href="/dashboard" className="flex items-center gap-1">
              <Home className="size-4" />
            </Link>
          </ChakraBreadcrumb.Link>
        </ChakraBreadcrumb.Item>
        <ChakraBreadcrumb.Separator>
          <ChevronLeft className="size-3.5" />
        </ChakraBreadcrumb.Separator>

        {items.map((item, index) => (
          <ChakraBreadcrumb.Item key={item.href}>
            {index === items.length - 1 ? (
              <ChakraBreadcrumb.CurrentLink>{item.label}</ChakraBreadcrumb.CurrentLink>
            ) : (
              <>
                <ChakraBreadcrumb.Link asChild>
                  <Link href={item.href}>{item.label}</Link>
                </ChakraBreadcrumb.Link>
                <ChakraBreadcrumb.Separator>
                  <ChevronLeft className="size-3.5" />
                </ChakraBreadcrumb.Separator>
              </>
            )}
          </ChakraBreadcrumb.Item>
        ))}
      </ChakraBreadcrumb.List>
    </ChakraBreadcrumb.Root>
  );
}