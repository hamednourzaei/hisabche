# 🗺️ Hisabche — رود مپ کامل پروژه
### سیستم مدیریت کسب‌وکار برای بازار افغانستان

---

> **نقش مهندس:** Senior JavaScript Engineer — 12 سال تجربه
> هیچ تصمیمی بدون دلیل فنی گرفته نمی‌شود. هر انتخاب تکنولوژی مستدل است.
> اولویت: correctness → performance → DX → aesthetics

---

## ⚙️ قوانین طلایی (Non-Negotiable)

| قانون | توضیح |
|---|---|
| هیچ hardcode رنگ یا string | همه از token و i18n |
| همه متون از i18n | `t('key')` — هرگز string مستقیم |
| همه تم از CSS variables | `var(--color-*)` — هرگز hex مستقیم |
| offline-first همیشه | هیچ عملیات اصلی به اینترنت وابسته نباشد |
| Zod validation همه جا | هم client هم server — هیچ trust به input |
| RTL در همه کامپوننت‌ها | `dir="rtl"` + logical CSS properties |
| هیچ `any` در TypeScript | strict mode — همیشه typed |
| هر تابع max 20 خط | single responsibility — قابل test |
| هر PR max 400 خط | کوچک، قابل review، قابل revert |
| هر feature با test | unit + integration — بدون exception |

---

## 📐 معماری کلی

```
hisabche/
├── apps/
│   ├── mobile/              # React Native (Android + iOS)
│   ├── desktop/             # React Native Windows
│   └── web/                 # Next.js (Dashboard + Landing)
├── packages/
│   ├── ui/                  # shadcn/ui + custom components
│   ├── i18n/                # Dari · Pashto · English
│   ├── db/                  # WatermelonDB schema + migrations
│   ├── store/               # Zustand slices
│   ├── api/                 # TanStack Query hooks
│   ├── validation/          # Zod schemas (shared)
│   └── config/              # shared tsconfig, tailwind, postcss
├── backend/
│   ├── api/                 # Fastify routes
│   ├── db/                  # PostgreSQL + Supabase
│   └── middleware/          # Arcjet + rate limiter
└── tooling/
    ├── eslint/
    ├── prettier/
    └── typescript/
```

---

## 🚀 فاز ۰ — پایه‌گذاری: Monorepo & Tooling
### هفته ۱–۲

**هدف:** زیرساخت محکم که همه فازها روی آن بنا می‌شوند.

### وظایف مهندس ارشد:

**۱. Monorepo Setup**
```bash
# Turborepo + npm workspaces
npx create-turbo@latest hisabche
cd hisabche
```

```json
// package.json (root)
{
  "name": "hisabche",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "backend/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "type-check": "turbo run type-check"
  }
}
```

**۲. TypeScript Strict Config**
```json
// packages/config/tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**۳. ESLint + Prettier**
- eslint-config-turbo
- @typescript-eslint/recommended
- eslint-plugin-react-hooks
- prettier با printWidth: 100

**Stack این فاز:**
`Turborepo` · `npm workspaces` · `TypeScript 5.5` · `ESLint` · `Prettier` · `Husky` · `lint-staged`

**تعریف Done:**
- [ ] `npm run dev` همه apps را بالا می‌آورد
- [ ] `npm run type-check` بدون خطا پاس می‌شود
- [ ] `npm run lint` بدون خطا پاس می‌شود
- [ ] pre-commit hook فعال است

---

## 🎨 فاز ۱ — Design System & Theme
### هفته ۲–۳

**هدف:** یک Design System RTL-first که dark/light را بدون hardcode پشتیبانی کند.

### وظایف مهندس ارشد:

**۱. shadcn/ui + Tailwind Setup**
```bash
npx shadcn@latest init
# انتخاب: TypeScript · CSS variables · RTL
```

**۲. CSS Variables (بدون هیچ hardcode)**
```css
/* packages/ui/src/styles/globals.css */
:root {
  --hisab-primary: 158 100% 37%;      /* HSL — نه hex */
  --hisab-primary-fg: 0 0% 100%;
  --hisab-accent: 35 80% 40%;
  --hisab-radius: 0.5rem;
}

.dark {
  --hisab-primary: 158 60% 50%;
  --hisab-primary-fg: 0 0% 5%;
}
```

**۳. Dark/Light Mode — next-themes**
```tsx
// بدون هیچ hardcode — فقط از CSS variables
const Button = () => (
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    {t('action.save')}  {/* i18n — هرگز string مستقیم */}
  </button>
)
```

**۴. انیمیشن — 3 لایه**
```tsx
// لایه ۱: Tailwind Animate — micro interactions
className="animate-in fade-in-0 zoom-in-95"

// لایه ۲: Framer Motion — page transitions
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} />

// لایه ۳: Lottie — loading states و illustrations
<LottiePlayer animationData={loadingAnimation} loop />
```

**۵. Custom Date Picker — Jalali**
```tsx
// packages/ui/src/components/date-picker/
// Day.js + jalali-moment — کاملاً custom نوشته می‌شود
// toggle بین شمسی و میلادی بدون reload
```

**۶. فونت RTL**
```css
@font-face {
  font-family: 'Vazirmatn';
  /* variable font — یک فایل برای همه weights */
}
```

**کامپوننت‌های این فاز:**
`Button` · `Input` · `Card` · `Badge` · `Modal` · `Toast` · `Skeleton` · `DatePicker` · `Select` · `Table` · `Tabs` · `Switch`

**Stack این فاز:**
`shadcn/ui` · `Tailwind CSS 3` · `PostCSS` · `next-themes` · `Framer Motion` · `lottie-react` · `tailwindcss-animate` · `Vazirmatn` · `Day.js` · `jalali-moment`

**تعریف Done:**
- [ ] toggle dark/light بدون flash
- [ ] همه کامپوننت‌ها RTL صحیح
- [ ] هیچ رنگ hardcode در کامپوننت‌ها
- [ ] DatePicker شمسی و میلادی کار می‌کند
- [ ] Storybook کامپوننت‌ها را نمایش می‌دهد

---

## 🗄️ فاز ۲ — State & Data Layer
### هفته ۳–۴

**هدف:** لایه داده محکم — offline-first، typed، قابل test.

### وظایف مهندس ارشد:

**۱. Zustand — State Management**
```ts
// packages/store/src/slices/auth.slice.ts
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

// هر slice در فایل جداگانه — هیچ god store
// packages/store/src/slices/
// ├── auth.slice.ts
// ├── theme.slice.ts
// ├── i18n.slice.ts
// ├── cart.slice.ts
// └── currency.slice.ts
```

**۲. TanStack Query v5**
```ts
// packages/api/src/hooks/invoices.ts
export const useInvoices = (filters: InvoiceFilters) =>
  useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => api.invoices.list(filters),
    staleTime: 1000 * 60 * 5,   // 5 دقیقه
    placeholderData: keepPreviousData,
  })

// Optimistic updates برای همه mutations
export const useCreateInvoice = () =>
  useMutation({
    mutationFn: api.invoices.create,
    onMutate: async (newInvoice) => {
      // optimistic update — بدون انتظار server
    },
    onError: (_err, _new, context) => {
      // rollback در صورت خطا
    },
  })
```

**۳. Zod v4 — Validation**
```ts
// packages/validation/src/schemas/invoice.schema.ts
export const InvoiceSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(InvoiceItemSchema).min(1),
  currency: z.enum(['AFN', 'USD', 'PKR', 'IRR']),
  date: z.string().datetime(),
  discount: z.number().min(0).max(100).optional(),
})

// یک schema — هم client هم server استفاده می‌کنند
export type Invoice = z.infer<typeof InvoiceSchema>
```

**۴. WatermelonDB — Offline Database**
```ts
// packages/db/src/schema.ts
const invoiceSchema = tableSchema({
  name: 'invoices',
  columns: [
    { name: 'customer_id', type: 'string', isIndexed: true },
    { name: 'total', type: 'number' },
    { name: 'currency', type: 'string' },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
})
// sync با Supabase هر 30 ثانیه در background
```

**Stack این فاز:**
`Zustand 4` · `TanStack Query v5` · `Zod v4` · `WatermelonDB` · `Supabase` · `PostgreSQL 16`

**تعریف Done:**
- [ ] همه state typed — هیچ `any`
- [ ] offline کامل — بدون اینترنت همه چیز کار می‌کند
- [ ] sync conflict resolution پیاده‌سازی شده
- [ ] همه mutations optimistic update دارند

---

## 🔒 فاز ۳ — امنیت: Anti-Bot & Rate Limiting
### هفته ۴–۵

**هدف:** اپ در برابر abuse، bot، و حملات محافظت شود.

### وظایف مهندس ارشد:

**۱. Arcjet — Anti-Bot + Rate Limit**
```ts
// backend/middleware/arcjet.ts
import arcjet, { shield, detectBot, tokenBucket } from '@arcjet/node'

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({ mode: 'LIVE', allow: ['CATEGORY:SEARCH_ENGINE'] }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 10,
      interval: 1,
      capacity: 100,
    }),
  ],
})

// هر route محافظت شده — هیچ endpoint بدون middleware
```

**۲. Supabase RLS — Row Level Security**
```sql
-- هر user فقط داده خودش را می‌بیند
CREATE POLICY "users_own_data" ON invoices
  FOR ALL USING (auth.uid() = user_id);
```

**۳. Input Sanitization**
```ts
// هر input از Zod رد می‌شود — هم client هم server
// هیچ raw SQL — فقط prepared statements
// هیچ eval یا dynamic code execution
```

**Stack این فاز:**
`Arcjet` · `Supabase Auth` · `Supabase RLS` · `JWT` · `bcrypt`

---

## 🏗️ فاز ۴ — ماژول‌های اصلی Business
### هفته ۵–۹

**هدف:** قلب سیستم — همه ماژول‌های تجاری.

### ماژول‌ها:

**۱. فاکتور (Invoice)**
- صدور فاکتور خرید و فروش
- تخفیف، مالیات، چند ارزی
- Share در واتس‌اپ و تلگرام (PDF)
- چاپ روی پرینتر حرارتی

**۲. گدام (Inventory)**
- چند گدام همزمان
- انتقال کالا بین گدام‌ها
- بارکد scanner (Vision Camera)
- هشدار اتمام موجودی

**۳. باقی‌داری (Ledger)**
- دفتر کل مشتریان
- دفتر کل تأمین‌کنندگان
- تاریخچه تراکنش‌ها
- گزارش سود و ضرر

**۴. چند ارزی (Multi-Currency)**
- افغانی · دلار · کلدار · تومان
- نرخ لحظه‌ای (API)
- تبدیل خودکار در گزارش‌ها

**۵. نقشه (OpenStreetMap)**
```ts
// Leaflet + OpenStreetMap — بدون Google Maps API key
// موقعیت دکان · مسیر تحویل
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
```

**Stack این فاز:**
`react-native-vision-camera` · `react-native-thermal-printer` · `react-native-share` · `Leaflet` · `OpenStreetMap`

---

## ⚡ فاز ۵ — پرفورمنس & بهینه‌سازی
### هفته ۹–۱۰

**هدف:** اپ روان روی گوشی‌های ارزان اندرویدی.

### وظایف مهندس ارشد:

**۱. React Native Performance**
```ts
// FlashList به جای FlatList — 10x سریع‌تر
import { FlashList } from '@shopify/flash-list'

// React.memo برای کامپوننت‌های سنگین
const InvoiceCard = React.memo(({ invoice }: Props) => { ... })

// useCallback برای همه event handlers
const handlePress = useCallback(() => { ... }, [deps])
```

**۲. Bundle Optimization**
```ts
// Dynamic import برای ماژول‌های سنگین
const Map = dynamic(() => import('@/components/Map'), { ssr: false })

// Tree shaking — فقط import کردن چیزی که استفاده می‌شود
import { format } from 'date-fns/format'  // نه import * from 'date-fns'
```

**۳. pg_search — Full Text Search فارسی**
```sql
-- جستجوی کالا و مشتری به دری
CREATE INDEX ON products USING GIN(to_tsvector('simple', name));
```

**۴. Image Optimization**
```ts
// WebP · lazy loading · proper sizing
// هیچ تصویر بدون explicit width/height
```

**معیارهای موفقیت:**
- [ ] FPS در لیست ۱۰۰۰ فاکتور: بالای ۵۵
- [ ] Time to Interactive روی Redmi 9: زیر ۳ ثانیه
- [ ] Bundle size: زیر ۵۰ مگابایت
- [ ] Lighthouse Score: بالای ۸۵

---

## 📊 فاز ۶ — Analytics & SEO & Monitoring
### هفته ۱۰–۱۱

**۱. PostHog — Product Analytics**
```ts
posthog.capture('invoice_created', {
  currency: invoice.currency,
  item_count: invoice.items.length,
  has_discount: invoice.discount > 0,
})
// Feature flags · A/B test · Session recording
```

**۲. SEO — Next.js Metadata API**
```ts
// app/layout.tsx
export const metadata: Metadata = {
  title: { template: '%s | حساب‌چه', default: 'حساب‌چه' },
  description: t('seo.description'),
  openGraph: { ... },
}
```

**۳. Sentry — Error Tracking**
```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,  // ۲۰٪ برای performance monitoring
  environment: process.env.NODE_ENV,
})
```

**Stack این فاز:**
`PostHog` · `Sentry` · `Next.js Metadata API` · `EAS Update`

---

## 🚢 فاز ۷ — Deploy & CI/CD
### هفته ۱۱–۱۲

**۱. GitHub Actions Pipeline**
```yaml
# .github/workflows/ci.yml
jobs:
  quality:
    steps:
      - lint
      - type-check
      - test
      - build

  deploy:
    needs: quality
    steps:
      - eas build (Android + iOS)
      - eas submit (stores)
      - deploy backend (Railway/Supabase)
```

**۲. Platforms**
| پلتفرم | ابزار | خروجی |
|---|---|---|
| Android | EAS Build | AAB → Play Store |
| iOS | EAS Build + Submit | IPA → App Store |
| Windows | react-native-windows | MSIX Installer |
| Web | Vercel | Next.js Deploy |
| Backend | Railway | Node.js + PostgreSQL |

---

## 🌐 i18n — چندزبانی کامل

```ts
// packages/i18n/src/locales/fa-AF.json
{
  "nav": {
    "dashboard": "داشبورد",
    "godam": "گدام",
    "faktoor": "فاکتور",
    "baqidari": "باقی‌داری"
  },
  "action": {
    "save": "ذخیره",
    "cancel": "لغو",
    "delete": "حذف"
  }
}
// هر string در اینجا — هرگز در کامپوننت مستقیم
```

**زبان‌ها:** دری (fa-AF) · پشتو (ps-AF) · انگلیسی (en)

---

## 📦 Stack کامل

### Frontend / Mobile
| ابزار | نسخه | دلیل انتخاب |
|---|---|---|
| React Native | 0.74 | cross-platform |
| Expo SDK | 51 | managed workflow |
| shadcn/ui | latest | accessible, unstyled base |
| Tailwind CSS | 3.4 | utility-first، tree-shakeable |
| PostCSS | 8 | custom transforms |
| Zustand | 4 | سبک، typed، بدون boilerplate |
| TanStack Query | 5 | server state، caching، sync |
| Zod | 4 | schema-first validation |
| Framer Motion | 11 | production-grade animation |
| Lottie React | latest | After Effects animations |
| tailwindcss-animate | latest | CSS animations |
| Lucide React | latest | tree-shakeable icons |
| Day.js | latest | سبک‌تر از moment |
| jalali-moment | latest | تقویم شمسی |
| i18next | latest | i18n کامل |
| WatermelonDB | latest | offline SQLite |

### Backend
| ابزار | نسخه | دلیل انتخاب |
|---|---|---|
| Node.js | 20 LTS | runtime |
| Fastify | 4 | سریع‌تر از Express |
| PostgreSQL | 16 | ACID، JSON، full-text |
| Supabase | latest | auth + realtime + storage |
| Arcjet | latest | anti-bot + rate limit |
| pg_search | latest | full-text search فارسی |

### DevOps
| ابزار | کاربرد |
|---|---|
| Turborepo | monorepo build system |
| GitHub Actions | CI/CD pipeline |
| EAS Build | React Native builds |
| EAS Update | OTA updates |
| Sentry | error tracking |
| PostHog | product analytics |
| Railway | backend hosting |

---

## 📅 Timeline کلی

| فاز | هفته | خروجی |
|---|---|---|
| ۰ — پایه‌گذاری | ۱–۲ | monorepo + tooling آماده |
| ۱ — Design System | ۲–۳ | همه کامپوننت‌های پایه |
| ۲ — Data Layer | ۳–۴ | state + offline DB |
| ۳ — امنیت | ۴–۵ | arcjet + auth + RLS |
| ۴ — Business Modules | ۵–۹ | فاکتور + گدام + باقی‌داری |
| ۵ — Performance | ۹–۱۰ | بهینه‌سازی کامل |
| ۶ — Analytics | ۱۰–۱۱ | PostHog + Sentry + SEO |
| ۷ — Deploy | ۱۱–۱۲ | همه پلتفرم‌ها live |

---

*hisabche.com — ساخته شده با دقت برای کسبه افغانستان*