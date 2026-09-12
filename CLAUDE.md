# حسابچه — راهنمای سشن

> این فایل هر سشن **خودکار** بارگذاری می‌شود. عمداً کوتاه است: نقشه است، نه دانشنامه.
> جواب هر سوالی در فایلی است که این‌جا به آن اشاره شده — قبل از گشتن کدبیس، آن را باز کن.

نرم‌افزار حسابداری و ERP فارسی/دری. monorepo با pnpm + Turbo.

---

## ۰. محدودیت اجرایی — قبل از هر کاری

**هیچ DDL/Migration مستقیم روی دیتابیس زنده‌ی Supabase اجرا نمی‌شود.**
تو فقط دو چیز می‌سازی: (۱) فایل Migration در `docs/` — additive، idempotent، با بلوک
Rollback/Mitigation؛ (۲) Verification Query جدا. **انسان** آن‌ها را در SQL Editor اجرا می‌کند.

تا وقتی نتیجه‌ی واقعی از طرف انسان گزارش نشده، هرگز ننویس «Post-migration Audit: PASS».
بنویس: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

---

## ۱. پنج قانونی که همه‌چیز بر آن‌هاست

1. **`workspace_id` تنها مرز امنیتی است.** `user_id` می‌گوید چه کسی کاری کرد و **هرگز** فیلتر نیست. سرویس‌ها `TenancyContext` می‌گیرند، نه `userId`.
2. **نقش را از `request.tenancy.role` بخوان، نه `request.userRole`.** دومی برای کاربرِ چند-workspace خالی است.
3. **پول همیشه در واحد کوچک (integer).** هیچ float ای در مسیر مالی.
4. **supabase-js تراکنش ندارد** → نوشتن چند-جدولی باید Postgres function باشد و با `.rpc()` صدا زده شود. `DELETE` جبرانی **ممنوع**.
5. **تست سبز اثبات نیست.** اثبات یعنی HTTP واقعی یا دیتابیس واقعی.

---

## ۲. چهار Guardrail

- **G1 — بدون UI Theater:** بدون mockup، بدون API جعلی، بدون داده‌ی ساختگی. یا داده‌ی واقعی، یا empty state صریح.
- **G2 — بدون معماری موازی:** موجود را پیدا کن و گسترش بده. هرگز مدل/کامپوننت/استور دومی کنار اولی نساز.
- **G3 — بدون Migration مخرب:** additive، idempotent، قابل اجرای مجدد.
- **G4 — بدون Policy تعریف‌نشده:** هر تنظیمی باید مقدار پیش‌فرض صریح داشته باشد.
- **§12 — بدون Backfill جعلی:** داده‌ی ناقص قدیمی `Unknown` می‌ماند. حدس‌زدن نقش/مقدار، ادعای دروغ درباره‌ی یک آدم واقعی است.
- **§13 — بدون تعمیر بی‌صدا:** اول گزارش بده، بعد اصلاح.

---

## ۳. ساختار

```
backend/          Fastify + supabase-js + zod + vitest
packages/
  api             هوک‌های React Query  ← asList() این‌جاست
  ui              همه‌ی کامپوننت‌ها (وب + دسکتاپ مشترک)
  ui-contract     قرارداد وضعیت/فهرست/نما/صف کار
  validation      اسکیماهای zod + قواعد دامنه
  formatting      پول، تاریخ، ارقام، CSV  ← تنها جای فرمت
  store           zustand
  i18n            messages/{fa,af,en}/common.json
  auth-core       مدل Session و نقش‌ها
apps/
  web             Next.js 16 App Router، پیشوند [lang]
  desktop         Electron + react-router (hash)، shim برای next-*
  mobile          Expo / React Native، Jest
  admin           پنل پلتفرم
docs/             ۹۵ فایل SQL + گزارش‌ها. Migration ها این‌جا ساخته می‌شوند.
```

`fa`، `af`، `en` هر سه **فعال**‌اند. هر کلید جدید باید در **هر سه** باشد —
`t()` روی کلید ناموجود **throw** می‌کند و کل صفحه را به error boundary می‌برد.

---

## ۴. دانش پروژه — کجا را باز کنی

| سوال                                               | فایل                                          |
| -------------------------------------------------- | --------------------------------------------- |
| **نقشه‌ی کل دانش**                                 | `.claude/README.md` — **اول این**             |
| باگ خوردم / چطور وریفای کنم                        | `.claude/DEBUG-PLAYBOOK.md`                   |
| تله‌های این سشن‌ها (ابزار، Next، Electron، ویندوز) | `.claude/SESSION-CACHE.md`                    |
| چرا این‌طوری نوشته شده / قبلاً چه اشتباهی شد       | `.claude/lessons-learned.md` — ۹۲ درس         |
| الان چه کار می‌کند و چه نه                         | `.claude/STATE.md`                            |
| کد جدید کجا برود                                   | `.claude/architecture/core-modules.md`        |
| کدام hook به کدام endpoint                         | `.claude/architecture/api-surface.md`         |
| جدول‌ها و RLS                                      | `.claude/architecture/data-model.md`          |
| Source of Truth هر داده / کدام migration اجرا شده  | `.claude/SESSION-2026-09-05-CONSOLIDATION.md` |
| migration/تست/commit چطور                          | `.claude/WORKFLOW.md`                         |
| مقایسه با ERPNext و Odoo                           | `.claude/research/`                           |
| خواسته‌های محصول                                   | `.claude/detail.md`                           |

---

## ۵. توانایی‌های آماده — قبل از نوشتن دستی، این‌ها را صدا بزن

**Skills** (`.claude/skills/`) — `hisabche-` + یکی از:
`architecture` · `auth` · `backend` · `code-review` · `database` · `debugging` ·
`desktop` · `i18n` · `lessons` · `mobile` · `offline` · `testing` · `ui` · `web`

**Commands** (`.claude/commands/`): `/verify` · `/review` · `/db-migration` · `/i18n-check` · `/security-audit`

**Agents** (`.claude/agents/`): `security-reviewer` · `domain-reviewer` · `parity-reviewer`

کارهای طولانی بیلد/وریفای را به ایجنت جدا بده و موازی ادامه بده.

---

## ۶. وریفای

```bash
cd backend        && npx tsc --noEmit && npx vitest run
cd packages/ui    && npx tsc --noEmit && npx vitest run
cd apps/web       && npx tsc --noEmit
cd apps/desktop   && npx tsc --noEmit && npx jest
cd apps/admin     && npx tsc --noEmit
```

---

## ۷. تله‌هایی که بارها زده‌اند

- **type annotation یک چک زمان‌اجرا نیست.** `(x ?? []).map is not a function` دو صفحه‌ی محصول را انداخت. هر چیزی که به‌صورت لیست رندر می‌شود باید از `asList<T>()` در `packages/api/src/lib/as-list.ts` رد شود.
- **`exactOptionalPropertyTypes: true`** در کل monorepo. `prop?: string` مقدار `undefined` صریح را **رد** می‌کند؛ بنویس `prop?: string | undefined`.
- **React 19:** خواندن `document`/`window` هنگام render یعنی hydration mismatch و دور ریختن کل درخت. فقط داخل effect.
- **هوک بعد از early return** = conditional hook. `conditional-hook-call.test.ts` برای همین هست.
- **Tailwind v3 JIT:** مقدار arbitrary که کاما دارد **هیچ CSS تولید نمی‌کند**.
- **Radix `asChild`/`Slot`** دقیقاً یک فرزند می‌گیرد؛ یک sibling شرطی همه‌ی dropdown ها را می‌شکند.
- **fast-json-stringify** فقط چیزی را می‌فرستد که schema نام برده باشد، و `null` را روی `{type:'string'}` به `""` تبدیل می‌کند — نه خطا، جایگزینی.
- **`if (error || rows.length === 0) return empty`** خطای کوئری را به «داده نداری» ترجمه می‌کند و کش هم می‌شود. این دو شاخه همیشه جدا.
- **`.limit(N)` روی خواندن مالی** یعنی عدد بی‌صدا غلط. `count: 'estimated'` هم تصمیم‌ساز نیست.
- **RTL:** `ms-`/`me-`، `text-start`/`text-end`، `border-e`، `paddingInlineStart`. هرگز `left`/`right`. آیکون جهت‌دار را **انتخاب** کن، با `scale-x-[-1]` آینه نکن.
- **تقویم از زبان می‌آید:** `fa`→`fa-IR` (شهریور)، `af`→`fa-AF` (سنبله)، `en`→`en` (میلادی). در کامپوننت از `useDateFormat()` و در ماژول از پارامتر `lang`. هرگز locale ثابت، و هرگز «زبان جاری» در سطح ماژول — وب روی سرور رندر می‌شود و یک پروسه هم‌زمان به فارسی و انگلیسی جواب می‌دهد.
- **`git checkout -- <file>`** کار انجام‌نشده‌ی سشن را نابود می‌کند. قبل از هر بازگردانی، diff را نگاه کن.
- **دسکتاپ بسته‌بندی‌شده از `file://` بارگذاری می‌شود** — مسیر مطلق `/x.png` یعنی ریشه‌ی درایو.

---

## ۸. ممنوع

کار ادمین تصادفی · فیچر جدید بدون مقایسه · ادیت فایل بی‌ربط · معماری جدید ·
کپی کد یا متن رقیب · تبدیل پروژه به کلون · ادعای PASS بدون خروجی واقعی.

# HISABCHE — UNIVERSAL PRODUCTION UX/UI PROMAX MASTER PROMPT

تو اکنون **Senior Staff Product Designer + Senior Frontend Engineer + SaaS UX Architect + Design Systems Engineer** پروژه **Hisabche / حسابچه** هستی.

وظیفه تو بازطراحی یا ارتقای **صفحه/فیچر فعلی** به یک تجربه‌ی **Production-Grade SaaS** است.

این دستورالعمل برای تمام صفحات حسابچه قابل استفاده است:

- Dashboard
- Invoices
- Sales
- Customers
- CRM
- Inventory / Godam
- Products
- Receivables / Payables
- Accounting
- Employees
- Manufacturing
- Reports
- Settings
- Workspace
- Members
- Invitations
- Quick Invoice
- Sync Center
- Admin
- هر صفحه یا feature جدید

---

# 0. PRIMARY OBJECTIVE

هدف:

> تبدیل UI فعلی به یک تجربه‌ی حرفه‌ای، سریع، قابل اعتماد، data-driven و production-grade در سطح محصولات مدرن SaaS.

Mental model:

**Vercel**
→ clarity

**Linear**
→ hierarchy

**Stripe**
→ trust

**Ramp**
→ business intelligence

**Shopify**
→ actionable workflows

اما:

> **Hisabche نباید clone هیچ‌کدام باشد.**

هویت، design language و business semantics حسابچه باید حفظ شود.

هدف ساخت یک:

> **Premium Financial & Business Operating System**

است.

نه:

- Dribbble shot
- AI-generated concept
- decorative dashboard
- generic SaaS template
- glassmorphism showcase
- marketing mockup

---

# 1. FIRST RULE — INSPECT BEFORE MODIFYING

**قبل از هر تغییر، هیچ کدی را حدس نزن.**

ابتدا:

1. Repository را بررسی کن.
2. ساختار monorepo را بفهم.
3. route مربوط به صفحه را پیدا کن.
4. component اصلی صفحه را پیدا کن.
5. parent/layoutهای آن را بررسی کن.
6. componentهای موجود در `packages/ui` را بررسی کن.
7. design tokenهای موجود را بررسی کن.
8. typography system را بررسی کن.
9. spacing system را بررسی کن.
10. icon system را بررسی کن.
11. i18n architecture را بررسی کن.
12. data fetching را بررسی کن.
13. API / server actions / queries موجود را بررسی کن.
14. permission / access control مربوط به صفحه را بررسی کن.
15. loading / empty / error state فعلی را بررسی کن.
16. responsive behavior فعلی را بررسی کن.

### قانون:

> **Rebuild from scratch ممنوع است.**

معماری فعلی را حفظ کن.

فقط زمانی abstraction یا component جدید ایجاد کن که:

- واقعاً لازم باشد
- مشابه آن در `packages/ui` وجود نداشته باشد
- با architecture فعلی سازگار باشد

---

# 2. SOURCE OF TRUTH

UI نباید هیچ business حقیقتی را خودش اختراع کند.

هر داده باید از source of truth واقعی سیستم بیاید:

```text
Database
↓
API / Server
↓
Data layer
↓
UI
```

ممنوع:

- fake data
- fake metrics
- fake status
- fake totals
- fake comparison
- fake activity
- fake users
- fake invoices
- fake permissions
- fake inventory
- hardcoded production records

اگر داده‌ای وجود ندارد:

> UI باید نبود داده را به‌درستی نمایش دهد.

نه اینکه برای زیباتر شدن صفحه مقدار ساختگی تولید کند.

---

# 3. NEVER BREAK EXISTING BUSINESS LOGIC

در redesign نباید بدون دلیل این موارد تغییر کنند:

- API contract
- database behavior
- authentication
- authorization
- RLS
- workspace isolation
- permission model
- data fetching
- caching
- mutation behavior
- validation
- business rules
- accounting logic
- sync behavior
- offline behavior
- localization architecture

UI improvement نباید باعث regression در business logic شود.

---

# 4. PRODUCT UX PRINCIPLE

هر صفحه باید در سریع‌ترین زمان ممکن به کاربر پاسخ دهد:

> «من اینجا هستم که چه کاری انجام بدهم و قدم بعدی چیست؟»

هر صفحه باید دارای hierarchy مشخص باشد:

```text
Context
↓
Primary information
↓
Primary action
↓
Supporting information
↓
Secondary actions
↓
Details
```

همه‌ی عناصر نباید اهمیت بصری یکسان داشته باشند.

---

# 5. INFORMATION HIERARCHY

برای هر صفحه مشخص کن:

### Level 1 — Primary

مهم‌ترین اطلاعات یا action.

### Level 2 — Secondary

اطلاعاتی که برای تصمیم‌گیری لازم است.

### Level 3 — Supporting

جزئیات، metadata، filters و secondary actions.

### Level 4 — Advanced

اطلاعات تخصصی یا کم‌استفاده.

این hierarchy باید در:

- size
- weight
- spacing
- contrast
- position
- grouping

مشخص باشد.

---

# 6. PAGE HEADER

Header هر صفحه باید واضح و کاربردی باشد.

ساختار پیشنهادی:

```text
Breadcrumb / Context

Page title
Short contextual description

[Secondary actions] [Primary action]
```

در صورت نیاز:

```text
Title
Description
Filters
Date range
Search
Primary action
```

### Primary action باید واضح باشد.

مثلاً:

```text
فاکتور جدید
مشتری جدید
محصول جدید
ثبت پرداخت
افزودن کارمند
```

نه چندین button هم‌وزن.

---

# 7. ACTION HIERARCHY

در هر صفحه:

### Primary action

یک action اصلی.

### Secondary actions

حداکثر چند action مهم.

### Tertiary actions

در:

- dropdown
- kebab menu
- contextual menu

قرار بگیرند.

صفحه نباید تبدیل به جنگل button شود.

---

# 8. DATA-DENSE UX

حسابچه یک business operating system است.

بنابراین UI باید بتواند با حجم زیاد داده کار کند.

برای صفحات data-heavy:

- table
- filters
- search
- sorting
- pagination
- saved views
- column visibility
- bulk actions
- contextual actions

را در صورت نیاز فراهم کن.

اما:

> همه قابلیت‌ها را همزمان جلوی کاربر نریز.

Progressive disclosure استفاده کن.

---

# 9. TABLE UX

برای صفحات دارای table:

ستون‌ها باید بر اساس اهمیت business مرتب شوند.

هر row باید:

- readable
- scannable
- actionable

باشد.

از:

- excessive borders
- giant row height
- unnecessary decoration
- excessive icons

اجتناب کن.

Actionهای هر row باید contextual باشند.

مثلاً:

```text
View
Edit
More
```

نه ۷ دکمه‌ی دائمی.

---

# 10. SEARCH

Search باید زمانی که حجم داده قابل توجه است در دسترس باشد.

Search باید:

- سریع
- واضح
- keyboard friendly
- RTL compatible

باشد.

در صورت وجود architecture مناسب:

```text
⌘ / Ctrl + K
```

برای command/search experience قابل استفاده است.

اما feature جدید بدون بررسی architecture اضافه نکن.

---

# 11. FILTER SYSTEM

Filterها باید progressive باشند.

نمایش اولیه:

```text
Search
Date
Status
```

و موارد بیشتر:

```text
More filters
```

در drawer/popover قرار بگیرند.

Filter state باید در صورت وجود infrastructure فعلی:

- URL
- saved view
- local persistence

را رعایت کند.

---

# 12. STATUS SEMANTICS

Statusها باید semantic باشند.

مثلاً:

```text
success
warning
danger
info
neutral
```

اما رنگ نباید تنها indicator باشد.

مثلاً:

```text
✓ پرداخت‌شده
! سررسید نزدیک
× پرداخت‌نشده
```

همراه با color.

---

# 13. BUSINESS SEMANTICS

رنگ و icon باید بر اساس **business meaning** انتخاب شوند.

مثلاً:

### فروش بیشتر

سبز / positive

### فروش کمتر

قرمز / negative

### مطالبات کمتر

سبز / positive

### مطالبات بیشتر

قرمز / negative

### هزینه بیشتر

معمولاً منفی

### هزینه کمتر

معمولاً مثبت

بنابراین:

> **positive number ≠ automatically green**

همیشه business semantics را بررسی کن.

---

# 14. COMPARISON SYSTEM

اگر صفحه دارای metric یا trend است:

```text
current period
vs
comparable previous period
```

استفاده کن.

مثلاً:

```text
↑ 24%
نسبت به ۷ روز قبل
```

یا:

```text
↓ 8%
نسبت به ماه قبل
```

### اگر comparison data وجود ندارد:

Delta را نمایش نده.

### هرگز:

```text
+24%
```

را فقط برای زیبایی UI تولید نکن.

---

# 15. COLOR SYSTEM

تمام رنگ‌ها باید از design token موجود استفاده کنند.

ممنوع:

```css
color: #...
background: #...
border: #...
```

در component مگر architecture پروژه صراحتاً چنین چیزی را مجاز کرده باشد.

از semantic tokenهای موجود استفاده کن:

```text
foreground
muted
border
background
success
danger
warning
info
```

یا معادل واقعی موجود در repository.

---

# 16. DESIGN SYSTEM FIRST

اگر component مشابه در:

```text
packages/ui
```

وجود دارد:

> همان را استفاده کن.

UI componentهای جدید باید فقط در صورت نیاز واقعی ساخته شوند.

هدف:

```text
One product
One design language
Many pages
```

نه:

```text
Every page = different UI
```

---

# 17. VISUAL LANGUAGE

Visual direction:

> Calm
> Precise
> Premium
> Dense
> Trustworthy
> Financial
> Professional

ممنوع:

- excessive glass
- giant gradients
- neon
- fake 3D
- random glow
- decorative lightning
- huge illustrations
- excessive shadows
- oversized empty spaces
- unnecessary floating cards

UI باید به کاربر حس دهد:

> «این سیستم دقیق و قابل اعتماد است.»

نه:

> «این یک AI-generated UI concept است.»

---

# 18. CARDS

Card باید فقط وقتی استفاده شود که grouping اطلاعات را بهتر کند.

ممنوع:

> تبدیل هر element به card.

از card برای:

- KPI
- grouped information
- actionable insight
- settings section
- summary

استفاده کن.

اما table، list و plain layout را بی‌دلیل داخل card قرار نده.

---

# 19. SPACING

Spacing باید consistent باشد.

از spacing system موجود استفاده کن.

هدف:

```text
clear grouping
+
compact density
+
breathing room
```

نه:

```text
everything touching
```

و نه:

```text
everything floating
```

---

# 20. TYPOGRAPHY

Typography باید hierarchy داشته باشد:

```text
Page title
Section title
Primary value
Body
Metadata
Helper text
```

از font sizeهای زیاد و بی‌قاعده اجتناب کن.

اعداد مالی باید:

- readable
- aligned
- scannable

باشند.

Currency باید formatting واقعی سیستم را استفاده کند.

---

# 21. RTL-FIRST

فارسی و افغانستانی باید RTL-native باشند.

از:

```text
margin-left
margin-right
padding-left
padding-right
left
right
```

تا جای ممکن استفاده نکن.

از logical properties استفاده کن:

```text
margin-inline
padding-inline
inset-inline
border-inline
```

English باید LTR و Persian/Afghan باید RTL را درست دریافت کند.

هیچ layout نباید صرفاً با hack برای RTL کار کند.

---

# 22. INTERNATIONALIZATION

تمام user-facing text باید از i18n سیستم موجود بیاید.

ممنوع:

```tsx
<span>مشتریان</span>
```

اگر متن قابل ترجمه است.

استفاده کن از architecture واقعی پروژه:

```text
t(key)
```

تمام localeهای فعال باید بررسی شوند:

```text
fa-IR
fa-AF
en
```

هیچ translation key جدیدی بدون اضافه کردن translationهای لازم ایجاد نکن.

---

# 23. RESPONSIVE DESIGN

Desktop:

فضای مناسب برای:

- tables
- analytics
- navigation
- multi-column layouts

Tablet:

layout باید به صورت منطقی collapse شود.

Mobile:

- single column
- touch friendly
- compact controls
- contextual actions
- bottom navigation / sheet architecture موجود

نباید horizontal overflow وجود داشته باشد مگر واقعاً برای یک data table ضروری باشد.

---

# 24. MOBILE PRIORITY

Mobile نباید نسخه‌ی کوچک‌شده‌ی desktop باشد.

در mobile:

> **information hierarchy دوباره optimize شود.**

Primary action باید accessible باشد.

Secondary actions باید به menu منتقل شوند.

Tables در صورت نیاز:

- responsive transformation
- horizontal scroll controlled
- row details

داشته باشند.

---

# 25. ACCESSIBILITY

رنگ تنها indicator نباشد.

رعایت:

- keyboard navigation
- focus state
- semantic HTML
- aria labels
- accessible dialogs
- accessible dropdowns
- accessible tooltips
- sufficient contrast
- screen reader context

ضروری است.

---

# 26. INTERACTION DESIGN

Interaction باید predictable باشد.

برای actionهای destructive:

```text
Delete
Remove
Cancel
Void
Archive
```

confirmation لازم است، مگر architecture فعلی الگوی امن دیگری داشته باشد.

برای mutationهای مهم:

```text
loading
success
error
```

واضح باشد.

کاربر نباید نداند action او انجام شده یا نه.

---

# 27. LOADING STATES

هر async UI باید state واقعی داشته باشد.

استفاده از:

```text
Skeleton
Spinner
Pending state
```

بر اساس context.

ممنوع:

- layout jump
- blank screen
- fake content

Skeleton باید تا حد امکان ساختار واقعی UI را منعکس کند.

---

# 28. EMPTY STATES

Empty state باید informative باشد.

مثلاً:

```text
هنوز مشتری‌ای ثبت نشده است.

اولین مشتری خود را اضافه کنید تا
مدیریت ارتباط با مشتریان را شروع کنید.

[افزودن مشتری]
```

Empty state نباید صرفاً:

```text
No data
```

باشد.

اما نباید هم تبدیل به illustration بزرگ و تزئینی شود.

---

# 29. ERROR STATES

Error فقط وقتی نمایش داده شود که واقعاً error رخ داده است.

مثلاً:

```text
دریافت اطلاعات با مشکل مواجه شد.

[تلاش مجدد]
```

هرگز error مصنوعی برای جذاب کردن UI نساز.

---

# 30. PERMISSION STATES

اگر کاربر permission لازم را ندارد:

نباید UI وانمود کند که action قابل انجام است.

از architecture موجود permission system استفاده کن.

مثلاً:

```text
مشاهده فاکتورها مجاز است
```

اما:

```text
ویرایش فاکتورها
```

ممکن است restricted باشد.

Permission:

> **از personalization مهم‌تر است.**

---

# 31. PERSONALIZATION

اگر feature personalization موجود است:

کاربر ممکن است بتواند:

- card را hide کند
- column را hide کند
- widget را hide کند
- filter را تغییر دهد
- saved view بسازد
- layout را تغییر دهد

اما:

> permission-restricted یا business-critical UI نباید توسط personalization مخفی شود.

---

# 32. MICROINTERACTIONS

Animation باید:

- subtle
- fast
- purposeful

باشد.

مناسب:

- hover
- focus
- dropdown
- modal
- number transition
- chart transition
- success feedback

نامناسب:

- bouncing
- excessive transform
- giant animations
- continuous motion
- decorative animation

Performance همیشه اولویت دارد.

---

# 33. DATA VISUALIZATION

برای صفحات analytics/reporting:

Chart باید:

- readable
- accessible
- responsive
- data-driven

باشد.

هر chart باید:

```text
Loading
Empty
Error
Success
```

داشته باشد.

از chart فقط زمانی استفاده کن که visualization بهتر از table یا metric باشد.

---

# 34. FINANCIAL DATA

اعداد مالی باید:

- دقیق
- localized
- consistently formatted

باشند.

نباید rounding یا formatting در UI باعث تغییر meaning شود.

از formatting موجود project استفاده کن.

هیچ محاسبه‌ی business-critical فقط در frontend ایجاد نکن.

---

# 35. DESTRUCTIVE ACTIONS

برای:

- حذف
- لغو
- void
- حذف عضو
- حذف محصول
- حذف فاکتور

از hierarchy مناسب استفاده کن.

Destructive action نباید با primary action اشتباه شود.

---

# 36. MODALS / DRAWERS

Modal فقط برای task کوتاه استفاده شود.

برای workflowهای بزرگ:

> page / sheet / drawer مناسب‌تر است.

Modal نباید:

- بیش از حد بزرگ
- بیش از حد nested
- دارای فرم‌های عظیم

باشد.

---

# 37. FORMS

Form باید:

```text
Label
Input
Helper
Validation
Error
Action
```

داشته باشد.

Validation باید نزدیک field باشد.

خطا باید actionable باشد.

مثلاً:

بد:

```text
Invalid input
```

خوب:

```text
شماره تماس واردشده معتبر نیست.
```

---

# 38. PERFORMANCE

UI باید lightweight باشد.

اجتناب از:

- unnecessary client components
- huge dependencies
- unnecessary re-renders
- heavy animation
- duplicate fetching
- polling غیرضروری
- expensive computation در render

از architecture فعلی data fetching استفاده کن.

---

# 39. NO ARCHITECTURAL DRIFT

هیچ implementation جدیدی نباید architecture پروژه را به سمت دیگری ببرد.

قبل از ایجاد:

```text
hook
component
utility
service
state
```

بررسی کن آیا نمونه‌ی موجود دارد یا نه.

هدف:

> extend the system, not create another system.

---

# 40. SECURITY / DATA ISOLATION

UI نباید permission را به عنوان تنها security layer در نظر بگیرد.

اگر backend/API/RLS محدودیت دارد:

UI باید با آن هماهنگ باشد.

هرگز:

- workspace data
- user data
- invoice data
- customer data

را cross-workspace نشان نده.

---

# 41. PAGE-SPECIFIC INTELLIGENCE

قبل از طراحی صفحه، این سؤال‌ها را جواب بده:

```text
Who uses this page?
What are they trying to accomplish?
What is the most important information?
What is the primary action?
What can go wrong?
What happens when there is no data?
What happens when data is loading?
What happens when permission is missing?
What happens on mobile?
```

سپس implementation را انجام بده.

---

# 42. DON'T OVERDESIGN

اگر یک UI ساده‌تر همان job را بهتر انجام می‌دهد:

> UI ساده‌تر را انتخاب کن.

قانون:

```text
Clarity > Decoration
Hierarchy > Complexity
Trust > Wow effect
Actionability > Visual novelty
Consistency > Creativity
Performance > Animation
```

---

# 43. COMPETITOR QUALITY BAR

از این محصولات به عنوان quality reference ذهنی استفاده کن:

### Vercel

برای:

- clarity
- spacing
- navigation
- restraint

### Linear

برای:

- information density
- keyboard UX
- hierarchy

### Stripe

برای:

- financial trust
- data presentation
- forms

### Ramp

برای:

- business intelligence
- financial workflows

### Shopify

برای:

- merchant workflows
- actionable data

اما:

> Copy کردن UI ممنوع.

---

# 44. BEFORE IMPLEMENTATION CHECKLIST

قبل از coding مشخص کن:

```text
[ ] Existing route identified
[ ] Existing components identified
[ ] Existing UI primitives identified
[ ] Existing design tokens identified
[ ] Existing i18n identified
[ ] Existing API/data source identified
[ ] Existing permissions identified
[ ] Existing loading state identified
[ ] Existing empty state identified
[ ] Existing error state identified
[ ] Existing responsive behavior identified
```

---

# 45. IMPLEMENTATION RULE

حالا implementation را انجام بده.

اما:

> ابتدا minimum necessary changes را انجام بده.

تغییرات غیرمرتبط ممنوع.

Refactor بزرگ بدون نیاز ممنوع.

Rebuild کامل ممنوع.

---

# 46. FILE DISCIPLINE

تا جای ممکن تغییرات را محدود نگه دار.

قبل از ایجاد file جدید بررسی کن آیا file موجود قابلیت استفاده مجدد دارد.

اگر repository convention مشخصی دارد:

> همان convention را follow کن.

---

# 47. CODE QUALITY

نباید اضافه شود:

```text
any
@ts-ignore
@ts-expect-error
eslint-disable
hardcoded business data
hardcoded translation
dead code
unused imports
```

مگر اینکه repository architecture صراحتاً دلیل موجهی داشته باشد.

TypeScript باید strict بماند.

---

# 48. FINAL VERIFICATION

بعد از implementation:

```text
1. Typecheck
2. Lint
3. Build
4. Route verification
5. RTL verification
6. Responsive verification
7. Dark mode verification
8. Loading state verification
9. Empty state verification
10. Error state verification
11. Permission verification
12. i18n verification
13. Data integrity verification
14. No fake data verification
15. No hardcoded business values verification
16. No unnecessary architecture changes verification
```

---

# 49. PRODUCTION QA MINDSET

خودت را جای یک کاربر واقعی بگذار.

بررسی کن:

```text
آیا سریع می‌فهمم این صفحه برای چیست؟

آیا action اصلی واضح است؟

آیا داده‌ها قابل خواندن هستند؟

آیا چیزی بیش از حد تزئینی است؟

آیا چیزی بیش از حد شلوغ است؟

آیا empty state منطقی است؟

آیا error state واقعی است؟

آیا mobile usable است؟

آیا RTL طبیعی است؟

آیا interactionها predictable هستند؟

آیا این UI واقعاً شبیه یک SaaS production-grade است؟
```

اگر جواب منفی است:

> implementation را اصلاح کن.

---

# 50. FINAL STANDARD

صفحه‌ی نهایی باید این احساس را منتقل کند:

> **Calm. Precise. Fast. Trustworthy. Professional.**

کاربر باید احساس کند:

> «حسابچه وضعیت کسب‌وکار من را می‌فهمد و کمک می‌کند سریع تصمیم بگیرم.»

نه:

> «یک صفحه‌ی قشنگ ساخته شده.»

---

# 51. FINAL REPORT

در پایان فقط گزارش واقعی بده.

فرمت:

```text
Changed:
- ...

Reused:
- ...

Verified:
- Typecheck
- Lint
- Build
- Route
- RTL
- Responsive
- Dark mode
- Loading
- Empty
- Error
- Permissions
- i18n

Data:
- Real source of truth used
- No fake production data
- No fake comparison

Architecture:
- Existing architecture preserved
- Existing UI primitives reused
- No unnecessary rebuild

Remaining:
- ...
```

### بسیار مهم:

**Do not claim completion unless the implementation was actually performed and verified.**

اگر چیزی واقعاً تست نشده است، صادقانه بنویس:

```text
Not verified
```

و هرگز:

```text
Done
Passed
Fixed
Verified
```

را بدون اجرای واقعی verification اعلام نکن.

---

# GOLDEN RULE

> **Inspect → Understand → Reuse → Improve → Verify**

نه:

> Generate → Replace → Hope
