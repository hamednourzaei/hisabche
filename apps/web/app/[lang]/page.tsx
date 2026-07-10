// apps/web/app/page.tsx
import { Suspense } from "react";
import { LandingPage } from "@hisabche/ui/landing/landing-page";
import { AuthGate } from "./auth-gate";
import { cn } from "@/lib/utils";
import { Metadata } from "next";

/* ═══════════════════════════════════════════════════════════════════════════
   RootPage v3 — Hisabche Premium Landing with Full SEO
   ═══════════════════════════════════════════════════════════════════════════ */

export const revalidate = 3600;

// ─── Full SEO Metadata ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    template: "%s | حسابچه",
    default: "حسابچه — حافظه‌ی زنده‌ی کسب‌وکار شما | نرم‌افزار حسابداری و انبار",
  },
  description:
    "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپلیکیشن. بدون اینترنت، روی موبایل و کامپیوتر. رایگان شروع کنید.",
  keywords: [
    "حسابداری",
    "نرم‌افزار حسابداری",
    "مدیریت انبار",
    "فاکتور",
    "مدیریت بدهی",
    "اپلیکیشن حسابداری",
    "حسابچه",
    "نرم‌افزار حسابداری افغانستان",
    "نرم‌افزار حسابداری ایران",
  ],
  authors: [{ name: "Hisabche Team" }],
  creator: "Hisabche",
  publisher: "Hisabche",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://hisabche.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "حسابچه — حافظه‌ی زنده‌ی کسب‌وکار شما",
    description: "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپ. بدون اینترنت، رایگان.",
    url: "https://hisabche.com",
    siteName: "حسابچه",
    locale: "fa_IR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "حسابچه — نرم‌افزار حسابداری و انبار",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "حسابچه — حافظه‌ی زنده‌ی کسب‌وکار شما",
    description: "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپلیکیشن.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  category: "business",
  classification: "Business Application",
};

// ─── JSON-LD Schema ──────────────────────────────────────────────────────────

function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "حسابچه",
          alternateName: "Hisabche",
          description:
            "نرم‌افزار حسابداری، مدیریت انبار و فاکتور برای کسب‌وکارهای کوچک و متوسط",
          url: "https://hisabche.com",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            ratingCount: "340",
          },
          creator: {
            "@type": "Organization",
            name: "Hisabche",
            url: "https://hisabche.com",
          },
        }),
      }}
    />
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RootPage() {
  return (
    <>
      <JsonLd />
      <AuthGate>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <div
                className={cn(
                  "h-8 w-8 animate-spin rounded-full",
                  "border-2 border-[hsl(var(--color-primary))] border-t-transparent",
                )}
              />
            </div>
          }
        >
          <LandingPage />
        </Suspense>
      </AuthGate>
    </>
  );
}