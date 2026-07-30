// apps/web/app/[lang]/legal/disclaimer/page.tsx
import type { Metadata } from "next";
import { LegalPageClient } from "../LegalPageClient";
import { buildLegalMetadata } from "../legal-metadata";

const titles: Record<string, string> = {
  "fa": "سلب مسئولیت — حسابچه",
  "af": "سلب مسئولیت — حسابچه",
  en: "Disclaimer — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa": "محدودیت‌های مسئولیت حسابچه در استفاده از نرم‌افزار.",
  "af": "محدودیت‌های مسئولیت حسابچه در استفاده از نرم‌افزار.",
  en: "Limitations of liability for using the Hisabche software.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return buildLegalMetadata({
    lang,
    path: "/legal/disclaimer",
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
  });
}

export default function DisclaimerPage() {
  return (
    <LegalPageClient
      titleKey="landing.legalPage.disclaimerTitle"
      titleFallback="Disclaimer"
      introKey="landing.legalPage.disclaimerIntro"
      introFallback="Please read this disclaimer carefully before using Hisabche."
      sectionsKey="landing.legalPage.disclaimerSections"
    />
  );
}
