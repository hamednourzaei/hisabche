// ============================================
// Reel 95 — «شخصی‌سازی این صفحه» (L2.32 of docs/100-VIDEO-PLAN.md) · 34 s
//
// A product demonstration, product first: result, then the way to it. No narration (a recorded
// voice is not available; a silent edition with one- to three-word step labels is the honest
// version), so there is no subtitle bar. The whole picture is ONE real recording of the dashboard,
// cut into steps with `trimStart`. Nothing is drawn but the end card.
//
// What the product says (pageLook.*): what you switch off is hidden only for you and is no longer
// loaded; nobody's access changes; «بازگردانی پیش‌فرض» brings it back. The reel claims nothing more.
//
// ⚠️ `page-look-dashboard.mp4` is a real recording by the owner, outside the repository
// (docs/CAPTURE-MANIFEST.md). Missing → the export refuses (PRODUCT_CAPTURE).
// The recording is 30 s, in this order — each scene starts where its `trimStart` says:
//   0–6   open «شخصی‌سازی این صفحه»      6–15  switch sections off («نمودار فروش», «پیشنهادهای هوشمند»)
//   15–22 «تمام»: the lighter dashboard   22–27 reopen, «بازگردانی پیش‌فرض»      27–30 restored
// Blueprint: docs/scenarios/L2.32-personalise-this-page.md
// ============================================

import type { Cue, Reel, SceneSpec } from '../engine/types'
import { DEMO_STAGE, DemoEndScene } from '../scenes/page-look-demo'
import { sequence, total } from './shared'

export const REEL_95_CAPTURE = {
  file: 'page-look-dashboard.mp4',
  route: '/dashboard',
  screenState:
    'One uninterrupted recording (≥ 30 s) of the dashboard: open «شخصی‌سازی این صفحه»; switch two sections off (for example «نمودار فروش» and «پیشنهادهای هوشمند»); press «تمام» and show the lighter dashboard; reopen and press «بازگردانی پیش‌فرض». Test data only.',
} as const

const step = (label: string, trimStart: number): SceneSpec => ({
  kind: 'product-capture',
  theme: 'swiss-editorial',
  file: REEL_95_CAPTURE.file,
  route: REEL_95_CAPTURE.route,
  screenState: REEL_95_CAPTURE.screenState,
  trimStart,
  label,
  stage: DEMO_STAGE,
})

const scenes = sequence(
  [
    // 1 (0–3s) — the result first: the lighter dashboard.
    { dur: 3, spec: step('شخصی‌سازی این صفحه', 17), vo: '' },
    // 2 (3–9s) — open it.
    { dur: 6, spec: step('۱ باز کن', 0), vo: '' },
    // 3 (9–18s) — switch sections off.
    { dur: 9, spec: step('۲ خاموش کن', 6), vo: '' },
    // 4 (18–25s) — only for you.
    { dur: 7, spec: step('۳ فقط برای خودت', 15), vo: '' },
    // 5 (25–31s) — and back.
    { dur: 6, spec: step('۴ بازگردانی', 22), vo: '' },
    // 6 (31–34s) — the end card.
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'swiss-editorial',
        component: DemoEndScene,
        cues: [
          { at: 0.02, kind: 'whoosh' },
          { at: 0.12, kind: 'pop' },
          { at: 1.25, kind: 'pop' },
        ] as Cue[],
      },
      vo: '',
    },
  ],
  { noZoom: true },
)

export const reel95: Reel = {
  id: '95',
  title: 'شخصی‌سازی این صفحه، فقط برای خودت',
  duration: total(scenes),
  scenes,
  theme: 'swiss-editorial',
  musicMood: 'calm',
  noZoom: true,
}
