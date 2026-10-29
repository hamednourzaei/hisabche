// ============================================
// Reel 76: Warehouse Shelf Map - 3-Second Bin Locating (Bespoke Cut)
//
// The Optical 2D Warehouse Matrix & 3-Second Bin Navigation
// High-conversion warehouse precision narrative for distribution hubs & stockrooms.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  Interactive2DShelfGridScene,
  MissingItemStandOffScene,
  ShelfCapacityGaugeScene,
  SubSecondBarcodeLocatorScene,
  WarehousePrecisionManifestoScene,
  WarehouseShelfCtaScene,
} from '../scenes/warehouse-shelf-map'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Visual Arrest: Missing Item Blind Search Stand-Off
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: MissingItemStandOffScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'مشتری پای صندوق منتظره، ولی مکان کالا مشخص نیست؛ انباردار ۲۰ دقیقه است تو راهروها می‌گرده!',
    },

    // 2 — Interactive 2D Warehouse Shelf Grid Matrix
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: Interactive2DShelfGridScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'scan' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در حسابچه، هر قفسه کد استاندارد ۳ سطحی داره: راهرو، ردیف و طبقه. با یک نگاه جای دقیق بار را می‌دانی.',
    },

    // 3 — Sub-Second Barcode Scanner & Instant Reticle Lock
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: SubSecondBarcodeLocatorScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'scan' },
          { at: 3.5, kind: 'financialMilestone' },
          { at: 5.5, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'بارکد کالا رو اسکن کن؛ قفسه ثبت می‌شه و هر کس وارد انبار بشه فوراً کالا رو پیدا می‌کنه.',
    },

    // 4 — Volumetric Shelf Capacity & Smart Stock Gauge
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: ShelfCapacityGaugeScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'ظرفیت باقیمانده هر قفسه پایش می‌شود؛ نه انباشت خطرناک روی طبقات و نه هدررفت فضای مفید انبار.',
    },

    // 5 — Precision Logistics Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: WarehousePrecisionManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 3.2, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'انبار بدون نقشه یعنی چاه سرمایه؛ با حسابچه ۳ ثانیه تا قفسه فاصله داری، با صفر سردرگمی.',
    },

    // 6 — Obsidian Monolith CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: WarehouseShelfCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'سیستم قفسه‌بندی و کدینگ انبار حسابچه؛ تسلط بر فضای انبار در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel76: Reel = {
  id: '76',
  title: 'قفسه‌بندی و کدینگ انبار: راهرو و طبقه را از کد بخوان!',
  duration: total(scenes),
  scenes,
  theme: 'cyber-emerald',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'سرگردانی پرسنل در راهروهای انبار برای یافتن کالا در حضور مشتری و اتلاف وقت',
    oldWorkflow: 'به حافظه سپردن جای کارتن‌ها یا گشتن قفسه به قفسه در سالن انبار',
    friction: 'انباردار مرخصی رفت و هیچ‌کس نتوانست کالای مورد نیاز فاکتور را در انبار پیدا کند',
    hisabcheAction:
      'تعریف نقشه ۲ بعدی انبار، آدرس‌دهی استاندارد ۳ سطحی (راهرو-قفسه-طبقه) و اتصال بارکد',
    automatedResult: 'اسکن بارکد = هدایت مستقیم به مختصات قفسه در کمتر از ۳ ثانیه',
    businessOutcome: 'کاهش ۹۰ درصدی زمان آماده‌سازی بار و افزایش رضایت مشتریان پای صندوق',
    emotionalPayoff: 'انضباط نظامی و آرامش کامل در مدیریت سالن‌های انبار',
    cta: 'قفسه‌بندی انبار در hisabche.com',
    selectedOperators: ['SpatialGridTrack', 'LaserScannerSweep', 'MonolithHoldCta'],
  },
}
