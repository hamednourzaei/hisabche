// ============================================
// Reel #110 — «جزء زندگی» (Part of Life)
//
// Topic: the owner must feel Hisabche is part of their life — a must-have.
// One warm light-arc travels through a single dark day: the dawn chai, the
// noon rush of receipts, the midnight receivables worry that resolves, the
// brass shutter closing the market with a balanced till, and the home night
// where the product rests like a mint heart on a sleeping phone.
// Distinct from 109 (product-UI glass surfaces): here light is the camera.
//
// Guardrails honoured: noZoom (the light travels, the camera never), no
// decorative divider, ≤ 6 on-stage words per scene, 24px+ margins, dark
// theme, deterministic digits (faClock char map, faNumber), no currency
// names, the shutter obeys the night-closure law. Voiceover not yet
// recorded: PROVISIONAL_CADENCE_MODEL_ACTIVE.
// ============================================

import type { Cue, Reel } from '../engine/types'
import { sequence, total } from './shared'
import {
  CurtainScene,
  DawnScene,
  MidnightScene,
  NoonScene,
  RestScene,
  ShutterScene,
} from '../scenes/part-of-life'

const theme = 'midnight-gold' as const

const scenes = sequence(
  [
    // 1 (0.00–6.00) — dawn: the chai lights before the ledger; the hook states the day's truth
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme,
        component: DawnScene,
        cues: [
          { at: 0.05, kind: 'cinematicReveal' },
          { at: 0.95, kind: 'pop' },
          { at: 2.5, kind: 'chime' },
          { at: 5.5, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'یه روز بدون حسابچه، مثل صبح بدون چایه.',
    },

    // 2 (6.00–13.00) — noon: the sun rides its arc, receipts land under it
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: NoonScene,
        cues: [
          { at: 0.85, kind: 'cardThock' },
          { at: 1.45, kind: 'receiptPrint' },
          { at: 2.05, kind: 'receiptPrint' },
          { at: 3.05, kind: 'tick' },
          { at: 6.1, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'ظهر که مغازه جوش می‌زنه، هر فروش همون لحظه قید می‌شه.',
    },

    // 3 (13.00–20.00) — midnight: the untracked worry resolves into a known, ordered list
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: MidnightScene,
        cues: [
          { at: 0.05, kind: 'softTransition' },
          { at: 2.3, kind: 'alert' },
          { at: 3.2, kind: 'success' },
          { at: 3.9, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'نصفه‌شب که یاد نسیه‌ها می‌افتی، طلب‌ها یک‌جا و مرتبان.',
    },

    // 4 (20.00–27.00) — the brass shutter: slats fall, the lock snaps, the till is even
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: ShutterScene,
        cues: [
          { at: 0.05, kind: 'softTransition' },
          { at: 0.4, kind: 'cardThock' },
          { at: 0.9, kind: 'cardThock' },
          { at: 1.4, kind: 'cardThock' },
          { at: 1.9, kind: 'cardThock' },
          { at: 2.4, kind: 'cardThock' },
          { at: 3.05, kind: 'impact' },
          { at: 3.5, kind: 'cash' },
          { at: 4.6, kind: 'success' },
        ] as Cue[],
      },
      vo: 'شب که کرکره پایین میاد، دخل ترازه؛ شبِ آرامِ بازار.',
    },

    // 5 (27.00–34.00) — the home night: the lamp breathes, the phone rests with its mint heart
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: RestScene,
        cues: [
          { at: 0.1, kind: 'chime' },
          { at: 2.3, kind: 'pop' },
          { at: 6.2, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'دیگه چیزی پشت سرت وای نمی‌سته؛ فقط یه شبِ راحت.',
    },

    // 6 (34.00–42.00) — the ember curtain; CTA holds ≥ 3.0s
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme,
        component: CurtainScene,
        cues: [
          { at: 0.06, kind: 'cinematicReveal' },
          { at: 1.2, kind: 'chime' },
          { at: 2.9, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'از امروز، حسابچه رو جزءِ زندگی‌ت کن.',
    },
  ],
  { noZoom: true },
)

export const reel110: Reel = {
  id: '110',
  title: 'جزء زندگی — یک روز کامل با حسابچه',
  duration: total(scenes),
  theme,
  noZoom: true,
  musicMood: 'calm',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'فروش و نسیه‌ی روز فقط در ذهن می‌ماند؛ یادآوری یک غفلت، بیدارِ نیمه‌شب است.',
    oldWorkflow: 'دفترچه‌ی پراکنده و حافظه‌ی خسته؛ اعداد آخرِ شب جابه‌جا می‌شوند.',
    friction: 'تا دخل و طلب‌ها تراز نشوند، شب آرام نمی‌گیرد.',
    hisabcheAction: 'هر فروش همان لحظه قید می‌شود و طلب‌ها یک‌جا و مرتب می‌مانند؛ شب دخل تراز است.',
    automatedResult:
      'یک روز کامل — صبح چای تا قفل کرکره — بدون کاغذ و بدون دوباره‌کاری ثبت شده است.',
    businessOutcome: 'شبِ بازار آرام می‌شود و صبحِ فردا از صفر شروع نمی‌شود.',
    emotionalPayoff: 'حسابچه مثل چایِ صبح، بخش ثابتِ روز می‌شود.',
    cta: 'از امروز، حسابچه را جزءِ زندگی‌تان کن — hisabche.com',
    selectedOperators: [
      'DawnChaiWake',
      'NoonSunReceipts',
      'MidnightReceivablesResolve',
      'BrassShutterVeil',
      'RestMintHeart',
      'PartOfLifeCurtain',
    ],
  },
  scenes,
}
