import type { Metadata, Viewport } from 'next'

import { Providers } from './providers'

import './globals.css'

import { ErrorBoundary } from '@hisabche/ui'

export const metadata: Metadata = {
  title: {
    template: '%s | حساب‌چه',
    default: 'حساب‌چه — سیستم مدیریت کسب‌وکار',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
    >
      <head>
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn[wght].woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>

      <body className="min-h-screen bg-[var(--hisab-background)] text-[var(--hisab-foreground)] antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}