# ریل ۸۷ — «شبِ کاغذها» (paper-galaxy) — مشخصات تولید

> **نقش:** Creative Director (Senior SaaS Motion Director)
> **تم:** `paper-galaxy` — بستهٔ سینمایی دست‌ساز (کیت سفارشی `src/scenes/paper-galaxy.tsx`)
> **فرمت:** عمودی ۹:۱۶، ۱۰۸۰×۱۹۲۰، ۳۰ FPS، **۴۵ ثانیه (۱۳۵۰ فریم)**، تم دارک ۱۰۰٪
> **منبع داده:** ارقام خالص `faNumber` — بدون واحد ارزی.

---

## Brief — داستان صحنه‌به‌صحنه

**یک ثابت حسابی در کل فیلم:** ۷٬۳۲۰٬۰۰۰ فروش − ۴٬۶۱۰٬۰۰۰ بهای تمام‌شده = ۲٬۷۱۰٬۰۰۰ سود · طلب ۱٬۹۵۰٬۰۰۰ · انبار ۲۱۴

۱. **۰–۴s — `GalaxyBurstScene` (قلاب):** فریم صفر: یک رسید در عمق آسمانِ نیلی می‌سوزد؛ برش خاکستر (EmberBurnCut) و هزار برگهٔ پرنده. ضربهٔ صوتی فریم صفر + قلاب کلامی ۸ واژه‌ای.
۲. **۴–۱۱s — `GhostDriftScene`:** کاغذهای بی‌صاحب سرگردان‌اند و کم‌نور می‌سوزند (GhostSheetDriftField) — دردِ رسیدِ ردیابی‌ناپذیر.
۳. **۱۱–۱۹s — `GravityIgniteScene`:** هستهٔ حسابچه شعله می‌گیرد؛ خطوط میدان (FieldLineBend) همهٔ کاغذها را خم می‌کنند و به سمت هسته می‌کشند.
۴. **۱۹–۳۰s — `OrbitLedgerScene`:** حلقهٔ مداری دفتر (OrbitLedgerRing): فروش، بهای، سود، طلب، انبار — پنج مدار با اعداد غلتان که یک‌بار به مقصد می‌غلتند و نگه می‌دارند.
۵. **۳۰–۴۰s — `ReentryDashScene`:** ورود مجدد با رگه‌های سرعت (AtmosphereStreakDive) — همان حلقه روی صفحهٔ گوشی مغازه می‌نشیند و به داشبورد زنده تبدیل می‌شود.
۶. **۴۰–۴۵s — `GalaxyCtaScene`:** صورت‌فلکی لوگو قفل می‌شود؛ لوگو + جملهٔ برند + CTA «شروع رایگان» با نگهداری کامل از ۴۰.۹۵s تا پایان.

## Palette (hex)

- Background sky: `#070914` — `NIGHT_SKY`
- Primary violet: `#8b7cf6` — `NEBULA_VIOLET`
- Accent cyan: `#7fd8ff` — `STAR_CYAN`
- Accent gold: `#ffd76a` — `STAR_GOLD`
- Ember (سوزش/خطر): `#ff6a5c` — `EMBER_RED`
- Text primary: `#eef1ff` — `CANVAS_PAPER`

## Typography

- فارسی: Vazirmatn (900/700) — خوشهٔ قلاب ۴۰–۴۴px، برچسب مدار ۱۶–۱۸px.
- اعداد: tabular-nums با `faNumber` — شمارنده‌ها غلتان و بدون چشمک‌زدن.
- هر لحظه حداکثر ۶ واژهٔ غیرزیرنویس + در هر بیت فقط یک خوشهٔ متن جدید.

## Motion Language (مختص همین فیلم)

- Field lines: بزیه‌های SVG با ورود نرم `ease(progress(t, at, at + 1.6))`.
- ورود حلقه‌ها: فنر spring، سوختن ورق‌ها: گداختگی تدریجی (نه حذف قطعی).
- `noZoom: true` — برش‌های اختصاصی این ریل: EmberBurnCut → FieldPull → CardFloat → ScreenDip → ClusterLock.

## Voice-over نهایی (QA فارسی: PASS — برای گوش نوشته شده)

| بازه   | متن                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ۰–۴s   | شب فاکتور می‌نویسی، صبح اثرش در دخل نیست.                                                                                                                                      |
| ۴–۱۱s  | همان رسیدها بی‌صاحب در آسمان سرگردان‌اند و می‌سوزند.                                                                                                                           |
| ۱۱–۱۹s | حسابچه همه کاغذها را به یک هسته می‌کشاند.                                                                                                                                      |
| ۱۹–۳۰s | فروش هفت میلیون و دویست و بیست هزار، بهای تمام‌شده چهار میلیون و ششصد و ده هزار، سود دو میلیون و هفتصد و ده هزار، طلب یک میلیون و نهصد و پنجاه هزار، انبار دویست و چهارده عدد. |
| ۳۰–۴۰s | همان حلقه روی صفحه گوشی مغازه می‌نشیند و زنده می‌شود.                                                                                                                          |
| ۴۰–۴۵s | کاغذها دفتر می‌شوند؛ حسابچه، دفتر واقعی مغازه‌ات. شروع کن.                                                                                                                     |

**همگامی صدا (اتصال اجباری):** ضبط صحنه‌به‌صحنه → `node scripts/align-voiceover.mjs <فایل صدا>` تا اصلاح و هم‌گذاری کلمات؛ پیش از اعمال، هیچ ادعای همگامی واژه‌به‌واژه گزارش نشود.

## Audio Sync (قلب‌های صحنه‌ای در سورس)

- S1: impact@0 · whoosh@0.35 · paperRustle@0.8 · insightReveal@1.2 · softTransition@2.9
- S2: cinematicReveal@0 · paperRustle@0.5 · cardEnter@1.8 · softTransition@3.2 · insightReveal@5.6
- S3: bigReveal@0 · dataFlow@0.3 · insightReveal@1.2 · precisionSequence@2.7 · financialMilestone@4.4 · sync@6.8
- S4: majorReveal@0 · cardEnter@0.25/0.7 · financialMilestone@1.15/1.6 · cash@3.6 · precisionSequence@7.4 · insightReveal@9.8
- S5: cameraSwish@0 · whoosh@0.4 · cinematicReveal@2.2 · cardEnter@3.0 · sync@4.4 · successResolution@7.6
- S6: ctaResolution@0 · bigReveal@0.3 · chime@0.95 · financialMilestone@2.2

Sonic transient در ثانیه ۰.۰ (impact) و whoosh قوی در ثانیه ۱.۵.

## Don'ts

- شروع با لوگو یا «سلام» ممنوع؛ هوک کلیشه‌ای «تا حالا فکر کردی…» ممنوع.
- بدون واحد ارزی هاردکد؛ بدون اسامی خوراکی (کالای بازرگانی کد ۱۰۱ در صورت نیاز به جنس).
- بدون خط جداکنندهٔ افقی تزئینی؛ بدون کلاس `horizon`.
- بدون Math.random — همهٔ ذرات با `deterministicHash`.
- بدون ادعای اثبات‌نشده یا قابلیت غیرواقعی محصول.
- صداقت منبع: بدون دسترسی واقعی، فقط «بر اساس دانش زبانی موجود» (موتور QA فارسی).

## چک‌لیست پیش از تحویل

- [ ] `node ../node_modules/typescript/bin/tsc --noEmit -p .` → ۰ خطا
- [ ] `node ../backend/node_modules/vitest/vitest.mjs run` → ۱۰۰٪ سبز
- [ ] `node ../node_modules/eslint/bin/eslint.js src/` → ۰ ارور / ۰ وارنینگ
- [ ] `npm run build` → گیت variety-check پاس + بیلد پروداکشن
- [ ] `node scripts/visual-qa.mjs 87` → فریم‌های `.tmp/visual-qa/` تمیز
- [ ] ضبط صدا → align-voiceover → `node scripts/export-mp4.mjs 87` → خروجی بی‌نقص
