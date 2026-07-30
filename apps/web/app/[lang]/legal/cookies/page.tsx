// apps/web/app/[lang]/legal/cookies/page.tsx
import type { Metadata } from "next";
import { LegalPageClient } from "../LegalPageClient";
import { buildLegalMetadata } from "../legal-metadata";

const titles: Record<string, string> = {
  "fa": "سیاست کوکی — حسابچه",
  "af": "سیاست کوکی — حسابچه",
  en: "Cookie Policy — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa": "این‌که حسابچه از چه کوکی‌هایی استفاده می‌کند و چرا.",
  "af": "این‌که حسابچه از چه کوکی‌هایی استفاده می‌کند و چرا.",
  en: "What cookies Hisabche uses and why.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return buildLegalMetadata({
    lang,
    path: "/legal/cookies",
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
  });
}

export default function CookiePolicyPage() {
  return (
    <LegalPageClient
      titleKey="landing.legalPage.cookieTitle"
      titleFallback="Cookie Policy"
      introKey="landing.legalPage.cookieIntro"
      introFallback="This policy explains what cookies Hisabche uses and why."
      sectionsKey="landing.legalPage.cookieSections"
    />
  );
}
