// apps/web/app/[lang]/layout.tsx

import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { ClientErrorBoundary } from "./client-error-boundary";
import "@hisabche/ui/globals.css";
import localFont from "next/font/local";
import { cn } from "@hisabche/ui";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { AnalyticsPageview } from "./analytics-pageview";
import { Suspense } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   RootLayout v8 — Fixed Favicons + PWA manifest
   ═══════════════════════════════════════════════════════════════════════════ */

const vazirmatn = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "Tahoma"],
  preload: true,
});

const siteConfig = {
  "FA": {
    title: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
    description: "نرم‌افزار حسابداری، فاکتور، مدیریت انبار، بدهی مشتریان و تحلیل مالی برای کسب‌وکارهای کوچک و متوسط. رایگان شروع کنید.",
    keywords: [
      "حسابداری", "نرم‌افزار حسابداری", "حسابداری رایگان", "حسابداری آنلاین", "حسابداری آفلاین",
      "مدیریت انبار", "انبارداری", "موجودی کالا", "فاکتور", "صدور فاکتور",
      "فاکتور آنلاین", "مدیریت بدهی", "مدیریت مشتریان", "حسابچه", "نرم‌افزار حسابداری ایرانی",
      "برنامه حسابداری", "حسابداری فروشگاهی", "مدیریت کسب‌وکار", "گزارش مالی", "تحلیل مالی",
    ],
    ogTitle: "حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار",
    ogDescription: "حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپ. بدون اینترنت، رایگان.",
    siteName: "حسابچه",
    locale: "FA",
  },
  "AF": {
    title: "حسابچه — نرم‌افزار حسابداری و مدیریت تجارت",
    description: "نرم‌افزار حسابداری، فاکتور، مدیریت گدام، قرض مشتریان و تحلیل مالی برای تجارت‌های کوچک و متوسط. رایگان شروع کنید.",
    keywords: [
      "حسابداری", "نرم‌افزار حسابداری", "حسابداری رایگان", "حسابداری آنلاین", "حسابداری آفلاین",
      "مدیریت گدام", "گدامداری", "موجودی جنس", "فاکتور", "صدور فاکتور",
      "فاکتور آنلاین", "مدیریت قرض", "مدیریت مشتریان", "حسابچه", "نرم‌افزار حسابداری افغانستان",
      "برنامه حسابداری", "حسابداری دوکانداری", "مدیریت تجارت", "گزارش مالی", "تحلیل مالی",
    ],
    ogTitle: "حسابچه — نرم‌افزار حسابداری و مدیریت تجارت",
    ogDescription: "حسابداری، فاکتور، گدام و مدیریت قرض در یک اپ. بدون انترنت، رایگان.",
    siteName: "حسابچه",
    locale: "FA",
  },
  "en": {
    title: "Hisabche — Free Accounting & Business Management Software",
    description: "Free accounting software with invoicing, inventory management, customer debt tracking and financial analytics for small businesses. Start free.",
    keywords: [
      "accounting software", "free accounting", "online accounting", "offline accounting", "invoicing",
      "invoice software", "inventory management", "stock management", "customer management", "debt tracking",
      "hisabche", "business management", "financial reports", "small business", "free invoice software",
      "warehouse management", "billing software", "accounting app", "ERP", "financial analytics",
    ],
    ogTitle: "Hisabche — Free Accounting & Business Management Software",
    ogDescription: "Free accounting, invoicing, inventory and debt management in one app. Works offline.",
    siteName: "Hisabche",
    locale: "en_US",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const config = siteConfig[lang as keyof typeof siteConfig] || siteConfig["en"];

  return {
    title: { template: `%s | ${config.siteName}`, default: config.title },
    description: config.description,
    keywords: config.keywords,
    openGraph: {
      type: "website",
      url: `https://hisabche.com/${lang === "FA" ? "" : lang}`,
      title: config.ogTitle,
      description: config.ogDescription,
      siteName: config.siteName,
      locale: config.locale,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: config.siteName }],
    },
    twitter: { card: "summary_large_image", title: config.ogTitle, description: config.ogDescription },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } },
    icons: {
      icon: [
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
        { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
        { url: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
        { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      other: [{ rel: "manifest", url: "/site.webmanifest" }],
    },
    metadataBase: new URL("https://www.hisabche.com"),
    alternates: {
      canonical: lang === "FA" ? "/" : `/${lang}`,
      languages: { "en": "/en", "fa" : "/FA", "af": "/AF" },
    },
  };
}

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 5, colorScheme: "dark light",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7FAF9" }, { media: "(prefers-color-scheme: dark)", color: "#061417" }],
};

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const isRTL = lang === "fa" || lang === "fa-AF";

  return (
    <html lang={lang} dir={isRTL ? "rtl" : "ltr"} suppressHydrationWarning data-scroll-behavior="smooth" className={cn(vazirmatn.variable)}>
      <head>
        <base href="/" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <style>{`html{scroll-behavior:smooth}body{font-family:var(--font-sans,system-ui);background-color:hsl(var(--surface-base,192 55% 6%));color:hsl(var(--fg-primary,160 40% 98%));margin:0;padding:0;line-height:1.55;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}*{box-sizing:border-box;margin:0;padding:0}h1,.h1{font-size:clamp(2.25rem,5vw,4rem);line-height:1.2;font-weight:700}h2,.h2{font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.2;font-weight:600}p,.body{font-size:clamp(.875rem,2vw,1rem);line-height:1.65}button,[role=button]{cursor:pointer;font-family:inherit}img{max-width:100%;height:auto;display:block}html{overflow-y:scroll}:focus-visible{outline:2px solid hsl(var(--color-primary,168 84% 43%) / .5);outline-offset:2px;border-radius:6px}`}</style>
        <link rel="alternate" hrefLang="en" href="https://hisabche.com/en" />
        <link rel="alternate" hrefLang="fa" href="https://hisabche.com/fa" />
        <link rel="alternate" hrefLang="fa-AF" href="https://hisabche.com/fa-AF" />
        <link rel="alternate" hrefLang="x-default" href="https://hisabche.com" />
        <meta name="theme-color" content="#061417" />
        <meta name="color-scheme" content="dark light" />
        <link rel="dns-prefetch" href="https://api.hisabche.com" />
        <link rel="preconnect" href="https://api.hisabche.com" crossOrigin="anonymous" />
      </head>
      <body className={cn("min-h-screen antialiased font-sans", "bg-[hsl(var(--surface-base))]", "text-[hsl(var(--fg-primary))]", vazirmatn.variable)}>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){try{var theme=localStorage.getItem('hisab-theme');var prefersDark=window.matchMedia('(prefers-color-scheme:dark)').matches;if(theme==='dark'||(!theme&&prefersDark)){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}}catch(e){}})();` }} />
        <Script id="schema-jsonld" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: lang === "fa" ? "حسابچه" : lang === "AF" ? "حسابچه" : "Hisabche", description: lang === "fa" ? "نرم‌افزار حسابداری و مدیریت موجودی" : lang === "AF" ? "نرم‌افزار حسابداری و مدیریت جنس" : "Accounting and inventory management software", url: "https://hisabche.com", applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: lang, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }) }} />
        <Script strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-T5XG907W4R" />
        <Script id="google-analytics" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-T5XG907W4R');` }} />
        <ClientErrorBoundary><Providers>{children}</Providers></ClientErrorBoundary>
        <Suspense fallback={null}><AnalyticsPageview /></Suspense>
        <SpeedInsights /><Analytics />
      </body>
    </html>
  );
}