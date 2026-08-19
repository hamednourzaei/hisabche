// apps/web/app/[lang]/opengraph-image.tsx
//
// Every page on the site referenced `/og-image.png` in its openGraph and
// twitter metadata — a file that does not exist in public/. Every share on
// Facebook, Telegram, WhatsApp, X and LinkedIn therefore rendered an image-less
// card, on the locales that matter most for this product.
//
// Rather than commit a binary that can drift from the brand, this uses Next's
// `opengraph-image` file convention: the card is generated at build time from
// the same Vazirmatn face the site ships and the same per-locale wording used
// in the page metadata, and Next wires it into openGraph AND twitter for this
// route and every descendant automatically.

import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { localeMeta, resolveLocale, type Locale } from './i18n-config'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Hisabche — accounting and business management software'

/* ═══════════════════════════════════════════════════════════════════════════
   Satori's RTL limits — both of these are worked around below, not lived with.

   1. No Unicode bidi algorithm. Satori treats a ZWNJ (U+200C) as a segment
      break and emits the halves in the wrong order, so "نرم‌افزار" renders as
      "افزارنرم" and "کسب‌وکار" as "وکارکسب". These strings therefore use
      ordinary spaces — "نرم افزار", "کسب و کار" — which is correct, readable
      Persian/Dari. Word order *within* a text run is handled correctly.

   2. `direction: rtl` does not reorder flex children. Laid out in source order
      the first card landed leftmost, so "فاکتور" appeared at the far left when
      it belongs at the far right. The card array is reversed in JS for RTL
      locales, which is deterministic regardless of Satori's direction support.
   ═══════════════════════════════════════════════════════════════════════════ */

const CARD: Record<Locale, { name: string; tagline: string; points: string[] }> = {
  fa: {
    name: 'حسابچه',
    tagline: 'نرم افزار حسابداری و مدیریت کسب و کار',
    points: ['فاکتور', 'انبار', 'بدهی مشتریان', 'بدون اینترنت'],
  },
  af: {
    name: 'حسابچه',
    tagline: 'نرم افزار حسابداری و مدیریت تجارت',
    points: ['فاکتور', 'گدام', 'قرض مشتریان', 'بدون انترنت'],
  },
  en: {
    name: 'Hisabche',
    tagline: 'Accounting & business management software',
    points: ['Invoicing', 'Inventory', 'Customer debt', 'Works offline'],
  },
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = resolveLocale(lang)
  const card = CARD[locale]
  const isRtl = localeMeta[locale].direction === 'rtl'

  // See note 2 above.
  const points = isRtl ? [...card.points].reverse() : card.points

  // Satori has no system font with Persian/Arabic coverage — without an
  // explicit face the fa/af cards would render as tofu boxes.
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Vazirmatn-Regular.ttf')),
    readFile(join(process.cwd(), 'public/fonts/Vazirmatn-Bold.ttf')),
  ])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: '#061417',
        fontFamily: 'Vazirmatn',
      }}
    >
      {/* Brand glow behind the wordmark — keeps the card from reading as a
            flat block of colour. */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 300,
          width: 600,
          height: 420,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(20,184,166,0.30) 0%, rgba(20,184,166,0) 70%)',
        }}
      />
      {/* Accent rule along the top edge. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1200,
          height: 8,
          background: 'linear-gradient(90deg, #0d9488 0%, #14b8a6 50%, #5eead4 100%)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 70px',
        }}
      >
        {/* Wordmark. The trailing brand dot is a sibling span rather than part
              of the string so it can carry the accent colour; in RTL Satori
              places it at the left end, which is where it belongs. */}
        <div
          style={{
            display: 'flex',
            flexDirection: isRtl ? 'row-reverse' : 'row',
            alignItems: 'baseline',
            fontSize: 96,
            fontWeight: 700,
            color: '#f2fbf8',
            letterSpacing: '-0.02em',
          }}
        >
          <span>{card.name}</span>
          <span style={{ color: '#14b8a6' }}>.</span>
        </div>

        {/* Short accent rule under the wordmark. */}
        <div
          style={{
            display: 'flex',
            width: 120,
            height: 5,
            marginTop: 22,
            borderRadius: 999,
            background: '#14b8a6',
          }}
        />

        <div
          style={{
            display: 'flex',
            marginTop: 30,
            fontSize: 40,
            lineHeight: 1.4,
            color: '#b9d6d2',
          }}
        >
          {card.tagline}
        </div>

        {/* Feature cards. */}
        <div style={{ display: 'flex', marginTop: 54, gap: 18 }}>
          {points.map((point) => (
            <div
              key={point}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '22px 34px',
                fontSize: 30,
                fontWeight: 700,
                borderRadius: 22,
                color: '#e6f6f2',
                border: '1px solid rgba(94,234,212,0.28)',
                background: 'rgba(13,148,136,0.16)',
              }}
            >
              {point}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 44,
          display: 'flex',
          fontSize: 26,
          color: '#6f9a95',
          letterSpacing: '0.04em',
        }}
      >
        hisabche.com
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Vazirmatn', data: regular, weight: 400, style: 'normal' },
        { name: 'Vazirmatn', data: bold, weight: 700, style: 'normal' },
      ],
    },
  )
}
