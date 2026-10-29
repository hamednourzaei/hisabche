// ============================================
// Reel 79: Dead Stock & Stagnant Capital — Liquidity Recovery (Bespoke Cut)
//
// The Cryogenic Dead-Stock Chamber & Dynamic Liquidity Accelerator
// High-conversion working capital narrative for retailers & wholesalers.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AgingRadarScannerScene,
  DeadstockCtaScene,
  FrozenInventoryScene,
  LiquidationBundleDefrostScene,
  WarehouseManifestoScene,
  WorkingCapitalCycleScene,
} from '../scenes/deadstock-liquidation'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Arrest: The Frozen Stagnant Inventory (6 Months Trapped Capital)
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: FrozenInventoryScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'پول توی انبارت خوابیده و گردوخاک می‌خوره، بعد برای خرید بار تازه لنگ چکت شدی؟',
    },

    // 2 — Optical Aging Radar & Dead-Stock Scanner
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: AgingRadarScannerScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.2, kind: 'tick' },
          { at: 5.2, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در حسابچه، گزارش کالای راکد اقلامی که بیش از ۶۰ روز فروش نرفته‌اند را قبل از افت قیمت نشان می‌دهد.',
    },

    // 3 — Smart Liquidation Bundle & Dynamic Defrost
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: LiquidationBundleDefrostScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.6, kind: 'tick' },
          { at: 3.6, kind: 'cash' },
          { at: 5.4, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'با تخفیف هوشمند نقدش کن؛ پولت رو برگردون به چرخه خرید جنس‌های پرفروش.',
    },

    // 4 — Reinvestment & Working Capital Cycle
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: WorkingCapitalCycleScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.6, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'نقدینگی آزادشده دوباره وارد چرخه خرید کالای پرتقاضا می‌شود و سود شما را چند برابر می‌کند.',
    },

    // 5 — Warehouse Liberation Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: WarehouseManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.4, kind: 'whoosh' },
          { at: 3.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'نه انبار خاک‌خورده، نه سرمایه حبس‌شده؛ گردش مداوم نقدینگی در دخل شما.',
    },

    // 6 — High-Impact Brand Monolith & CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: DeadstockCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'انبارداری هوشمند حسابچه؛ همین امروز کالاهای راکد مغازه را رایگان شناسایی کنید.',
    },
  ],
  { noZoom: true },
)

export const reel79: Reel = {
  id: '79',
  title: 'کالای خاک‌خورده و سرمایه راکد (Dead Stock): ۶ ماهه تکون نخورده!',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'بلوکه شدن نقدینگی در خریدهای اشتباه و کالاهایی که ماه‌ها در انبار می‌مانند',
    oldWorkflow: 'بی‌خبری از موجودی تاریخ گذشته تا زمان دور ریختن یا زیان سنگین',
    friction: 'کاسب فکر می‌کند انبارش پربار است، ولی نقدینگی برای خرید کالای پرتقاضا ندارد',
    hisabcheAction: 'گزارش تحلیلی Dead Stock، میانگین زمان توقف کالا در قفسه و آلارم انقضا',
    automatedResult: 'پیشنهاد هوشمند باندل تخفیف‌دار برای تخلیه سریع کالا و احیای نقدینگی',
    businessOutcome: 'آزادسازی سرمایه راکد و جلوگیری از ضایعات ۱۰۰ درصدی کالا',
    emotionalPayoff: 'سبک‌بالی از انبار تر و تمیز و چرخش تند نقدینگی در دخل',
    cta: 'کالای راکد در hisabche.com',
    selectedOperators: ['ThermalReceiptTear', 'EmeraldFlashPulse', 'DualBoxCtaHold'],
  },
}
