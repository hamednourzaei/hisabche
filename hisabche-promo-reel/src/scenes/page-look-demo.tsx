// ============================================
// L2.32 — «شخصی‌سازی این صفحه»: a product walkthrough on a calm, light stage.
// The picture is the real product (`product-capture` scenes cut from one recording); the only
// scene drawn here is the quiet end card. Design language: daylight grey, one teal accent, no cards,
// no neon.
// The words are the product's own (pageLook.* in the app's catalogue): «شخصی‌سازی این صفحه»,
// «فقط برای خودِ شما پنهان می‌شود … دسترسی هیچ‌کس تغییر نمی‌کند», «بازگردانی پیش‌فرض».
// Blueprint: docs/scenarios/L2.32-personalise-this-page.md
// ============================================

import type { Scene } from '../engine/types'
import { clamp, ease, progress } from '../engine/anim'

/** The stage the capture scenes sit on, shared so the end card matches. */
export const DEMO_STAGE = { background: '#eef1f4', ink: '#10202b' } as const
const TEAL = '#0f8f86'

type SceneProps = { t: number; scene: Scene }

/** The end: what stays true for everyone, then the one line that says where to go next. */
export function DemoEndScene({ t }: SceneProps) {
  const first = ease(clamp(progress(t, 0.1, 0.6), 0, 1))
  const second = ease(clamp(progress(t, 1.2, 1.7), 0, 1))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        background: DEMO_STAGE.background,
        color: DEMO_STAGE.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        textAlign: 'center',
        padding: '0 110px',
      }}
    >
      <div
        style={{
          fontSize: 82,
          fontWeight: 900,
          lineHeight: 1.6,
          opacity: first,
          transform: `translateY(${(1 - first) * 40}px)`,
        }}
      >
        دسترسی هیچ‌کس تغییر نمی‌کند
      </div>
      <div style={{ width: 260 * first, height: 12, borderRadius: 6, background: TEAL }} />
      <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.6, color: TEAL, opacity: second }}>
        لینک در بیو
      </div>
    </div>
  )
}
