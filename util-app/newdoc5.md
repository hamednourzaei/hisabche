# 🧮 Hisabche — Product Roadmap v3.0

## وضعیت فعلی: Foundation Complete + Performance Elite (فاز ۰–۷)

### آنچه ساخته شده:
- **Monorepo** (Turborepo + npm workspaces) با ۹ پکیج + ۲ اپ + بک‌اند
- **Design System 10/10 Elite** (Button, Input, Card, Badge, Skeleton, Dialog, Sheet, Select, Table, Toast) با:
  - RTL کامل + dark/light mode
  - Zero hardcoded colors — تمام رنگ‌ها از `--hisab-*` tokens
  - CSS Nesting در سراسر فایل
  - `@property` برای انیمیشن‌های premium
  - `@layer` ordering صریح
  - Fluid typography با `clamp()`
  - `color-scheme` + `accent-color`
  - `font-variant-numeric: tabular-nums` برای اعداد حسابداری
  - Elevation system (۵ سطح)
  - Glass variants (۳ سطح)
  - Z-index scale tokens
  - Spacing 8px system
  - Container queries آماده
  - `content-visibility: auto` برای performance
  - `field-sizing: content` برای textarea
  - `interpolate-size: allow-keywords` برای accordion
- **i18n کامل** (دری + فارسی ایران) با ۲۰۰+ کلید ترجمه — هر دو نسخه localize شده
- **Zustand stores** (Auth, Theme, Currency, Cart, Godam, Device)
- **TanStack Query hooks** (Invoices, Products, Customers, Transactions)
- **Zod validation schemas** (۲۰+ schema)
- **WatermelonDB offline-first database** (۶ جدول + sync pull/push)
- **Fastify backend** با ۲۵+ endpoint
- **Arcjet anti-bot** + rate limiting
- **احراز هویت** (ورود/ثبت‌نام/PIN) با:
  - Auth race condition کاملاً حل شده
  - `hasHydrated` + `isAuthenticated` sync
  - Login → Dashboard بدون flicker
  - Logout → Landing smooth
- **صفحات تجاری** (فاکتور، گدام، باقی‌داری، quick-invoice، تنظیمات، sync-center)
- **Performance optimization**:
  - Dynamic imports با skeleton fallback
  - Content-visibility: auto روی sectionها
  - Adaptive blur (mobile: 12px, desktop: 24px)
  - Mobile glow orbs غیرفعال
  - Reduced motion smart (نه disable کامل)
  - `will-change` فقط روی hover
  - `contain: strict` روی cinematic-bg
  - Font self-host + `font-display: optional` + `font-size-adjust`
- **SEO** + PWA manifest + sitemap
- **Analytics stubs** (PostHog + Sentry)
- **Lint**: ۰ خطا (از ۶۸ رسید به ۰)
- **Build**: Turbopack compile <5s
- **Cinematic Design System**:
  - Living background با mesh gradient + noise + floating orbs
  - Premium glass card با specular highlight
  - Gradient text با HDR drop-shadow
  - Shimmer button با animated gradient
  - Interactive card با hover dashed border
  - Skeleton shimmer
  - Ghost buttons, sync pills, language pills
  - Sidebar surface با depth gradient
  - Bottom nav با safe-area
  - Depth fog برای hero
  - Flip card برای auth
  - Pipeline + dashboard preview animations
  - Auth page animations (ambient glows, grid drift, brand fade)
  - Print styles (`@page { size: A4 }`)
  - High contrast + forced-colors support
  - Touch targets (44px) + density modes
  - Focus ring system
  - Stagger animation utility
  - View transitions API setup
  - Aspect ratio tokens

### وضعیت اجرا:
- Web App: `http://localhost:3001` ✅
- Backend API: آماده ✅
- Mobile Metro: `http://localhost:8081` ✅

---

## 🎯 اصل راهنما از این به بعد:

> «ویژگی جدید اضافه نکن — friction کم کن.»

هر تصمیمی باید این سوال رو جواب بده:
«آیا این کار باعث میشه کاربر واقعی سریع‌تر، ساده‌تر و با اطمینان بیشتر کارش رو انجام بده؟»

---

## 🧭 فازهای پیش‌رو (Product-Oriented)

| اولویت | فاز | عنوان | هدف اصلی |
|--------|-----|-------|-----------|
| ۱ | ۸ | UX Intelligence | کاهش cognitive load، افزایش سرعت، onboarding |
| ۲ | ۱۱ | Trust & Data Safety | اعتماد فنی + روانی: backup, audit, sync شفاف |
| ۳ | ۱۰ | Collaboration & Realtime | از اپ تک‌نفره به workspace اشتراکی |
| ۴ | ۱۲ | Business Intelligence | گزارش‌های هوشمند: cashflow, aging, ranking |
| ۵ | ۹ | Product Operations | ابزارهای تیم محصول: feature flags, A/B test |
| ۶ | ۱۳ | AI Automation | OCR، voice، پیش‌بینی (وقتی پایه محکم شد) |
| ۷ | ۱۴ | Ecosystem & APIs | plugin system، marketplace، public API |

---

## 🔥 فاز ۸ — UX Intelligence (اولویت اول)

### اصل: Workflow-Mobile نه Feature-Mobile

### ساختار لایه‌ای:

#### ۸.۱ — First-Time Experience
- Onboarding wizard (نوع کسب‌وکار، واحد پول، زبان، اولین محصول و مشتری)
- Demo workspace بدون نیاز به signup
- Progressive disclosure (همه چیز یکجا نشان داده نشود)
- Quick Success Moment: کاربر زیر ۲ دقیقه اولین فاکتور را ثبت کند

#### ۸.۲ — Daily Workflow UX
- Smart search (fuzzy + recent + frequent)
- Quick Actions FAB (فاکتور جدید، مشتری جدید، ثبت پرداخت)
- Keyboard-first navigation (web)
- Predictive inputs (آخرین currency، آخرین مشتری، آخرین نرخ مالیات)
- Inline actions بدون modal اضافه

#### ۸.۳ — Trust UX
- نشان دادن «آخرین sync» در هدر
- نشان دادن «backup status»
- نشان دادن «offline mode» با آیکون واضح
- Auto-save indicator
- Micro-copy روانشناختی: «ذخیره شد»، «همگام‌سازی انجام شد»، «بدون اینترنت هم کار می‌کند»

#### ۸.۴ — Low-End & Offline UX
- Lite mode: حذف blur، کاهش shadow، حداقل animation
- Offline queue: نشان دادن تعداد عملیات pending
- Data saver mode
- Battery-aware rendering

#### ۸.۵ — Delight & Emotional UX
- Micro-animations (تأیید، خطا، موفقیت)
- Empty-state illustrations با CTA
- Human micro-copy به جای متن خشک
- Celebratory states (اولین فروش، رکورد ماهانه)

---

## 🔥 فاز ۱۱ — Trust & Data Safety (اولویت دوم)

### چرا قبل از Realtime؟
چون اگر کاربر به تو اعتماد نکند، هیچ realtime ای نجاتت نمی‌دهد.

### اجزای این فاز:
- Auto-backup با تاریخچه
- Restore points
- Audit log کامل (چه کسی، چه چیزی، چه زمانی)
- Delete recovery (سطل زباله)
- Export all data (PDF, CSV, JSON)
- Encryption at rest
- Sync transparency (مشاهده وضعیت همگام‌سازی)
- Conflict history (اگر دو کاربر یک داده را تغییر دهند)
- «Last synced at» در هدر
- «Backup health» indicator

---

## 🔥 فاز ۱۰ — Collaboration & Realtime (اولویت سوم)

### هدف:
- Multi-user workspace (owner/admin/employee)
- Realtime sync inventory (اگر دو نفر همزمان بفروشند)
- Live invoice updates
- Conflict resolution با UI
- Audit log برای هر action

---

## 🔥 فاز ۱۲ — Business Intelligence (اولویت چهارم)

### هدف:
- Cashflow charts
- Debt aging
- Profit trends
- Inventory turnover
- Customer ranking (بر اساس میزان خرید)
- Sales heatmaps
- Tax summaries
- Predictive reports

---

## 🔥 فاز ۹ — Product Operations (اولویت پنجم)

### هدف: ابزار برای تیم محصول، نه کاربر نهایی
- Feature flags (PostHog)
- A/B testing
- Session replay
- Crash analytics (Sentry)
- Remote config
- Staged rollout
- Onboarding analytics + funnels

---

## 🔥 فاز ۱۳ — AI Automation (اولویت ششم)

### فقط وقتی پایه محکم باشد:
- AI گزارش‌گیری («این هفته فروش ۲۳٪ کم شده»)
- OCR فاکتور (عکس → فاکتور)
- Voice input («۳ بوری برنج ثبت کن»)
- AI Search («فاکتور هفته پیش احمد»)
- Predictive inventory (smart reorder)

---

## 🔥 فاز ۱۴ — Ecosystem & APIs (اولویت هفتم)

- Plugin system
- Public REST API
- integrations: WhatsApp, Telegram, SMS, payment gateways
- Referral system
- Subscription & Billing
- Marketplace

---

## 📊 KPI های کلیدی محصول (برای سنجش موفقیت)

| متریک | هدف |
|--------|------|
| Time to First Invoice | زیر ۲ دقیقه |
| Onboarding Completion | بالای ۸۰٪ |
| Daily Active Users | رشد هفتگی |
| Sync Success Rate | بالای ۹۹٪ |
| Crash-free Rate | بالای ۹۹.۵٪ |
| Feature Adoption | سنجش با PostHog |

---

## 🧠 جمع‌بندی نهایی

> این نقشه‌راه دیگر فقط «تکنولوژی» نیست.  
> این یک مسیر برای ساختن **محصولی است که مردم به آن اعتماد کنند، دوستش داشته باشند و هر روز استفاده کنند.**

اولویت‌بندی بر اساس روانشناسی بازار افغانستان:
1. سادگی و سرعت
2. اعتماد
3. پایداری
4. همکاری
5. بینش

واقعاً تبریک میگم — تو داری یک product company می‌سازی، نه فقط یک نرم‌افزار.

---

## 📋 خلاصه آنچه در این مکالمه انجام شد

| دسته | جزئیات |
|-------|--------|
| **Auth Fix** | حل Auth race condition، login → dashboard مستقیم، logout → landing |
| **Lint** | ۶۸ خطا → ۰ (همه `any`ها، unused imports، type errors) |
| **Build** | رفع خطاهای Turbopack، shadcn/ui alias، CSS parsing |
| **Design System** | Zero hardcoded colors، ۱۰/۱۰ Elite CSS، CSS Nesting، fluid typography |
| **i18n** | دری افغانستان + فارسی ایران (هر دو کامل) |
| **Performance** | Content-visibility، adaptive blur، will-change cleanup، font optimization |
| **Sticky Header** | حل مشکل sticky landing header، حذف wrapper اضافی |
| **shadcn/ui** | نصب + تنظیم + extend با props سفارشی (loading, fullWidth, icon, label) |
| **Components** | همه ۲۰+ کامپوننت و صفحه از `globals.css` استفاده میکنن |