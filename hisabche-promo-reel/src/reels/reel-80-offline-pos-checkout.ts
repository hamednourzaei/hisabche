// ============================================
// Reel 80: Offline POS Engine — Unstoppable Retail Operations (Bespoke Cut)
//
// The Cryogenic Local Database Core & Kinetic Photonic Sync Pipe
// High-conversion operational reliability narrative for retail & supermarkets.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  InstantReconnectSyncScene,
  LocalDatabaseLaserScene,
  OfflineCtaScene,
  OfflineDisasterScene,
  OfflineQueueStreamScene,
  UnstoppableBusinessScene,
} from '../scenes/offline-pos-checkout'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Arrest: The Micro-Disaster (Internet Drops at Peak Rush Hour)
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: OfflineDisasterScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'صف شلوغ، مشتری‌ها عجله دارند و ناگهان اینترنت قطع شد؛ دخلت می‌خوابه یا به فروش ادامه می‌دی؟',
    },

    // 2 — Local SQLite Vault & 0ms Barcode Laser Scan
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: LocalDatabaseLaserScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.2, kind: 'tick' },
          { at: 5.2, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در اپلیکیشن ویندوز و موبایل حسابچه، پایگاه داده روی دستگاهت زنده‌ست؛ بدون اینترنت بارکد بزن و فاکتور چاپ کن.',
    },

    // 3 — Dynamic Offline Queue Stream: 3 Invoices Safely Buffered
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: OfflineQueueStreamScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.6, kind: 'tick' },
          { at: 3.4, kind: 'cash' },
          { at: 5.4, kind: 'dataFlow' },
        ] as Cue[],
      },
      vo: 'فاکتورها یکی پس از دیگری صادر می‌شوند و در صف امن محلی دستگاه ذخیره می‌گردند؛ بدون ۱ ثانیه توقف.',
    },

    // 4 — Instant Reconnect & High-Speed Cloud Sync Surge
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: InstantReconnectSyncScene,
        cues: [
          { at: 0.2, kind: 'cameraSwish' },
          { at: 1.6, kind: 'sync' },
          { at: 3.6, kind: 'chime' },
          { at: 5.2, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'به محض وصل شدن اینترنت، تمام فاکتورها خودکار و بی‌صدا با سرور ابری و حسابداری همگام می‌شوند.',
    },

    // 5 — Unstoppable Business Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: UnstoppableBusinessScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 2.8, kind: 'bigReveal' },
        ] as Cue[],
      },
      vo: 'نه قطعی اینترنت، نه نوسان برق؛ فروشگاه شما با حسابچه هرگز متوقف نمی‌شود.',
    },

    // 6 — High-Impact Brand Monolith & CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: OfflineCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ نسخه ویندوز و موبایل. همین امروز اپلیکیشن را رایگان دانلود کنید.',
    },
  ],
  { noZoom: true },
)

export const reel80: Reel = {
  id: '80',
  title: 'کار بدون اینترنت در اوج شلوغی (Offline Engine): برق رفت، ولی فاکتور متوقف نشد!',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'قطع شدن اینترنت پای صندوق در ساعات شلوغی و از دست رفتن مشتریان عصبانی',
    oldWorkflow: 'انتظار برای وصل شدن نت یا نوشتن دستی فاکتور و مغایرت شدید در انبار و صندوق',
    friction: 'دستگاه کارتخوان یا اینترنت کار نمی‌کند و ۱۰ مشتری پشت صندوق خریدشان را رها می‌کنند',
    hisabcheAction: 'موتور آفلاین بومی در اپ ویندوز و موبایل، ذخیره لوکال و صف خروجی همگام‌سازی',
    automatedResult: 'صدور، محاسبه و چاپ فاکتور بدون ۱ ثانیه توقف و سینک بی‌صدا بعد از اتصال',
    businessOutcome: 'تداوم ۱۰۰ درصدی فروش در بدترین شرایط قطعی اینترنت و برق',
    emotionalPayoff: 'آرامش مطلق فروشنده در برابر هرگونه اختلال زیرساختی در بازار',
    cta: 'اپ آفلاین در hisabche.com',
    selectedOperators: ['LiquidGlassRefract', 'OfflineQueueSync', 'DualBoxCtaHold'],
  },
}
