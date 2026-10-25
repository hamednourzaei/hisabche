// ============================================
// Reel 72: Warehouse Transfer - In-Transit Accountability
// Motion Template: isometric-exploded-ui
// Funnel Stage: Operational Excellence | Audience: Wholesalers, Multi-branch, Logistics
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'لجستیک و انبارداری چندشعبه',
        lines: ['کامیون بار خالی کرد،', 'ولی [r:کارتن‌ها تو انبار نیست]!'],
        cards: [
          { icon: 'truck', title: 'حواله خروج', sub: '۵۰ کارتن ثبت‌شده', tone: 'cyan' },
          { icon: 'boxes', title: 'انبار مقصد', sub: 'فقط ۴۲ کارتن تحویل شد', tone: 'red' },
        ],
      },
      vo: 'بار از انبار مرکزی رفت، ولی انبار مقصد می‌گه ۸ کارتن کسر داره؛ کی پاسخگوئه؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'isometric-exploded',
        title: 'رهگیری سه‌بعدی زنجیره انتقال انبار',
      },
      vo: 'در حسابچه، حواله انتقال انبار یک وضعیت بین‌راهی زنده داره؛ تا رسید مقصد ثبت نشه، سند بسته نمی‌شه.',
    },
    {
      dur: 7,
      spec: {
        kind: 'stagger',
        title: 'کنترل لحظه‌ای [c:حواله بین‌انبار] حسابچه',
        header: ['ثبت ۴ مرحله‌ای', 'بدون کسری'],
        rows: [
          { icon: 'receipt', text: 'صدور حواله انبار مبدأ' },
          { icon: 'truck', text: 'انتقال به وضعیت کالای در راه' },
          { icon: 'barcode', text: 'اسکن بارکد در انبار مقصد' },
          { icon: 'check', text: 'تطبیق خودکار و تراز موجودی' },
        ],
        interval: 0.8,
        tone: 'cyan',
      },
      vo: 'مبدأ، راننده، مقصد؛ هر مرحله با بارکد تایید می‌شه و هیچ باری در هوا گم نمی‌مونه.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel72: Reel = {
  id: '72',
  title: 'انتقال بین انبارها: بار رفت، ولی هنوز نرسیده!',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'کسری بار و گم شدن اقلام در مسیر انتقال بین انبار مرکزی و شعبات',
    oldWorkflow: 'حواله کاغذی راننده، تماس تلفنی و ادعای مغایرت انباردار مقصد',
    friction: '۸ کارتن کالا گم می‌شود و هیچ‌کس مسئولیت بین‌راهی را نمی‌پذیرد',
    hisabcheAction: 'حواله انتقال دومرحله‌ای با وضعیت زنده In-Transit و اسکن بارکد تحویل',
    automatedResult: 'تطبیق کاردکس دو انبار در لحظه تایید نهایی بدون حتی یک قلم مغایرت',
    businessOutcome: 'صفر شدن کسری لجستیک و انضباط کامل موجودی در تمام انبارها',
    emotionalPayoff: 'آرامش خیال مدیر از سلامت چرخه پخش و انبارداری',
    cta: 'مدیریت چند انبار در hisabche.com',
    selectedOperators: ['IsometricExplodePlunge', 'DynamicSpotlightCone', 'DualBoxCtaHold'],
  },
}
