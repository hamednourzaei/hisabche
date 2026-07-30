// apps/web/app/[lang]/legal/terms/page.tsx
import type { Metadata } from "next";
import { LegalPageClient } from "../LegalPageClient";
import { buildLegalMetadata } from "../legal-metadata";

const titles: Record<string, string> = {
  "fa": "شرایط استفاده — حسابچه",
  "af": "شرایط استفاده — حسابچه",
  en: "Terms of Use — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa": "شرایط و ضوابط استفاده از نرم‌افزار حسابداری حسابچه.",
  "af": "شرایط و ضوابط استفاده از نرم‌افزار حسابداری حسابچه.",
  en: "Terms and conditions for using the Hisabche accounting software.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return buildLegalMetadata({
    lang,
    path: "/legal/terms",
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
  });
}

export default function TermsPage() {
  return (
    <LegalPageClient
      titleKey="landing.legalPage.termsTitle"
      titleFallback="Terms of Use"
      introKey="landing.legalPage.termsIntro"
      introFallback="By using Hisabche, you agree to the terms below."
      sectionsKey="landing.legalPage.termsSections"
    />
  );
}
