// ============================================
// Reel 80: Offline POS Engine - Unstoppable Retail Operations
// Motion Template: liquid-glass-spatial
// Funnel Stage: Operational Reliability | Audience: Retail Stores, High-Volume Supermarkets
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'پایداری آفلاین در اپلیکیشن ویندوز و موبایل',
        lines: ['مشتری پای صندوق منتظره،', 'و [r:ناگهان اینترنت قطع شد]!'],
        cards: [
          { icon: 'offline', title: 'قطعی اینترنت', sub: 'توقف در سیستم‌های وب سنتی', tone: 'red' },
          {
            icon: 'sync',
            title: 'اپ ویندوز و موبایل',
            sub: 'تداوم صدور فاکتور در اپ',
            tone: 'cyan',
          },
        ],
      },
      vo: 'صف شلوغ، مشتری‌ها عجله دارند و اینترنت رفت؛ دخلت می‌خوابه یا به فروش ادامه می‌دی؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'liquid-glass',
        title: 'موتور پردازش محلی و پایداری آفلاین در اپلیکیشن حسابچه',
      },
      vo: 'در اپلیکیشن ویندوز و موبایل حسابچه، پایگاه داده روی دستگاهت زنده‌ست؛ بدون اینترنت بارکد بزن و فاکتور چاپ کن.',
    },
    {
      dur: 7,
      spec: {
        kind: 'queue',
        title: 'صف فاکتورهای آفلاین و همگام‌سازی خودکار',
        offlineLabel: 'صدور فاکتور در صف محلی دستگاه',
        items: [
          'فاکتور شماره ۱۲۴۰ (کالای بازرگانی کد ۱۰۱)',
          'فاکتور شماره ۱۲۴۱ (محصول استاندارد کد ۲۰۲)',
          'فاکتور شماره ۱۲۴۲ (فروش نقدی)',
        ],
        syncedLabel: 'اینترنت وصل شد — همگام‌سازی آنی با سرور',
        reconnectAt: 3.5,
      },
      vo: 'به محض وصل شدن اینترنت، تمام فاکتورها خودکار به سرور ابری و حسابداری منتقل می‌شوند.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel80: Reel = {
  id: '80',
  title: 'کار بدون اینترنت در اوج شلوغی (Offline Engine): برق رفت، ولی فاکتور متوقف نشد!',
  duration: total(scenes),
  scenes,
  theme: 'procedural-spatial',
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
