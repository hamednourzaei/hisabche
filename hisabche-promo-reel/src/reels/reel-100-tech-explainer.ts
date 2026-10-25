// ============================================
// Reel 100 — «اکسپلینر تک‌سازمان» (Architecture & Live Activity Stream)
// Authored based on the test.mp4 motion reference (Firecracker / Vercel style).
//
// 1. Task fragmentation micro-disaster + Shrug avatar
// 2. Manual inspection console + Scanning monitor
// 3. Live activity link stream + Pointing avatar
// 4. 6 Modular cloud services + Pointing avatar
// 5. VIP account unlock card + Neutral presenter avatar
//
// Hard Rule 20: noZoom: true locked across reel & sequence.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  TechCtaScene,
  TechLiveLinkScene,
  TechManualInspectionScene,
  TechModuleScene,
  TechTaskChaosScene,
} from '../scenes/tech-explainer'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–8.20s) — Task fragmentation & shrug avatar (Speech: 0.30s - 7.93s)
    {
      dur: 8.2,
      spec: {
        kind: 'bespoke',
        theme: 'team-flow',
        component: TechTaskChaosScene,
        cues: [
          { at: 0.2, kind: 'alert' },
          { at: 1.2, kind: 'typewriterClick' },
          { at: 2.8, kind: 'titleHit' },
          { at: 5.5, kind: 'clockTickRapid' },
        ] as Cue[],
      },
      vo: 'خسته نشدی انقدر تسک‌های کارکنان سازمانتو تک‌تک فرستادی براشون و در آخر هم نفهمیدی به چه مرحله‌ای رسیدن؟',
    },

    // 2 (8.20–15.30s) — Manual inspection console (Speech: 8.41s - 14.98s)
    {
      dur: 7.1,
      spec: {
        kind: 'bespoke',
        theme: 'team-flow',
        component: TechManualInspectionScene,
        cues: [
          { at: 0.3, kind: 'tick' },
          { at: 2.2, kind: 'clockTickRapid' },
          { at: 4.5, kind: 'alert' },
          { at: 6.2, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'هر روز باید تک‌تک بهشون سر بزنی تا متوجه بشی آیا تمام خواسته‌هات انجام شدن یا نه؟',
    },

    // 3 (15.30–27.30s) — Live Link Architecture & pointing avatar (Speech: 15.52s - 26.94s)
    {
      dur: 12.0,
      spec: {
        kind: 'bespoke',
        theme: 'team-flow',
        component: TechLiveLinkScene,
        cues: [
          { at: 0.3, kind: 'whoosh' },
          { at: 2.5, kind: 'sync' },
          { at: 5.0, kind: 'precisionSequence' },
          { at: 9.0, kind: 'cash' },
        ] as Cue[],
      },
      vo: 'با حسابچه می‌تونی با به اشتراک گذاشتن یک لینک با اعضای سازمان، تمامی فعالیت‌هاشون رو رصد بکنی! نتیجه تماس، ثبت سفارش و پیش‌فاکتور.',
    },

    // 4 (27.30–37.40s) — 6 Modular Cloud Services (Speech: 27.43s - 37.04s)
    {
      dur: 10.1,
      spec: {
        kind: 'bespoke',
        theme: 'team-flow',
        component: TechModuleScene,
        cues: [
          { at: 0.4, kind: 'cardEnter' },
          { at: 3.0, kind: 'dataFlow' },
          { at: 7.5, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'در حسابچه علاوه بر مدیریت سازمان و کسب‌وکار، می‌تونی فاکتورها، انبار، تماس‌ها و سفارشات رو هم لحظه‌ای رصد کنی.',
    },

    // 5 (37.40–44.72s) — VIP Account Activation CTA (Speech: 37.55s - 43.82s)
    {
      dur: 7.32,
      spec: {
        kind: 'bespoke',
        theme: 'team-flow',
        component: TechCtaScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.2, kind: 'ctaResolution' },
          { at: 5.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'با فرستادن کلمه «حسابچه» می‌تونی همین الان اکانت تست رایگان رو دریافت بکنی!',
    },
  ],
  { noZoom: true },
)

export const reel100: Reel = {
  id: '100',
  title: 'اکسپلینر تک‌سازمان — مانیتورینگ بلادرنگ تیم با حسابچه',
  duration: total(scenes),
  scenes,
  theme: 'team-flow',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'services',
    customerPain: 'سردرگمی در پیگیری تسک‌های پرسنل و بی‌خبری از خروجی کارها',
    oldWorkflow: 'پیام دادن تک‌تک در واتساپ و تماس تلفنی برای پرسیدن وضعیت',
    friction: 'تلف شدن زمان مدیر و عدم شفافیت در پیشرفت کارها',
    hisabcheAction: 'ایجاد لینک اشتراک اختصاصی سازمان برای ثبت خودکار فعالیت‌ها',
    automatedResult: 'داشبورد زنده از تماس‌ها، فاکتورها، سفارشات و انبار',
    businessOutcome: 'نظارت کامل بدون نیاز به پیگیری مداوم دستی',
    emotionalPayoff: 'آرامش خاطر مدیر و شفافیت کامل عملکرد تیم',
    cta: 'ارسال کلمه حسابچه برای دریافت اکانت تست',
    selectedOperators: [
      'LiveOrgLink',
      'TaskDispatchChaos',
      'StaffStatusGrid',
      'ActivityStreamFeed',
      'ModularCapabilityHex',
      'TestAccountReveal',
    ],
  },
}
