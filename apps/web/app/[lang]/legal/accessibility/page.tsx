// apps/web/app/[lang]/legal/accessibility/page.tsx
import type { Metadata } from "next";
import { LegalPageClient } from "../LegalPageClient";
import { buildLegalMetadata } from "../legal-metadata";

const titles: Record<string, string> = {
  "fa": "بیانیه دسترسی‌پذیری — حسابچه",
  "af": "بیانیه دسترسی‌پذیری — حسابچه",
  en: "Accessibility Statement — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa": "تعهد حسابچه به دسترسی‌پذیری برای همه‌ی کاربران.",
  "af": "تعهد حسابچه به دسترسی‌پذیری برای همه‌ی کاربران.",
  en: "Hisabche's commitment to accessibility for all users.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return buildLegalMetadata({
    lang,
    path: "/legal/accessibility",
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
  });
}

export default function AccessibilityPage() {
  return (
    <LegalPageClient
      titleKey="landing.legalPage.accessibilityTitle"
      titleFallback="Accessibility Statement"
      introKey="landing.legalPage.accessibilityIntro"
      introFallback="Hisabche is committed to making its product usable by as many people as possible."
      sectionsKey="landing.legalPage.accessibilitySections"
    />
  );
}
