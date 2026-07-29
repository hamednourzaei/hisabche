// apps/web/app/[lang]/legal/terms/page.tsx
import { LegalPageClient } from "../LegalPageClient";

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

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
    // Locale-aware canonical: "fa" is served unprefixed (default locale),
    // "af"/"en" are served under their locale prefix. Previously this was a
    // static "/legal/terms" for every locale, which told Google that the fa,
    // af and en versions were duplicates of the same canonical URL.
    alternates: { canonical: lang === "fa" ? "/legal/terms" : `/${lang}/legal/terms` },
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
