# ریل ۸۹ — «موج روشن» (cash-tide) — مشخصات تولید

> **نقش:** Creative Director (Senior SaaS Motion Director)
> **تم:** `cash-tide` — بستهٔ سینمایی دست‌ساز (کیت سفارشی `src/scenes/cash-tide.tsx`)
> **فرمت:** عمودی ۹:۱۶، ۱۰۸۰×۱۹۲۰، ۳۰ FPS، **۴۵ ثانیه (۱۳۵۰ فریم)**، تم دارک ۱۰۰٪
> **منبع داده:** ارقام خالص `faNumber` — بدون واحد ارزی.

---

## Brief — داستان صحنه‌به‌صحنه

**یک ثابت حسابی در کل فیلم:** ۵٬۵۰۰٬۰۰۰ فروش − ۳٬۳۶۰٬۰۰۰ بهای تمام‌شده − ۷۶۰٬۰۰۰ خرج = ۱٬۳۸۰٬۰۰۰ سود

۱. **۰–۴s — `CoinFallScene` (قلاب):** فریم صفر: یک سکهٔ طلایی در تاریکی کامل می‌افتد (CoinSplashArrest) — حلقهٔ اسپلش در تاریکی و صدای گم‌شده. ضربهٔ صوتی فریم صفر + قلاب کلامی ۷ واژه‌ای عامیانه.
۲. **۴–۱۲s — `LeakCurScene`:** سه دهانهٔ صخره‌ای پنهان — نسیه، خرج، اضافه — حباب‌ها نور حوض را می‌برند (VentBubbleLeak)؛ دیوارهٔ آب نفس می‌کشد.
۳. **۱۲–۲۰s — `FlowLockScene`:** سه حلقهٔ قفل (FlowRingSealLock) پله‌پله فرود می‌آیند و می‌بندند؛ با هر titleHit، برچسب دهانه به فیروزه قفل می‌شود.
۴. **۲۰–۳۱s — `BasinLevelsScene`:** سه ستون حوض با منیوسک زنده پُر می‌شوند (فروش ۵٬۵۰۰٬۰۰۰ / بهای ۳٬۳۶۰٬۰۰۰ / خرج ۷۶۰٬۰۰۰) و کارت بزرگ «سود ۱٬۳۸۰٬۰۰۰» هم‌زمان با bigReveal بالا می‌آید.
۵. **۳۱–۴۰s — `DawnSurfaceScene`:** سطح موج (DawnlineSurfacing) بالا می‌آید؛ آسمان سپیده‌رنگ و خورشید طلایی — سه ردیف فروش/خرج/سود از زیر آب ردیف‌به‌ردیف بیرون می‌زنند و روشن می‌مانند.
۶. **۴۰–۴۵s — `TideCtaScene`:** شناور روشن، ورود لوگوتایپ «حسابچه»، موج‌خط زیرین و CTA «شروع رایگان» با لینک hisabche.com و نگهداری کامل از ۴۰.۹۵s.

## Palette (hex)

- Background abyss: `#062028` — `ABYSS`
- Depth trench: `#021114` — `TRENCH`
- Primary lagoon: `#3fe8d0` — `LAGOON`
- Text primary: `#d9fff8` — `MIST`
- Dawn accent: `#ffc37c` — `DAWN`
- Coin gold: `#ffce6b` — `COIN`

## Typography

- فارسی: Vazirmatn (900/700) — خوشهٔ قلاب ۴۰px، برچسب دهانه/حوض ۱۶–۱۹px.
- اعداد: tabular-nums با `faNumber`؛ لینک CTA با JetBrains Mono.
- هر لحظه حداکثر ۶ واژهٔ غیرزیرنویس + خوشهٔ متن جدید فقط یکی در هر بیت.
- سطح موج و منیوسک: سطح ذاتاً فیزیکیِ آب‌اند — استثنای مستند بند ۱۶ (بند مستند در هدر کیت).

## Motion Language (مختص همین فیلم)

- حباب‌های بدنه: چرخهٔ (cycle mod 1) با `deterministicHash` — بدون Math.random.
- فرود FlowRing: سفر خطی + قفل فنری و فلش نور در لحظهٔ کیو.
- صعود سطح حوض: fill یکنواخت ease(progress(t, delay, delay + 2.2)) — بدون رفت‌وبرگشت.
- `noZoom: true` — برش‌های این ریل: DropArrest → VentReveal → RingClamp → BaselineFill → SurfacingLight → BuoyLock.

## Voice-over نهایی (QA فارسی: PASS — برای گوش نوشته شده)

| بازه   | متن                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| ۰–۴s   | یک سکه تو تاریکی می‌افته و صداش گم می‌شه!                                                                                            |
| ۴–۱۲s  | نسیه و خرج و اضافه؛ سه نشت پنهان پولت را می‌برند.                                                                                    |
| ۱۲–۲۰s | حسابچه حلقه‌های قفل را می‌فرستد و هر نشت بسته می‌شود.                                                                                |
| ۲۰–۳۱s | فروش پنج میلیون و پانصد هزار، بهای سه میلیون و سیصد و شصت هزار، خرج هفتصد و شصت هزار؛ سود یک میلیون و سیصد و هشتاد هزار روشن می‌شود. |
| ۳۱–۴۰s | صبح می‌شود؛ فروش، خرج و سود روی آب روشن می‌مانند.                                                                                    |
| ۴۰–۴۵s | حسابچه؛ حساب روشن از امشب. رایگان شروع کن.                                                                                           |

**همگامی صدا (اتصال اجباری):** ضبط صحنه‌به‌صحنه → `node scripts/align-voiceover.mjs <فایل صدا>`؛ بدون شواهد هم‌گذاری، هیچ ادعای همگام‌سازی واژه‌به‌واژه گزارش نشود.

## Audio Sync (قلب‌های صحنه‌ای در سورس)

- S1: impact@0 · whoosh@0.4 · dataFlow@1.05 · cash@1.35 · softTransition@2.8
- S2: cinematicReveal@0 · cardEnter@0.3/0.8/1.3 · alert@2.4 · whoosh@5.6
- S3: precisionSequence@0 · titleHit@1.6 · titleHit@3.4 · titleHit@5.2 · insightReveal@6.6
- S4: whoosh@0 · dataFlow@0.6 · cash@3.2 · alert@4.9 · bigReveal@7.8 · financialMilestone@8.2 · insightReveal@9.1
- S5: cameraSwish@0 · insightReveal@2.6 · cardEnter@4.4/5.4 · financialMilestone@6.4 · successResolution@7.9
- S6: ctaResolution@0 · bigReveal@0.3 · chime@0.95

Sonic transient در ثانیه ۰.۰ (impact سکه) و dataFlow زیرآب در ثانیه ۱.۵.

## Don'ts

- شروع با لوگو یا «سلام» ممنوع؛ هوک کلیشه‌ای «آیا می‌دانستی؟» ممنوع.
- بدون واحد ارزی هاردکد؛ بدون اسامی خوراکی.
- بدون خط جداکنندهٔ افقی تزئینی (سطحِ موج، سطح ذاتاً فیزیکیِ آب است) و بدون کلاس `horizon`.
- بدون Math.random — همهٔ فیزیک با `deterministicHash`.
- بدون ادعای اثبات‌نشده (مثلاً «سودت را دو برابر می‌کنیم») — فقط حقیقت محصول.

## چک‌لیست پیش از تحویل

- [ ] `node ../node_modules/typescript/bin/tsc --noEmit -p .` → ۰ خطا
- [ ] `node ../backend/node_modules/vitest/vitest.mjs run` → ۱۰۰٪ سبز
- [ ] `node ../node_modules/eslint/bin/eslint.js src/` → ۰ ارور / ۰ وارنینگ
- [ ] `npm run build` → گیت variety-check پاس + بیلد پروداکشن
- [ ] `node scripts/visual-qa.mjs 89` → فریم‌های `.tmp/visual-qa/` تمیز
- [ ] ضبط صدا → align-voiceover → `node scripts/export-mp4.mjs 89` → خروجی بی‌نقص
