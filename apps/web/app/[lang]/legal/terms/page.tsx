// apps/web/app/[lang]/legal/terms/page.tsx
import { LegalPageClient } from "../LegalPageClient";

const titles: Record<string, string> = {
  "fa-IR": "شرایط استفاده — حسابچه",
  "fa-AF": "شرایط استفاده — حسابچه",
  en: "Terms of Use — Hisabche",
};

const descriptions: Record<string, string> = {
  "fa-IR": "شرایط و ضوابط استفاده از نرم‌افزار حسابداری حسابچه.",
  "fa-AF": "شرایط و ضوابط استفاده از نرم‌افزار حسابداری حسابچه.",
  en: "Terms and conditions for using the Hisabche accounting software.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    alternates: { canonical: "/legal/terms" },
  };
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
