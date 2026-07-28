"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import SiteFooter from "@hisabche/ui/landing/site-footer";

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(fa-IR|fa-AF|en)/);
  return match?.[1] ?? "fa-IR";
}

interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalPageClientProps {
  titleKey: string;
  titleFallback: string;
  introKey: string;
  introFallback: string;
  sectionsKey: string;
}

export function LegalPageClient({ titleKey, titleFallback, introKey, introFallback, sectionsKey }: LegalPageClientProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const locale = getLocaleFromPathname(pathname);

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result && result !== key ? result : (fallback ?? key);
  };

  const sections = t(sectionsKey, { returnObjects: true }) as LegalSection[];
  const lastUpdated = safeT("landing.legalPage.lastUpdated", "Last updated: {date}").replace("{date}", "2026-07-28");

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
          {safeT(titleKey, titleFallback)}
        </h1>
        <p className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))] mb-6">{lastUpdated}</p>
        <p className="text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed mb-8">
          {safeT(introKey, introFallback)}
        </p>

        <div className="space-y-6">
          {Array.isArray(sections) &&
            sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-base sm:text-lg font-bold text-[hsl(var(--fg-primary))] mb-2">
                  {section.heading}
                </h2>
                <p className={cn("text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed")}>
                  {section.body}
                </p>
              </section>
            ))}
        </div>
      </main>

      <SiteFooter t={safeT} />
    </div>
  );
}
