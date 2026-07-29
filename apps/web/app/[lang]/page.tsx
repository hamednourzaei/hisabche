// apps/web/app/[lang]/page.tsx
import { Suspense } from "react";
import { LandingPage } from "@hisabche/ui/landing/landing-page";
import { AuthGate } from "./auth-gate";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

/* ═══════════════════════════════════════════════════════════════════════════
   RootPage — localized landing page for /, /en, /af
   ═══════════════════════════════════════════════════════════════════════════ */

export const revalidate = 3600;

interface PageConfigEntry {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  siteName: string;
  ogLocale: string;
  schemaName: string;
  schemaAlternateName: string;
  schemaDescription: string;
  schemaOperatingSystem: string;
}

const pageConfig = {
  fa: {
    title: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
    description: "نرم‌افزار حسابداری، فاکتور، انبار و مدیریت بدهی برای کسب‌وکارهای کوچک و متوسط. رایگان شروع کنید.",
    keywords: [
      "حسابداری", "نرم‌افزار حسابداری", "مدیریت انبار", "فاکتور", "مدیریت بدهی",
      "حسابچه", "hisabche", "نرم‌افزار حسابداری رایگان", "مدیریت کسب‌وکار", "انبارداری",
      "حسابداری آنلاین", "حسابداری آفلاین", "فاکتور آنلاین", "مدیریت مشتریان",
    ],
    ogTitle: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
    ogDescription: "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپ. بدون اینترنت، رایگان.",
    siteName: "حسابچه",
    ogLocale: "fa_IR",
    schemaName: "حسابچه",
    schemaAlternateName: "Hisabche",
    schemaDescription: "نرم‌افزار حسابداری، مدیریت انبار و فاکتور برای کسب‌وکارهای کوچک و متوسط",
    schemaOperatingSystem: "Web, iOS, Android",
  },
  af: {
    title: "حسابچه — نرم‌افزار حسابداری و مدیریت تجارت",
    description: "نرم‌افزار حسابداری، فاکتور، گدام و مدیریت قرض برای تجارت‌های کوچک و متوسط. رایگان شروع کنید.",
    keywords: [
      "حسابداری", "نرم‌افزار حسابداری", "مدیریت گدام", "فاکتور", "مدیریت قرض",
      "حسابچه", "hisabche", "نرم‌افزار حسابداری رایگان", "مدیریت تجارت", "گدامداری",
      "حسابداری آنلاین", "حسابداری آفلاین", "فاکتور آنلاین", "مدیریت مشتریان",
    ],
    ogTitle: "حسابچه — نرم‌افزار حسابداری و مدیریت تجارت",
    ogDescription: "حسابداری، فاکتور، گدام و مدیریت قرض در یک اپ. بدون انترنت، رایگان.",
    siteName: "حسابچه",
    ogLocale: "fa_AF",
    schemaName: "حسابچه",
    schemaAlternateName: "Hisabche",
    schemaDescription: "نرم‌افزار حسابداری، مدیریت گدام و فاکتور برای تجارت‌های کوچک و متوسط",
    schemaOperatingSystem: "Web, iOS, Android",
  },
  en: {
    title: "Hisabche — Free Accounting & Business Management Software",
    description: "Free accounting, invoicing, inventory and debt management software for small and medium businesses. Start free.",
    keywords: [
      "accounting software", "free accounting", "inventory management", "invoicing", "debt management",
      "hisabche", "free accounting software", "business management", "warehouse management",
      "online accounting", "offline accounting", "online invoicing", "customer management",
    ],
    ogTitle: "Hisabche — Free Accounting & Business Management Software",
    ogDescription: "Accounting, invoicing, inventory and debt management in one app. Works offline, free.",
    siteName: "Hisabche",
    ogLocale: "en_US",
    schemaName: "Hisabche",
    schemaAlternateName: "حسابچه",
    schemaDescription: "Accounting, inventory and invoicing software for small and medium businesses",
    schemaOperatingSystem: "Web, iOS, Android",
  },
} satisfies Record<"fa" | "af" | "en", PageConfigEntry>;

function getPageConfig(lang: string): PageConfigEntry {
  return pageConfig[lang as keyof typeof pageConfig] ?? pageConfig.en;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const config = getPageConfig(lang);
  const path = lang === "fa" ? "" : `/${lang}`;

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: {
      canonical: lang === "fa" ? "/" : `/${lang}`,
    },
    openGraph: {
      title: config.ogTitle,
      description: config.ogDescription,
      url: `https://www.hisabche.com${path}`,
      siteName: config.siteName,
      locale: config.ogLocale,
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: config.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: config.ogTitle,
      description: config.ogDescription,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
    },
  };
}

function JsonLd({ lang }: { lang: string }) {
  const config = getPageConfig(lang);
  const path = lang === "fa" ? "" : `/${lang}`;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: config.schemaName,
          alternateName: config.schemaAlternateName,
          description: config.schemaDescription,
          url: `https://www.hisabche.com${path}`,
          inLanguage: lang,
          applicationCategory: "BusinessApplication",
          operatingSystem: config.schemaOperatingSystem,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "340" },
        }),
      }}
    />
  );
}

export default async function RootPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  return (
    <>
      <JsonLd lang={lang} />
      <AuthGate>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <div className={cn("h-8 w-8 animate-spin rounded-full", "border-2 border-[hsl(var(--color-primary))] border-t-transparent")} />
            </div>
          }
        >
          <LandingPage />
        </Suspense>
      </AuthGate>
    </>
  );
}
