// apps/web/app/page.tsx
import { Suspense } from "react";
import { LandingPage } from "@hisabche/ui/landing/landing-page";
import { AuthGate } from "./auth-gate";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

/* ═══════════════════════════════════════════════════════════════════════════
   RootPage — redirects to [lang]/page.tsx via proxy
   ═══════════════════════════════════════════════════════════════════════════ */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
  description: "نرم‌افزار حسابداری، فاکتور، انبار و مدیریت بدهی برای کسب‌وکارهای کوچک و متوسط. رایگان شروع کنید.",
  keywords: [
    "حسابداری",
    "نرم‌افزار حسابداری",
    "مدیریت انبار",
    "فاکتور",
    "مدیریت بدهی",
    "حسابچه",
    "hisabche",
    "نرم‌افزار حسابداری رایگان",
    "مدیریت کسب‌وکار",
    "انبارداری",
    "حسابداری آنلاین",
    "حسابداری آفلاین",
    "فاکتور آنلاین",
    "مدیریت مشتریان",
    "گدامداری",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
    description: "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپ. بدون اینترنت، رایگان.",
    url: "https://hisabche.com",
    siteName: "حسابچه",
    locale: "fa_IR",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "حسابچه" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
    description: "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپلیکیشن.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
};

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
          description: "نرم‌افزار حسابداری، مدیریت انبار و فاکتور برای کسب‌وکارهای کوچک و متوسط",
          url: "https://hisabche.com",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "340" },
        }),
      }}
    />
  );
}

export default function RootPage() {
  return (
    <>
      <JsonLd />
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