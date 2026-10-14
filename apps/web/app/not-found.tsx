// ============================================
// A page that does not exist (live audit #21, 14 Oct).
//
// There is no root layout above `[lang]`, so an unknown address — `/fa/inventory`
// — fell through to Next's default English 404 with no styling. This page
// brings its own <html>: it cannot know the reader's language for certain, so
// it says it in Persian first and English under it, and offers the way back.
// System colours (Canvas/CanvasText) follow the reader's light or dark theme
// without the app's stylesheet, which is not loaded here.
// ============================================

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'صفحه پیدا نشد — حسابچه',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Vazirmatn, Tahoma, system-ui, sans-serif',
          background: 'Canvas',
          color: 'CanvasText',
        }}
      >
        <main style={{ textAlign: 'center', padding: 16, maxWidth: 420 }}>
          <p style={{ fontSize: 48, fontWeight: 700, margin: 0 }}>۴۰۴</p>
          <h1 style={{ fontSize: 20, margin: '8px 0' }}>این صفحه پیدا نشد</h1>
          <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 4px' }}>
            نشانی را بررسی کنید یا به داشبورد برگردید.
          </p>
          <p dir="ltr" style={{ fontSize: 13, opacity: 0.6, margin: '0 0 20px' }}>
            This page could not be found.
          </p>
          <a
            href="/fa/dashboard"
            rel="nofollow"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid currentColor',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            رفتن به داشبورد
          </a>
        </main>
      </body>
    </html>
  )
}
