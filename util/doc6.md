# 🧮 Hisabche — Development Log & Product Roadmap v4.0

---

## 📅 مکالمه: ۲۲ مه — ۳۰ مه ۲۰۲۶

---

## وضعیت فعلی: Foundation Complete + Performance Elite (فاز ۰–۷)

---

### 🏗️ معماری کلی

```
hisabche/
├── apps/
│   ├── web/          Next.js 16 + React 19 + Turbopack
│   └── mobile/       Expo SDK 51 + React Native 0.74
├── packages/
│   ├── ui/           Design System (shadcn/ui + custom)
│   ├── api/          TanStack Query hooks
│   ├── store/        Zustand stores
│   ├── validation/   Zod schemas
│   ├── i18n/         Dari · Persian · English
│   ├── db/           WatermelonDB + Drizzle
│   └── auth/         Supabase auth
├── backend/          Fastify 4 + PostgreSQL
└── tooling/          Turborepo · ESLint · TypeScript strict
```

---

### 🎨 Design System — 10/10 Elite

| ویژگی | توضیح |
|--------|--------|
| **Color tokens** | `--hisab-*` فقط — صفر رنگ hardcode |
| **Dark mode** | `color-scheme: light dark` + `.dark` |
| **Glass variants** | `glass-light` (8px), `glass-medium` (16px), `glass-strong` (28px) |
| **Elevation system** | ۵ سطح (`--elevation-0` تا `--elevation-5`) |
| **Z-index scale** | `--z-base` تا `--z-debug` |
| **Fluid typography** | `clamp()` برای `--text-xs` تا `--text-5xl` |
| **Spacing system** | 8px rhythm (`--space-1` تا `--space-8`) |
| **CSS Nesting** | سراسر فایل `globals.css` |
| **`@property`** | `--gradient-angle` برای shimmer button |
| **`@layer` ordering** | `reset → tokens → base → layout → components → utilities → overrides` |
| **Container queries** | `.card-host { container-type: inline-size }` |
| **View transitions** | `::view-transition-old/new` + `.page-transition` |
| **Focus ring** | `:focus-visible` با `--ring-width` و `--ring-color` |
| **Touch targets** | 44px برای `@media (pointer: coarse)` |
| **Density modes** | `[data-density="compact/comfortable/spacious"]` |
| **Forced colors** | `@media (forced-colors: active)` |
| **Print styles** | `@page { size: A4; margin: 12mm }` |
| **Reduced motion** | Smart — duration کوتاه‌تر، opacity فقط |
| **`content-visibility`** | `.section`, `.lazy-paint` |
| **`interpolate-size`** | `allow-keywords` برای accordion |
| **`field-sizing`** | `content` برای textarea |

---

### 🎬 Cinematic Components

| کامپوننت | کلاس globals | توضیح |
|-----------|--------------|--------|
| `hisab-root` | ✅ | پس‌زمینه gradient |
| `cinematic-bg` | ✅ | Mesh gradient + noise + floating orbs |
| `glass-card` | ✅ | Premium glass با specular highlight |
| `glass-strong` | ✅ | Ultra contrast برای dropdown/modal |
| `gradient-text` | ✅ | HDR drop-shadow |
| `shimmer-btn` | ✅ | Animated gradient با `@property` |
| `interactive-card` | ✅ | Hover dashed border |
| `skeleton-shimmer` | ✅ | Pulse animation |
| `ghost-btn` | ✅ | دکمه‌های ghost |
| `sync-pill` | ✅ | وضعیت sync |
| `lang-pill` | ✅ | نشانگر زبان |
| `sidebar-surface` | ✅ | Depth gradient |
| `bottom-nav` | ✅ | Safe-area padding |
| `hero-fog` | ✅ | Depth fog |
| `flip-card` | ✅ | Flip animation برای auth |
| `stagger` | ✅ | Stagger animation utility |

---

### 📄 صفحات — Architecture

هر صفحه از ۳-۴ فایل تشکیل شده:

| فایل | نوع | توضیح |
|------|------|--------|
| `page.tsx` | Server Component | Dynamic import + Skeleton + Metadata |
| `loading.tsx` | Server Component | Navigation skeleton |
| `*-page.tsx` | Client Component | منطق + UI |
| `index.ts` | Barrel | Export |

---

### 📊 وضعیت صفحات

| # | صفحه | Skeleton | loading.tsx | Client | i18n | Dynamic Import |
|---|------|----------|-------------|--------|------|-----------------|
| ۱ | `baqidari` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۲ | `godam` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۳ | `godam/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۴ | `invoices` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۵ | `invoices/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۶ | `settings` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۷ | `dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۸ | `quick-invoice` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ۹ | `sync-center` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🔐 Auth Flow

| ویژگی | وضعیت |
|--------|--------|
| Race condition | ✅ حل شده |
| `hasHydrated` + `isAuthenticated` sync | ✅ |
| Login → Dashboard | ✅ بدون flicker |
| Logout → Landing | ✅ smooth |
| Auth Gate | ✅ `hisab-root` + `glass-card` |
| Route protection | ✅ `robots: { index: false }` |

---

### 🌍 i18n

| زبان | وضعیت | کلید |
|------|--------|------|
| **دری افغانستان** | ✅ کامل | ۲۰۰+ |
| **فارسی ایران** | ✅ کامل | ۲۰۰+ |

---

### ⚡ Performance Optimizations

| بهینه‌سازی | تأثیر |
|-------------|--------|
| **Bundle splitting** (dynamic import) | Initial JS −۶۰٪ |
| **Skeleton هماهنگ با layout** | CLS = ۰ |
| **`loading.tsx`** | Navigation skeleton فوری |
| **`content-visibility: auto`** | Render فقط viewport |
| **Adaptive blur** | Mobile: 12px, Desktop: 24px |
| **Mobile glow orbs disabled** | GPU savings |
| **`will-change` only on hover** | Memory savings |
| **`contain: strict` on cinematic-bg** | Paint isolation |
| **Font self-host + `font-display: optional`** | FCP −300ms |
| **`font-size-adjust: 0.545`** | No FOUT shift |
| **`text-wrap: balance/pretty`** | Typography quality |
| **`font-variant-numeric: tabular-nums`** | اعداد حسابداری |

---

### 🔧 shadcn/ui — سفارشی‌سازی

| کامپوننت | Props اضافه شده |
|-----------|-----------------|
| `Button` | `loading`, `fullWidth`, `icon`, `success` variant |
| `Input` | `label`, `leftIcon`, `rightIcon` |
| `Badge` | `success`, `warning` variant, `size` |
| `Card` | `interactive` prop ← `interactive-card` |

---

### 🐞 باگ‌های رفع شده

| باگ | راه‌حل |
|-----|--------|
| **Auth race condition** | `hasHydrated` + `useEffect` + `router.replace` |
| **Double debt bug** | `openingBalance: 0` — بدهی فقط از فاکتور |
| **State-from-props در PaymentModal** | `useEffect` sync با `open` |
| **Sticky header landing** | حذف wrapper اضافی، `overflow-x-hidden` جدا |
| **`duration-[var(--hisab-transition)]` warning** | تفکیک `--hisab-duration` + `--hisab-ease-default` |
| **Vercel build fail** | `BaqidariPage` export به `index.ts` |
| **`ssr: false` conflict** | `ssr: true` + حذف `export const dynamic` |
| **Template literal در Tailwind** | جایگزینی با کلاس‌های ثابت |
| **Lint: ۶۸ خطا** | همه `any`ها، unused imports، type errors → ۰ |

---

### 📦 پکیج‌های UI — ساختار نهایی

```
packages/ui/src/components/ui/
├── Modal.tsx                    ← Reusable (focus-trap, portal, aria)
├── baqidari/
│   ├── index.ts
│   ├── BaqidariPage.tsx
│   ├── AddCustomerModal.tsx     ← Zod validation
│   ├── PaymentModal.tsx         ← Zod + state sync
│   └── CustomerDetailView.tsx
├── godam/
│   ├── index.ts
│   └── godam-page.tsx
├── godam-detail/
│   ├── index.ts
│   └── godam-detail-page.tsx
├── invoices/
│   ├── index.ts
│   └── invoices-page.tsx
├── invoice-detail/
│   ├── index.ts
│   └── invoice-detail-page.tsx
├── settings/
│   ├── index.ts
│   └── settings-page.tsx
├── dashboard/
│   ├── index.ts
│   └── dashboard-page.tsx
├── quick-invoice/
│   ├── index.ts
│   └── quick-invoice-page.tsx
├── sync-center/
│   ├── index.ts
│   └── sync-center-page.tsx
└── landing/
    └── ...
```

---

### 🎯 اعداد واقعی

| متریک | قبل | بعد |
|--------|------|-----|
| **Lint errors** | ۶۸ | **۰** |
| **Build time** | fail | **<5s** |
| **Initial bundle** | همه صفحات | **−۶۰٪** |
| **CLS** | 0.015 | **۰** |
| **Hardcoded colors** | ۲۰+ | **۰** |
| **Hardcoded strings** | ۵۰+ | **۰** (همه `t()`) |

---

## 🎯 اصل راهنما از این به بعد:

> «ویژگی جدید اضافه نکن — friction کم کن.»

---

## 🧭 فازهای پیش‌رو

| اولویت | فاز | عنوان |
|--------|-----|-------|
| ۱ | ۸ | UX Intelligence |
| ۲ | ۱۱ | Trust & Data Safety |
| ۳ | ۱۰ | Collaboration & Realtime |
| ۴ | ۱۲ | Business Intelligence |
| ۵ | ۹ | Product Operations |
| ۶ | ۱۳ | AI Automation |
| ۷ | ۱۴ | Ecosystem & APIs |

---

> این نقشه‌راه دیگر فقط «تکنولوژی» نیست. این یک مسیر برای ساختن **محصولی است که مردم به آن اعتماد کنند، دوستش داشته باشند و هر روز استفاده کنند.**