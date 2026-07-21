// packages/ui/src/components/ui/landing/site-footer.tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { FaInstagram, FaFacebook } from "react-icons/fa6";

/* ═══════════════════════════════════════════════════════════════════════════
   SiteFooter v1 — Large SEO footer.
   Columns map to real search intent (product, features, industries, learning)
   rather than generic "Company / Legal" filler — every link is something a
   prospective user would plausibly search for.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SiteFooterProps {
  t: (key: string, fallback?: string) => string;
}

interface FooterLink {
  key: string;
  fallback: string;
  href: string;
}

interface FooterColumn {
  titleKey: string;
  titleFallback: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    titleKey: "landing.footerColProduct",
    titleFallback: "محصول",
    links: [
      { key: "features", fallback: "امکانات", href: "#features" },
      { key: "pricing", fallback: "قیمت‌گذاری", href: "#pricing" },
      { key: "security", fallback: "امنیت داده", href: "#security" },
      { key: "faq", fallback: "سوالات متداول", href: "#faq" },
    ],
  },
  {
    titleKey: "landing.footerColFeatures",
    titleFallback: "امکانات",
    links: [
      { key: "invoicing", fallback: "فاکتور فروش", href: "/features/invoicing" },
      { key: "inventory", fallback: "مدیریت گدام", href: "/features/inventory" },
      { key: "debt", fallback: "مدیریت بدهی مشتری", href: "/features/debt" },
      { key: "reports", fallback: "گزارش‌گیری", href: "/features/reports" },
    ],
  },
  {
    titleKey: "landing.footerColIndustries",
    titleFallback: "کسب‌وکارها",
    links: [
      { key: "retail", fallback: "خرده‌فروشی", href: "/industries/retail" },
      { key: "pharmacy", fallback: "دواخانه", href: "/industries/pharmacy" },
      { key: "restaurant", fallback: "رستوران", href: "/industries/restaurant" },
      { key: "wholesale", fallback: "عمده‌فروشی", href: "/industries/wholesale" },
    ],
  },
  {
    titleKey: "landing.footerColCompany",
    titleFallback: "شرکت",
    links: [
      { key: "about", fallback: "درباره ما", href: "/about" },
      { key: "blog", fallback: "وبلاگ", href: "/blog" },
      { key: "contact", fallback: "تماس با ما", href: "/contact" },
      { key: "careers", fallback: "فرصت‌های شغلی", href: "/careers" },
    ],
  },
  {
    titleKey: "landing.footerColLegal",
    titleFallback: "قانونی",
    links: [
      { key: "terms", fallback: "شرایط استفاده", href: "/legal/terms" },
      { key: "privacy", fallback: "حریم خصوصی", href: "/legal/privacy" },
    ],
  },
];

const SOCIALS = [
  { icon: Send, label: "Telegram", href: "https://t.me/hisabche" },
  { icon: FaFacebook, label: "Facebook", href: "https://facebook.com/hisabche" },
  { icon: FaInstagram, label: "Instagram", href: "https://instagram.com/hisabche" },
];

export default function SiteFooter({ t }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-muted)/0.3)]",
      )}
    >
      <div className="container-narrow py-10 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 sm:gap-6">
          {/* ── Brand block ── */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-2 sm:mb-0">
            <div className="mb-3 text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t("app.name", "حسابچه")}
              <span className="text-[hsl(var(--color-primary))]">.</span>
            </div>
            <p className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))] leading-relaxed max-w-[220px]">
              {t("landing.footerTagline", "حافظه‌ی زنده‌ی کسب‌وکار تو — آفلاین، امن، همیشه در دسترس.")}
            </p>
            <div className="flex items-center gap-3 mt-4">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full",
                    "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]",
                    "hover:text-[hsl(var(--color-primary))] hover:border-[hsl(var(--color-primary)/0.3)]",
                    "transition-colors duration-200",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* ── Link columns ── */}
          {COLUMNS.map((col) => (
            <nav key={col.titleKey} aria-label={t(col.titleKey, col.titleFallback)}>
              <h3 className="text-xs sm:text-sm font-semibold text-[hsl(var(--fg-primary))] mb-3 sm:mb-4">
                {t(col.titleKey, col.titleFallback)}
              </h3>
              <ul className="space-y-2 sm:space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-200"
                    >
                      {t(`landing.footerLink.${link.key}`, link.fallback)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div
          className={cn(
            "mt-10 sm:mt-14 pt-6 sm:pt-8 border-t border-[hsl(var(--border-default))]",
            "flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4",
          )}
        >
          <p className="text-[10px] sm:text-xs text-[hsl(var(--fg-tertiary))] order-2 sm:order-1">
            {t("landing.footerCopyright", `© ${year} حسابچه. تمامی حقوق محفوظ است.`)}
          </p>
          <p className="text-[10px] sm:text-xs text-[hsl(var(--fg-tertiary))] order-1 sm:order-2">
            {t("landing.footer", "سیستم مدیریت کسب‌وکار")}
          </p>
        </div>
      </div>
    </footer>
  );
}