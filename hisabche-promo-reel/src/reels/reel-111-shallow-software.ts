// ============================================
// Reel #111 — «درمان نرم‌افزارهای سطحی — چرا حسابچه؟» (Beyond Superficial Software)
//
// Topic:
// Merchants are exhausted by superficial, fragile accounting software:
// 1. Freezes on weak internet or server drops
// 2. Trapped as web-only websites that cannot install natively on mobile
// 3. Rigid systems with zero deep customization
// 4. Incomplete toy solutions that break under real market pressure
//
// Hisabche is the cure:
// - Local-First Offline Engine (Zero downtime when internet drops)
// - True Multi-Device Native Deployment (Android, Windows, Web synced)
// - Deep modular customization tailored to real businesses
// ============================================

import type { Cue, Reel } from '../engine/types'
import { sequence, total } from './shared'
import {
  CureCurtainScene,
  DeepCustomScene,
  FourFlawsScene,
  MultiDeviceScene,
  OfflineFirstScene,
  ShallowTrapScene,
} from '../scenes/shallow-software'

const theme = 'dark-neon' as const

const scenes = sequence(
  [
    // 1 (0.00–6.00) — the shallow web app freezes on internet/server drop
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme,
        component: ShallowTrapScene,
        cues: [
          { at: 0.05, kind: 'titleHit' },
          { at: 1.2, kind: 'alert' },
          { at: 2.4, kind: 'pop' },
          { at: 5.5, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'یه قطعی اینترنت می‌شه و صندوق فروش جلو مشتری قفل می‌کنه؟',
    },

    // 2 (6.00–13.00) — the four flaws of superficial software
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: FourFlawsScene,
        cues: [
          { at: 0.5, kind: 'cardThock' },
          { at: 1.05, kind: 'cardThock' },
          { at: 1.6, kind: 'cardThock' },
          { at: 2.15, kind: 'cardThock' },
          { at: 3.2, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'نه شخصی‌سازی داره، نه روی گوشی نصب می‌شه؛ فقط اسمش برنامه‌ست.',
    },

    // 3 (13.00–20.00) — local-first offline engine: zero downtime
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: OfflineFirstScene,
        cues: [
          { at: 0.4, kind: 'cardEnter' },
          { at: 1.8, kind: 'cardThock' },
          { at: 2.2, kind: 'success' },
          { at: 3.6, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه آفلاین‌اوله؛ اینترنت قطع بشه، صندوق حتی یه ثانیه نمی‌خوابه.',
    },

    // 4 (20.00–27.00) — true multi-device native deployment: phone, tablet, POS
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: MultiDeviceScene,
        cues: [
          { at: 0.3, kind: 'cardEnter' },
          { at: 0.7, kind: 'cardEnter' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 2.8, kind: 'sync' },
        ] as Cue[],
      },
      vo: 'فقط یه وبسایت نیست؛ روی گوشی، تبلت و کامپیوترت یکجا نصبه.',
    },

    // 5 (27.00–34.00) — deep modular customization tailored to your workflow
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: DeepCustomScene,
        cues: [
          { at: 0.4, kind: 'cardEnter' },
          { at: 1.2, kind: 'tick' },
          { at: 2.4, kind: 'success' },
          { at: 6.2, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'نرم‌افزار باید قدِ کارِ تو باشه، نه تو قدِ نرم‌افزار.',
    },

    // 6 (34.00–42.00) — the cure curtain; CTA holds ≥ 3.0s
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme,
        component: CureCurtainScene,
        cues: [
          { at: 0.1, kind: 'cinematicReveal' },
          { at: 1.0, kind: 'chime' },
          { at: 2.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'درمانِ نرم‌افزارهای ناقص اینجاست؛ از امروز حسابچه‌ای شو.',
    },
  ],
  { noZoom: true },
)

export const reel111: Reel = {
  id: '111',
  title: 'درمان نرم‌افزارهای سطحی — چرا حسابچه؟',
  duration: total(scenes),
  theme,
  noZoom: true,
  musicMood: 'uplifting',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'نرم‌افزارهای حسابداری سطحی با قطعی اینترنت قفل می‌کنند، روی گوشی نصب نمی‌شوند و انعطافی ندارند.',
    oldWorkflow: 'نرم‌افزارهای تحت وب شکننده یا اکسل‌های خشک و ناامن.',
    friction: 'توقف صندوق در زمان قطعی نت و گیر افتادن جلوی مشتری.',
    hisabcheAction:
      'موتور آفلاین‌اول محلی بدون توقف کار می‌کند و داده‌ها روی موبایل، تبلت و ویندوز همگام می‌شوند.',
    automatedResult:
      'فروش‌های آفلاین در لحظه ثبت و با اتصال مجدد اینترنت، بدون خطا همگام‌سازی می‌شوند.',
    businessOutcome: 'آرامش کامل صندوقدار، استقلال از قطعی اینترنت و دسترسی همه‌جا.',
    emotionalPayoff: 'رهایی از نرم‌افزارهای ناقص و تجربهٔ یک ابزار حرفه‌ای.',
    cta: 'درمانِ نرم‌افزارهای ناقص اینجاست — hisabche.com',
    selectedOperators: [
      'ShallowWebTrap',
      'FourFlawsDiagnostic',
      'LocalFirstZeroLatency',
      'MultiPlatformSync',
      'ModularBusinessFit',
      'CureResolutionCurtain',
    ],
  },
  scenes,
}
