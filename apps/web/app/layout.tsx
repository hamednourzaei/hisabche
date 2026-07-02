import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { ClientErrorBoundary } from "./client-error-boundary";
import "@hisabche/ui/globals.css";
import localFont from "next/font/local";
import { cn } from "@hisabche/ui";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

/* ═══════════════════════════════════════════════════════════════════════════
   RootLayout v4 — Hisabche Brand Refresh
   Teal Premium Design System + Full Favicon Set
   ═══════════════════════════════════════════════════════════════════════════ */

const vazirmatn = localFont({
  src: [
    {
      path: "../public/fonts/Vazirmatn-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Vazirmatn-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "Tahoma"],
  preload: true,
});

export const metadata: Metadata = {
  title: {
    template: "%s | حساب‌چه",
    default: "حساب‌چه — سیستم مدیریت کسب‌وکار",
  },
  description:
    "نرم‌افزار حسابداری، مدیریت موجودی و تحلیل مالی برای کسب‌وکارها. سیستم یکپارچه حساب‌چه.",
  keywords: ["حسابداری", "نرم‌افزار حسابداری", "مدیریت موجودی", "erp", "کسب‌وکار"],
  openGraph: {
    type: "website",
    url: "https://hisabche.com",
    title: "حساب‌چه — سیستم مدیریت کسب‌وکار",
    description: "نرم‌افزار حسابداری و موجودی برای کسب‌وکارها.",
    siteName: "حساب‌چه",
    locale: "fa_IR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "حسابچه",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "حساب‌چه — سیستم مدیریت کسب‌وکار",
    description: "نرم‌افزار حسابداری و موجودی برای کسب‌وکارها.",
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
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "manifest", url: "/manifest.json" },
    ],
  },
  metadataBase: new URL('https://www.hisabche.com'),
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7FAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#061417" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fa-AF"
      dir="rtl"
      suppressHydrationWarning
      className={cn(vazirmatn.variable)}
    >
      <head>
        {/* Critical CSS — above the fold */}
        <style>{`
          html{scroll-behavior:smooth}
          body{font-family:var(--font-sans,system-ui);background-color:hsl(var(--surface-base,192 55% 6%));color:hsl(var(--fg-primary,160 40% 98%));margin:0;padding:0;line-height:1.55;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
          *{box-sizing:border-box;margin:0;padding:0}
          h1,.h1{font-size:clamp(2.25rem,5vw,4rem);line-height:1.2;font-weight:700}
          h2,.h2{font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.2;font-weight:600}
          p,.body{font-size:clamp(.875rem,2vw,1rem);line-height:1.65}
          button,[role=button]{cursor:pointer;font-family:inherit}
          img{max-width:100%;height:auto;display:block}
          html{overflow-y:scroll}
          :focus-visible{outline:2px solid hsl(var(--color-primary,168 84% 43%) / .5);outline-offset:2px;border-radius:6px}
        `}</style>

        {/* Theme initialization */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('hisab-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />

        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "حساب‌چه",
              description: "نرم‌افزار حسابداری و مدیریت موجودی",
              url: "https://hisabche.com",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              inLanguage: "fa-IR",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />

        {/* Performance hints */}
        <meta name="theme-color" content="#061417" />
        <meta name="color-scheme" content="dark light" />
        <link rel="dns-prefetch" href="https://api.hisabche.com" />
        <link rel="preconnect" href="https://api.hisabche.com" crossOrigin="anonymous" />
      </head>

      <body
        className={cn(
          "min-h-screen antialiased font-sans",
          "bg-[hsl(var(--surface-base))]",
          "text-[hsl(var(--fg-primary))]",
          vazirmatn.variable,
        )}
      >
        <ClientErrorBoundary>
          <Providers>{children}</Providers>
        </ClientErrorBoundary>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}