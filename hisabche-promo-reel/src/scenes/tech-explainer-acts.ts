// src/scenes/tech-explainer-acts.ts
//
// Reel 100 — what the presenter does, scene by scene, tied to what is SAID and
// what the picture is doing at that second.
//
// One presenter, one vocabulary: she talks while she explains, holds her head
// when the tasks pile up, shrugs at «I can't tell where it is», thinks at the
// open question, points at the thing being named, and gives a thumbs-up only at
// the offer. A gesture appears once, for one meaning, in every scene it is used.
//
// «presence» is how she holds herself on the page, and it always has a reason:
// she stands while she simply explains; she makes ONE hop at the moment of a
// surprise or good news (the queue backs up, the link goes out, the offer
// lands); and she hovers a little off the ground only while she is lost or
// presenting. Nothing bounces on a loop.
//
// Times are on each scene's own clock and line up with the scene's cues
// (`src/reels/reel-100-tech-explainer.ts`).

import type { ActBeat } from '../avatars/vrm-avatar/acts'

/** 1 · «خسته نشدی… نفهمیدی به چه مرحله‌ای رسیدن؟» (8.2 s) */
export const ACTS_TASK_CHAOS: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  // «خسته نشدی؟» — she asks, the way a person does.
  { at: 0.3, gesture: 'talk', emotion: 'concerned' },
  // The queue backs up (the scene's panic starts ~1.8 s): head in hands.
  { at: 2.4, gesture: 'hands-on-head', emotion: 'tired', presence: 'hop' },
  // «نفهمیدی به چه مرحله‌ای رسیدن؟» — the clock ticks (5.5 s); she does not know.
  { at: 5.4, gesture: 'shrug', emotion: 'concerned', presence: 'float' },
  { at: 7.9, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** 2 · «هر روز باید تک‌تک بهشون سر بزنی…» (7.1 s) */
export const ACTS_MANUAL_INSPECTION: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.2, gesture: 'talk', emotion: 'concerned' },
  // «تا متوجه بشی آیا… یا نه؟» — the open question (the alert cue, 4.5 s).
  { at: 4.2, gesture: 'think', emotion: 'thinking', presence: 'float' },
  { at: 6.8, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** 3 · «با یک لینک… تمامی فعالیت‌ها رو رصد بکنی!» (12 s) */
export const ACTS_LIVE_LINK: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.2, gesture: 'talk', emotion: 'confident' },
  // «با به اشتراک گذاشتن یک لینک» — the link goes out (sync cue, 2.5 s).
  { at: 2.4, gesture: 'click-link', emotion: 'excited', presence: 'hop' },
  // «تمامی فعالیت‌هاشون رو رصد بکنی» — the stream she is pointing at.
  { at: 4.8, gesture: 'point-up', emotion: 'confident', presence: 'float' },
  // «نتیجه تماس، ثبت سفارش و پیش‌فاکتور» — the three results, said plainly.
  { at: 8.8, gesture: 'talk', emotion: 'confident' },
  { at: 11.5, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** 4 · «فاکتورها، انبار، تماس‌ها و سفارشات رو لحظه‌ای رصد کنی.» (10.1 s) */
export const ACTS_MODULES: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.2, gesture: 'talk', emotion: 'confident' },
  // The six modules are named; she presents them (data flows, 3 s).
  { at: 2.8, gesture: 'point-left', emotion: 'excited', presence: 'float' },
  { at: 7.3, gesture: 'talk', emotion: 'confident' },
  { at: 9.8, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** 5 · «با فرستادن کلمه «حسابچه»… اکانت تست رایگان» (7.32 s) */
export const ACTS_CTA: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.2, gesture: 'talk', emotion: 'happy' },
  // The offer lands (chime, 5 s): the only thumbs-up in the film.
  { at: 4.8, gesture: 'thumbs-up', emotion: 'happy', presence: 'hop' },
  { at: 6.5, gesture: 'thumbs-up', emotion: 'happy', speaking: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// Reel 101 — «فاکتور جادویی و انبار زنده»
// ─────────────────────────────────────────────────────────────────────────────

/** Reel 101 · 1 · پریدن مشتری در زمان انتظار برای پیش‌فاکتور (7.2 s) */
export const ACTS_LOST_DEAL_CHAOS: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.1, gesture: 'talk', emotion: 'surprised' },
  // 3.5s titleHit: purchase from competitor stamp falls -> panic!
  { at: 3.5, gesture: 'hands-on-head', emotion: 'concerned', presence: 'hop' },
  { at: 6.8, gesture: 'hands-on-head', emotion: 'concerned', speaking: false },
]

/** Reel 101 · 2 · خطای فرمول‌های اکسل و فروختن جنس ناموجود (7.2 s) */
export const ACTS_SPREADSHEET_ERROR: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.3, gesture: 'talk', emotion: 'tired' },
  // 2.1s alert: stock is 0 warning box -> shrugs at the disaster
  { at: 2.1, gesture: 'shrug', emotion: 'tired', presence: 'float' },
  { at: 5.5, gesture: 'shrug', emotion: 'concerned' },
  { at: 6.9, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** Reel 101 · 3 · جدول فاکتور تعاملی و سریع حسابچه (10.8 s) */
export const ACTS_INTERACTIVE_INVOICE: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.2, gesture: 'talk', emotion: 'confident' },
  // 1.9s dropdown + instant calculation -> points at the live table
  { at: 1.9, gesture: 'point-right', emotion: 'confident', presence: 'float' },
  // 4.8s sync stock verified
  { at: 4.8, gesture: 'point-right', emotion: 'excited' },
  // 8.5s chime: send link button flies to customer phone
  { at: 8.5, gesture: 'point-up', emotion: 'confident', presence: 'hop' },
  { at: 10.4, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** Reel 101 · 4 · اتوماسیون کسر انبار، سود و چک‌ها (9.4 s) */
export const ACTS_INVENTORY_SYNC: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.4, gesture: 'point-up', emotion: 'excited', presence: 'float' },
  // 2.8s data flow & profit chart surge -> celebrate
  { at: 2.8, gesture: 'celebrate', emotion: 'happy', presence: 'hop' },
  // 6.5s cash / receivable alert
  { at: 6.5, gesture: 'point-up', emotion: 'confident' },
  { at: 9.0, gesture: 'idle', emotion: 'neutral', speaking: false },
]

/** Reel 101 · 5 · دعوت به اقدام (6.6 s) */
export const ACTS_CTA_101: readonly ActBeat[] = [
  { at: 0, gesture: 'idle', emotion: 'neutral', speaking: false },
  { at: 0.2, gesture: 'talk', emotion: 'confident' },
  // 2.0s cta resolution -> thumbs up
  { at: 2.0, gesture: 'thumbs-up', emotion: 'confident', presence: 'hop' },
  { at: 4.6, gesture: 'thumbs-up', emotion: 'happy' },
  { at: 6.2, gesture: 'thumbs-up', emotion: 'happy', speaking: false },
]
