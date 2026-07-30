// apps/web/app/[lang]/legal/data-deletion/page.tsx
import type { Metadata } from "next";
import { LegalPageClient } from "../LegalPageClient";
import { buildLegalMetadata } from "../legal-metadata";

const titles: Record<string, string> = {
  "fa": "درخواست حذف داده — حسابچه",
  "af": "درخواست حذف معلومات — حسابچه",
  en: "Data Deletion Request — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa": "چگونه درخواست حذف کامل حساب و داده‌های خود در حسابچه را ثبت کنید.",
  "af": "چگونه درخواست حذف کامل حساب و معلومات خود در حسابچه را ثبت کنید.",
  en: "How to request deletion of your Hisabche account and data.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return buildLegalMetadata({
    lang,
    path: "/legal/data-deletion",
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
  });
}

export default function DataDeletionPage() {
  return (
    <LegalPageClient
      titleKey="landing.legalPage.dataDeletionTitle"
      titleFallback="Data Deletion Request"
      introKey="landing.legalPage.dataDeletionIntro"
      introFallback="You can request full deletion of your Hisabche account and data at any time."
      sectionsKey="landing.legalPage.dataDeletionSections"
    />
  );
}
