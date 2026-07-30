"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail, Send } from "lucide-react";
import { FaInstagram, FaFacebook } from "react-icons/fa6";
import SiteFooter from "@hisabche/ui/landing/site-footer";

// Same real handles already used in packages/ui/src/components/ui/landing/site-footer.tsx
const CHANNELS = [
  { icon: Mail, labelKey: "landing.legalPage.contactEmailLabel", labelFallback: "Support email", value: "support@hisabche.com", href: "mailto:support@hisabche.com" },
  { icon: Send, labelKey: "landing.legalPage.contactTelegramLabel", labelFallback: "Telegram", value: "@hisabche", href: "https://t.me/hisabche" },
  { icon: FaFacebook, labelKey: null, labelFallback: "Facebook", value: "hisabche", href: "https://facebook.com/hisabche" },
  { icon: FaInstagram, labelKey: null, labelFallback: "Instagram", value: "hisabche", href: "https://instagram.com/hisabche" },
] as const;

export function ContactPageClient() {
  const t = useTranslations();

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result && result !== key ? result : (fallback ?? key);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-base))]">
      <header className="border-b border-[hsl(var(--border-default))]">
        <div className="container-narrow px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {safeT("app.name", "حسابچه")}
            <span className="text-[hsl(var(--color-primary))]">.</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          >
            {safeT("landing.legalPage.backHome", "Back to home")}
          </Link>
        </div>
      </header>

      <main className="container-narrow px-4 sm:px-6 py-10 sm:py-16 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[hsl(var(--fg-primary))] mb-2">
          {safeT("landing.legalPage.contactTitle", "Contact Us")}
        </h1>
        <p className="text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed mb-8">
          {safeT(
            "landing.legalPage.contactIntro",
            "Have a question, a bug to report, or feedback? Reach us through any of the channels below."
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHANNELS.map(({ icon: Icon, labelKey, labelFallback, value, href }) => (
            <a
              key={href}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm hover:border-[hsl(var(--color-primary)/0.4)] transition-colors"
            >
              <Icon className="size-5 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              <span>
                <span className="block text-[hsl(var(--fg-primary))] font-medium">
                  {labelKey ? safeT(labelKey, labelFallback) : labelFallback}
                </span>
                <span className="block text-xs text-[hsl(var(--fg-tertiary))]">{value}</span>
              </span>
            </a>
          ))}
        </div>

        <p className="mt-6 text-xs text-[hsl(var(--fg-tertiary))]">
          {safeT("landing.legalPage.contactHoursLabel", "Response time")}:{" "}
          {safeT("landing.legalPage.contactHoursValue", "Usually within 24 business hours")}
        </p>
      </main>

      <SiteFooter t={safeT} />
    </div>
  );
}
