import type { Metadata, Viewport } from "next"

import { Providers } from "./providers"
import { ClientErrorBoundary } from "./client-error-boundary"

import "@hisabche/ui/globals.css"

import localFont from "next/font/local"
import { cn } from "@hisabche/ui"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

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
})

export const metadata: Metadata = {
  title: {
    template: "%s | حساب‌چه",
    default: "حساب‌چه — سیستم مدیریت کسب‌وکار",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e14" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fa-AF"
      dir="rtl"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn("font-sans", vazirmatn.variable)}
    >
      <head>

</head>
      <body className="min-h-screen bg-[var(--hisab-background)] text-[var(--hisab-foreground)] antialiased">
        <ClientErrorBoundary>
          <Providers>{children}</Providers>
        </ClientErrorBoundary>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )

}