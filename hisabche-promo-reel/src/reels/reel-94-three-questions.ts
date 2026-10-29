// ============================================
// Reel 94 — «سه سؤال درباره‌ی تاریخ انقضا» (L1.09 of docs/100-VIDEO-PLAN.md) · 33 s
//
// Bespoke Motion Engine: Optical Chrono-Batch Chamber & Shelf-Decay Velocity
// (محفظه اپتیکال بچ و زمان‌سنج فساد قفسه)
//
// Three critical questions every retail/wholesale merchant faces:
//   ۱ کدام کالا نزدیک انقضاست؟   → Real-time batch triage: سالم / نزدیک انقضا / منقضی
//   ۲ چند روز مانده؟              → Chronograph shelf countdown & sales velocity
//   ۳ ارزش کالای منقضی چقدر؟      → Locked capital containment: «در ترازنامه هست، قابل فروش نیست»
// followed by the unified Tri-Matrix and tactile CTA with seamless loop.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  QuestionOneScene,
  QuestionThreeScene,
  QuestionTwoScene,
  RecapScene,
  SaveScene,
  ThreeHookScene,
} from '../scenes/three-questions'
import { sequence, total } from './shared'

/** Kept for manifest/catalogue backward compatibility */
export const REEL_94_CAPTURE = {
  file: 'expiry-batches.mp4',
  route: '/expiry',
  cuts: {
    near: { trimStart: 0, label: 'نزدیک انقضا', screenState: 'The page «انقضا و بچ»' },
    days: { trimStart: 5, label: 'روز باقی‌مانده', screenState: 'The column «روز باقی‌مانده»' },
    value: { trimStart: 10, label: 'ارزش کالای منقضی', screenState: 'The card «ارزش کالای منقضی»' },
  },
} as const

const scene = (component: typeof ThreeHookScene, cues: Cue[]) =>
  ({ kind: 'bespoke', theme: 'paper-pocket', component, cues }) as const

const scenes = sequence(
  [
    // 1 (0–3s, 3s) — Hook: Three Deadliest Questions
    {
      dur: 3,
      spec: scene(ThreeHookScene, [
        { at: 0.05, kind: 'pop' },
        { at: 1.2, kind: 'precisionSequence' },
      ]),
      vo: 'سه سؤال حیاتی درباره تاریخ انقضا؛ سه‌گانه‌ای که ندانستنش سرمایه فروشگاه را بی‌صدا می‌سوزاند.',
    },
    // 2 (3–8s, 5s) — Question 1: Which goods are near expiry?
    {
      dur: 5,
      spec: scene(QuestionOneScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.8, kind: 'pop' },
        { at: 1.9, kind: 'pop' },
        { at: 3.0, kind: 'chime' },
      ]),
      vo: 'اول: کدام کالا در آستانه انقضاست؟ تفکیک بلادرنگ جنس سالم، نزدیک انقضا و کاملاً فاسد در سیستم.',
    },
    // 3 (8–14s, 6s) — Question 2: How many days remaining?
    {
      dur: 6,
      spec: scene(QuestionTwoScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.4, kind: 'precisionSequence' },
        { at: 3.5, kind: 'pop' },
      ]),
      vo: 'دوم: دقیقاً چند روز تا انقضا باقی مانده؟ شمارش معکوس لحظه‌ای قفسه برای اقدام قبل از رسیدن به نقطه صفر.',
    },
    // 4 (14–20s, 6s) — Question 3: What is the value of expired inventory?
    {
      dur: 6,
      spec: scene(QuestionThreeScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.5, kind: 'paperRustle' },
        { at: 2.2, kind: 'chime' },
      ]),
      vo: 'سوم: چقدر سرمایه در اجناس منقضی حبس شده؟ جنسی که در ترازنامه ثبت است، اما ریالی به دخل برنمی‌گردد.',
    },
    // 5 (20–27s, 7s) — The 3 Answers in One Line: Tri-Matrix
    {
      dur: 7,
      spec: scene(RecapScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.3, kind: 'pop' },
        { at: 0.8, kind: 'pop' },
        { at: 1.3, kind: 'pop' },
      ]),
      vo: 'حسابچه هر سه پاسخ را یکپارچه می‌کند: تفکیک خودکار بچ‌ها، روزشمار دقیق و حفاظت از سود واقعی فروشگاه.',
    },
    // 6 (27–33s, 6s) — Call to Action & Seamless Loop
    {
      dur: 6,
      spec: scene(SaveScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.15, kind: 'pop' },
        { at: 5.4, kind: 'pop' },
      ]),
      vo: 'حسابچه؛ انبار همیشه زنده، بدون حتی یک کارتن کالای سوخته. همین حالا رایگان فعالش کنید.',
    },
  ],
  { noZoom: true },
)

export const reel94: Reel = {
  id: '94',
  title: 'سه سؤال درباره‌ی تاریخ انقضا',
  duration: total(scenes),
  scenes,
  theme: 'paper-pocket',
  musicMood: 'calm',
  noZoom: true,
}
