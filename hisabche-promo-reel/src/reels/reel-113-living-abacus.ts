// ============================================
// Reel 113 — «چرتکه زنده» (The Living Abacus)
//
// A completely new visual paradigm for the studio (never built in reels 1–112):
// a holographic Persian counting frame. Each rod is a ledger dimension; beads
// slide to post a value. Manual work pushes beads rod-by-rod; Hisabche drives
// every rod in ONE synchronized sweep. The abacus needs no power source — the
// authentic offline-first metaphor.
//
// Structure (owner brief: strong opening hook + a mid hook + comment CTA,
// zero overlapping items, fully refactored UI/motion):
//   1. HOOK 1 (0.0–3.5s)  — jammed frame, «دستی ننویس!»
//   2. Pain   (3.5–10.0s) — manual bead pushing, one bead misses (red)
//   3. HOOK 2 (10.0–15.0s)— network cuts, the abacus stays lit (offline)
//   4. Resolve(15.0–24.0s)— one synchronized sweep, balance lock, auto-sync
//   5. CTA    (24.0–31.0s)— shared dual comment-keyword end card
//
// Non-overlap is guaranteed by construction (see living-abacus.tsx header).
// References: ref-wikipedia-abacus-counting-frame · ref-wikihow-abacus-bead-ops
//             · ref-aeon-shortform-hook-cta (manifest: reel-113).
// Runtime law: 31.0s > 30s. noZoom:true. Alignment PROVISIONAL (SFX + music bed).
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AbacusHookScene,
  AbacusManualScene,
  AbacusOutageScene,
  AbacusSyncScene,
  abacusHookCues,
  abacusManualCues,
  abacusOutageCues,
  abacusSyncCues,
} from '../scenes/living-abacus'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.0–3.5s) — HOOK 1
    {
      dur: 3.5,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: AbacusHookScene,
        cues: abacusHookCues as Cue[],
      },
      vo: 'صبر کن! هنوز بعد هر فاکتور، دستی ثبت می‌کنی؟',
    },

    // 2 (3.5–10.0s) — manual friction
    {
      dur: 6.5,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: AbacusManualScene,
        cues: abacusManualCues as Cue[],
      },
      vo: 'هر فاکتور رو باید چهار جا دستی بنویسی؛ یک قلم جا بیفته، حساب و انبار به هم می‌ریزه.',
    },

    // 3 (10.0–15.0s) — HOOK 2 (mid): the outage
    {
      dur: 5.0,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: AbacusOutageScene,
        cues: abacusOutageCues as Cue[],
      },
      vo: 'وسط شلوغی بازار، اینترنت قطع می‌شه؛ مشتری صف کشیده!',
    },

    // 4 (15.0–24.0s) — resolution: one sweep, balance, sync
    {
      dur: 9.0,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: AbacusSyncScene,
        cues: abacusSyncCues as Cue[],
      },
      vo: 'با حسابچه، فاکتور آفلاین ثبت می‌شه؛ اینترنت که برگشت، همه‌چیز خودکار همگام می‌شه.',
    },

    // 5 (24.0–31.0s) — comment CTA
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel113: Reel = {
  id: '113',
  title: 'چرتکه زنده — یک بار بزن، تمام',
  duration: total(scenes),
  scenes,
  theme: 'dark-neon',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'دوباره‌نویسی دستی هر فاکتور در چهار دفتر و ترس از توقف دخل هنگام قطع اینترنت',
    oldWorkflow: 'ثبت دستی فاکتور در دفتر کل، کاردکس، حساب مشتری و دخل؛ توقف فروش با قطع اینترنت',
    friction:
      'یک قلم جاافتاده حساب و انبار را به هم می‌ریزد و قطعی اینترنت صف مشتری را متوقف می‌کند',
    hisabcheAction:
      'ثبت یک‌باره فاکتور و موتور آفلاین‌اول که فروش را ادامه می‌دهد و خودکار همگام می‌شود',
    automatedResult:
      'همه میله‌های چرتکه با یک رویداد همزمان می‌لغزند؛ دفاتر تراز و بدون دوباره‌نویسی به‌روز می‌مانند',
    businessOutcome: 'دخل همیشه روشن، دفاتر تراز و پایان دوباره‌نویسی دستی',
    emotionalPayoff: 'آرامش از اینکه فروش هیچ‌وقت متوقف نمی‌شود و حساب‌ها خودکار مرتب‌اند',
    cta: 'کامنت «رایگان» برای شروع، کامنت «حسابچه» برای لینک و مشاوره',
    selectedOperators: [
      'LivingAbacusStage',
      'ManualBeadPush',
      'OfflineEmberHold',
      'SynchronizedSweep',
      'DualCommentCta',
    ],
  },
}
