import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { getLocale, getMessages } from 'next-intl/server'
import { IntlProvider } from './intl-provider'
import { Providers } from './providers'
import { THEME_INIT_SCRIPT } from '@/components/admin-shell/use-admin-theme'

// The design system itself, not a copy of it. This file used to import an
// 814-line byte-identical duplicate of packages/ui/src/styles/globals.css.
import '@hisabche/ui/globals.css'

// Same face the web app loads. Without it the admin fell back to system-ui,
// which is the most visible reason it did not look like the main site.
const vazirmatn = localFont({
  src: [
    { path: '../../public/fonts/Vazirmatn-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Hisabche Admin',
  robots: { index: false, follow: false },
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Dari is right-to-left too. Only checking 'fa' left the whole admin panel
  // rendering left-to-right for Afghan users.
  const isRTL = lang === 'fa' || lang === 'af'
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={lang}
      dir={isRTL ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={vazirmatn.variable}
    >
      <head>
        {/*
          Dark is the DEFAULT here: `:root` in the design system carries the
          dark surfaces and only `[data-theme='light']` overrides them. So this
          script runs for the light-mode minority, before first paint, to stop
          a dark flash. Inline and synchronous on purpose — a deferred script
          would run after the first frame, which is the whole problem.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`min-h-screen antialiased font-sans bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] ${vazirmatn.variable}`}
      >
        <IntlProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </IntlProvider>
      </body>
    </html>
  )
}
