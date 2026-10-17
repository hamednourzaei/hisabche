// ============================================
// Video 01: Where does bookkeeping live in your business? (55s)
// Funnel stage: Awareness | Audience: All | SaaS Production Level
// Claims-controlled: real product flows, zero fake promises.
// Theme: Dark Obsidian Cinematic
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence([
  {
    dur: 4,
    spec: {
      kind: 'hook',
      label: 'سامانه ابری حسابچه',
      lines: ['در کسب‌وکار تو،', 'حساب‌وکتابت [r:چند جا پخش شده]؟'],
      cards: [
        { icon: 'notebook', title: 'دفترچه سنتی', sub: 'یادداشت‌های دست‌نویس', tone: 'red' },
        { icon: 'sheet', title: 'فایل‌های اکسل', sub: 'جدول‌های نامرتبط', tone: 'purple' },
      ],
    },
    vo: 'فروش، موجودی و حساب مشتری‌ها هنوز هرکدام یک جای جدا هستند؟',
  },
  {
    dur: 8,
    spec: {
      kind: 'cinematic-product',
      title: 'یک فضای کاری [c:منظم‌تر و متمرکز]',
      subtitle: 'عملیات روزمره کسب‌وکار در یک بستر هماهنگ',
      floatingBadge: 'مدیریت داده‌های مالی بدون پراکندگی',
      layers: [
        {
          title: 'دفتر فروش و فاکتورها',
          desc: 'صدور، بازبینی و پیگیری فاکتور در لحظه',
          icon: 'receipt',
          tone: 'cyan',
          z: 60,
        },
        {
          title: 'پرونده و سابقه مشتری',
          desc: 'مانده حساب و ثبت دریافتی نقد و نسیه',
          icon: 'user',
          tone: 'purple',
          z: 0,
        },
        {
          title: 'کاردکس موجودی انبار',
          desc: 'بررسی ورود، خروج و مانده واقعی کالا',
          icon: 'boxes',
          tone: 'green',
          z: -60,
        },
      ],
    },
    vo: 'حسابچه کمک می‌کند عملیات روزمره کسب‌وکارت را در یک سیستم منظم‌تر دنبال کنی.',
  },
  {
    dur: 13,
    spec: {
      kind: 'hub',
      title: 'ارتباط یکپارچه: [g:فروش • مشتری • موجودی]',
      core: 'حسابچه',
      coreSub: 'هسته داده',
      nodes: [
        { icon: 'receipt', label: 'فاکتور فروش' },
        { icon: 'user', label: 'حساب مشتری' },
        { icon: 'boxes', label: 'موجودی کالا' },
        { icon: 'wallet', label: 'دریافت و پرداخت' },
      ],
    },
    vo: 'از ثبت فروش و پیگیری حساب مشتری تا بررسی موجودی، اطلاعاتت را به هم مرتبط نگه دار.',
  },
  {
    dur: 14,
    spec: {
      kind: 'mockup',
      device: 'window',
      title: 'نسخه وب و اپلیکیشن',
      subtitle: 'وب برای کار آنلاین؛ اپ برای جریان‌های آفلاین پشتیبانی‌شده',
      screen: {
        type: 'pos',
        header: 'صندوق فروش فروشگاهی حسابچه',
        items: [
          { name: 'کالای تجاری کد ۱۰۱', qty: '۳ عدد', price: '۲٬۲۵۰' },
          { name: 'محصول استاندارد کد ۲۰۲', qty: '۱ بسته', price: '۳٬۴۰۰' },
          { name: 'کالای مصرفی کد ۳۰۳', qty: '۲ کارتن', price: '۱٬۸۰۰' },
        ],
        totalLabel: 'جمع فاکتور',
        totalValue: '۷٬۴۵۰',
      },
      toast: { icon: 'check', text: 'فاکتور با موفقیت ثبت شد', time: 5 },
      cursor: { x: 380, y: 530, clickAt: 4.2 },
    },
    vo: 'متناسب با روش کارت از نسخه وب یا اپ استفاده کن؛ قابلیت آفلاین مربوط به اپ‌های پشتیبانی‌شده است.',
  },
  {
    dur: 9,
    spec: {
      kind: 'chart',
      title: 'دید روشن‌تر از [c:کار روزانه مغازه]',
      chartType: 'area',
      kpis: [
        { label: 'فاکتورهای امروز', value: 48, unit: 'عدد', tone: 'cyan' },
        {
          label: 'فروش روز جاری',
          value: 185000,
          unit: '',
          trend: 'ثبت‌شده در سیستم',
          tone: 'green',
        },
      ],
      data: [
        { label: '۸ صبح', value: 20 },
        { label: '۱۰ صبح', value: 45 },
        { label: '۱۲ ظهر', value: 75 },
        { label: '۳ عصر', value: 60 },
        { label: '۶ عصر', value: 95 },
      ],
    },
    vo: 'هدف، فقط ثبت عددها نیست؛ هدف این است که راحت‌تر بفهمی چه اتفاقی در کسب‌وکارت افتاده.',
  },
  ctaScene(7),
])

export const reel01: Reel = {
  id: '01',
  title: 'حساب‌وکتابت کجا زندگی می‌کند؟',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
}
