// ============================================
// Reel 72: Warehouse Transfer - In-Transit Tracking (Bespoke Cut)
//
// The Orbital Inter-Warehouse Conduit & In-Transit Telemetry Gate
// High-conversion multi-warehouse logistics narrative for wholesalers & branch networks.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  BarcodeReceptionLockScene,
  InTransitBlindspotCrisisScene,
  InteractiveConduitTransferScene,
  LogisticsIntegrityManifestoScene,
  UnifiedMultiWarehouseInventoryScene,
  WarehouseTransferCtaScene,
} from '../scenes/warehouse-transfer'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Visual Arrest: In-Transit Blindspot Crisis
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: InTransitBlindspotCrisisScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'انبار مرکزی می‌گه بار ارسال شد، ولی شعبه می‌گه هنوز نرسیده؛ ۵۰ کارتن کالا بین راه گم شده؟',
    },

    // 2 — Interactive Conduit Transfer & In-Transit Status
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: InteractiveConduitTransferScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'scan' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'precisionSequence' },
        ] as Cue[],
      },
      vo: 'در حسابچه حواله رسمی صادر می‌کنی؛ بار در سرفصل «کالای در راه» قرار می‌گیرد و نه گم می‌شود و نه دوبار محاسبه می‌شود.',
    },

    // 3 — Barcode Reception & Destination Lock
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: BarcodeReceptionLockScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'sync' },
          { at: 3.5, kind: 'financialMilestone' },
          { at: 5.5, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'انباردار مقصد بارکد را اسکن می‌کند؛ حواله با رسید تطبیق داده شده و کاردکس شعبه بدون معطلی شارژ می‌شود.',
    },

    // 4 — Unified Multi-Warehouse Stock Dashboard
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: UnifiedMultiWarehouseInventoryScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'موجودی تمام انبارها و شعب متمرکز و زنده است؛ مدیر در لحظه می‌داند در کل کسب‌وکار چقدر کالا موجود دارد.',
    },

    // 5 — Logistics Integrity Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: LogisticsIntegrityManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 3.2, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'انتقال بدون حواله چاه سیاه سرمایه است؛ با حسابچه ردیابی بار تا آخرین متر جاده تضمین می‌شود.',
    },

    // 6 — Obsidian Monolith CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: WarehouseTransferCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'سامانه انتقال بین‌انبار و مدیریت شعب حسابچه؛ تسلط کامل بر زنجیره توزیع در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel72: Reel = {
  id: '72',
  title: 'انتقال بین انبارها: کالا در راه گم نمی‌شود!',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'مفقود شدن کالا در مسیر جابجایی بین شعب یا انبار مرکزی و نامشخص بودن مسئولیت کسری بار',
    oldWorkflow: 'جابجایی کالا با یادداشت دستی روی کاغذ یا تماس تلفنی ساده بین انبارداران',
    friction:
      'یک پالت کالا در مسیر شعبه دو ناپدید شد و هر دو انباردار تقصیر را به گردن راننده انداختند',
    hisabcheAction:
      'صدور حواله رسمی بین‌انبار با کد رهگیری، وضعیت تعلیق «کالای در راه» و تایید اسکن مقصد',
    automatedResult:
      'کسر آنی از انبار مبدا، ثبت در راه و افزایش قطعی انبار مقصد پس از تطبیق بارکدی',
    businessOutcome: 'صفر شدن کسری‌های مسیر انتقال و هماهنگی بی‌نقص زنجیره تامین شعب',
    emotionalPayoff: 'آرامش خاطر از امنیت بار و شفافیت کامل تردد کالا در سراسر کسب‌وکار',
    cta: 'انتقال بین‌انبار در hisabche.com',
    selectedOperators: ['OrbitalConduitPipe', 'BarcodeReconciliationScanner', 'MonolithHoldCta'],
  },
}
