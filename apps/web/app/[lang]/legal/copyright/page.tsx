// apps/web/app/[lang]/legal/copyright/page.tsx
import type { Metadata } from "next";
import { LegalPageClient } from "../LegalPageClient";
import { buildLegalMetadata } from "../legal-metadata";

const titles: Record<string, string> = {
  "fa": "حق نشر و کپی‌رایت — حسابچه",
  "af": "حق نشر — حسابچه",
  en: "Copyright — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa": "اطلاعیه‌ی حق نشر مربوط به نرم‌افزار، طراحی و محتوای حسابچه.",
  "af": "اطلاعیه‌ی حق نشر مربوط به نرم‌افزار، طراحی و محتوای حسابچه.",
  en: "Copyright notice covering the Hisabche software, design and content.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return buildLegalMetadata({
    lang,
    path: "/legal/copyright",
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
  });
}

export default function CopyrightPage() {
  return (
    <LegalPageClient
      titleKey="landing.legalPage.copyrightTitle"
      titleFallback="Copyright"
      introKey="landing.legalPage.copyrightIntro"
      introFallback="Copyright notice covering the Hisabche software, design and content."
      sectionsKey="landing.legalPage.copyrightSections"
    />
  );
}
