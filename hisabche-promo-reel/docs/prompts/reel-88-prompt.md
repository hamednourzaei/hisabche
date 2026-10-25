# ریل ۸۸ — «ساعت صفر» (clockwork-brass) — مشخصات تولید

> **نقش:** Creative Director (Senior SaaS Motion Director)
> **تم:** `clockwork-brass` — بستهٔ سینمایی دست‌ساز (کیت سفارشی `src/scenes/clockwork-brass.tsx`)
> **فرمت:** عمودی ۹:۱۶، ۱۰۸۰×۱۹۲۰، ۳۰ FPS، **۴۵ ثانیه (۱۳۵۰ فریم)**، تم دارک ۱۰۰٪
> **منبع داده:** ارقام خالص `faNumber` — بدون واحد ارزی.

---

## Brief — داستان صحنه‌به‌صحنه

**یک ثابت حسابی در کل فیلم:** ۷۶۲٬۰۰۰ فروش − ۴۵۰٬۰۰۰ بهای تمام‌شده − ۸۷٬۰۰۰ خرج = ۲۲۵٬۰۰۰ سود · مهر «تراز.»

۱. **۰–۳.۵s — `ClockStuckScene` (قلاب):** فریم صفر: ساعتی برنجی در ۱۱:۵۹ گیر کرده؛ عقربهٔ دقیقه می‌لرزد و آخرین دنده نمی‌بندد — ضربهٔ صوتی فریم صفر + قلاب کلامی ۹ واژه‌ای.
۲. **۳.۵–۹.۵s — `GrindingGearsScene`:** سه خوشهٔ چرخ‌دندهٔ گیرکرده — صندوق، انبار و دفتر — دندونه‌به‌دندونه در هم گیر می‌افتند؛ جرقهٔ FORGE_RED در لحظهٔ گیر سه‌گانه.
۳. **۹.۵–۱۷s — `HeroGearScene`:** چرخِ هابِ حسابچه فرود می‌آید و برنزِ براق می‌تراشد؛ titleHit در لحظهٔ اولین جفت‌شدن واقعی.
۴. **۱۷–۲۵s — `TrainMeshScene`:** قطار کامل جفت می‌شود؛ عقربه آزاد می‌شود و با سوئیپ تمیز ۱۲:۰۰:۰۰ را می‌کوبد — لحظهٔ cash و Chime.
۵. **۲۵–۳۳s — `ToothLedgerScene`:** دندونه‌ها یک‌به‌یک به ردیف‌های دفتر تبدیل می‌شوند (فروش/بهای/خرج) و سود ۲۲۵٬۰۰۰ با مهر «تراز.» قفل می‌شود.
۶. **۳۳–۴۰s — `ShutterLockScene`:** پردهٔ مغازه کاسکاد پایین می‌آید، کلید گردش می‌کند و نور سبز PATINA — بستن روزِ بی‌تنش.
۷. **۴۰–۴۵s — `BrassCtaScene`:** لوح حکاکی‌شدهٔ برنجی + لوگو + CTA «شروع رایگان» با نگهداری کامل از ۴۰.۹۵s.

## Palette (hex)

- Background workshop: `#14110c` — `WORKSHOP_NIGHT`
- Primary brass: `#d9a441` — `BRASS`
- Secondary copper: `#a05c22` — `COPPER`
- Highlight amber: `#ffb84d` — `AMBER`
- Patina green (موفقیت): `#7fae83` — `PATINA`
- Forge red (خطر/گیر): `#e2543e` — `FORGE_RED`
- Text primary: `#f2ead6` — `CREAM`

## Typography

- فارسی: Vazirmatn (900/700) — سرساعت ۷۲px، برچسب دنده‌ها ۱۶–۱۸px.
- اعداد ساعت: mono حکاکی (tabular) با `faNumber` — گذر بدون jump.
- هر لحظه حداکثر ۶ واژهٔ غیرزیرنویس + در هر بیت فقط یک خوشهٔ متن جدید.

## Motion Language (مختص همین فیلم)

- گیر/سابیدن: `translate + rotate` با jitter ناهمگون (فنر گرم، نه نویز random).
- فرود هاب: `studioSpring` فنری + سایهٔ چندلایه.
- تبدیل دندونه→ردیف دفتر: morph پیوستهٔ SVG↔DOM.
- `noZoom: true` — برش‌های این ریل: JamStop → ClutchCatch → TrainRoll → ToothShed → ShutterFall → PlateEngrave.

## Voice-over نهایی (QA فارسی: PASS — برای گوش نوشته شده)

| بازه     | متن                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| ۰–۳.۵s   | یازده و پنجاه و نه! مغازه کار می‌کند اما جلو نمی‌رود.                                                           |
| ۳.۵–۹.۵s | صندوق، انبار و دفتر؛ سه چرخ‌دنده دندونه‌به‌دندونه گیر کرده‌اند.                                                 |
| ۹.۵–۱۷s  | حسابچه چرخ اصلی می‌شود و اولین دنده واقعی را می‌گیرد.                                                           |
| ۱۷–۲۵s   | همه دنده‌ها جفت می‌شوند و عقربه سرانجام آزاد می‌شود.                                                            |
| ۲۵–۳۳s   | فروش هفتصد و شصت و دو هزار، بهای چهارصد و پنجاه هزار، خرج هفتاد و هفت هزار؛ سود دویست و بیست و پنج هزار — تراز. |
| ۳۳–۴۰s   | پرده پایین می‌آید و روز تراز بسته می‌شود.                                                                       |
| ۴۰–۴۵s   | ساعت صفر شد؛ حسابچه، دخل را تراز نگه می‌دارد. شروع کن.                                                          |

**همگامی صدا (اتصال اجباری):** ضبط صحنه‌به‌صحنه → `node scripts/align-voiceover.mjs <فایل صدا>`؛ بدون شواهد هم‌گذاری، هیچ ادعای همگام‌سازی واژه‌به‌واژه گزارش نشود.

## Audio Sync (قلب‌های صحنه‌ای در سورس)

- S1: impact@0 · clockTickRapid@0.4 · tick@1.6 · softTransition@2.4
- S2: cinematicReveal@0 · cardEnter@0.3/0.75/1.2 · majorReveal@3.9 · alert@4.9
- S3: whoosh@0 · bigReveal@3.9 · titleHit@4.2 · insightReveal@4.6
- S4: precisionSequence@0 · cash@3.2 · chime@4.2 · successResolution@6.0
- S5: dataFlow@0 · cardEnter@0.35/0.85/1.35 · financialMilestone@1.85 · majorReveal@5.0
- S6: cameraSwish@0 · titleHit@4.05 · softTransition@5.0
- S7: ctaResolution@0 · bigReveal@0.3 · chime@0.95

Sonic transient در ثانیه ۰.۰ (impact مکانیکی) و tick ستاپ در ثانیه ۱.۵.

## Don'ts

- شروع با لوگو یا «سلام» ممنوع؛ هوک کلیشه‌ای ممنوع.
- بدون واحد ارزی هاردکد؛ بدون اسامی خوراکی.
- بدون خط جداکنندهٔ افقی تزئینی؛ بدون کلاس `horizon`.
- بدون Math.random — jitterها با `deterministicHash`.
- رنگ سبز PATINA فقط در موفقیت/مهر تراز؛ در صحنه‌های درد ممنوع.
- زبان اداری/شرکتی («بهره‌وری»، «فرآیند») ممنوع — زبان بازار.

## چک‌لیست پیش از تحویل

- [ ] `node ../node_modules/typescript/bin/tsc --noEmit -p .` → ۰ خطا
- [ ] `node ../backend/node_modules/vitest/vitest.mjs run` → ۱۰۰٪ سبز
- [ ] `node ../node_modules/eslint/bin/eslint.js src/` → ۰ ارور / ۰ وارنینگ
- [ ] `npm run build` → گیت variety-check پاس + بیلد پروداکشن
- [ ] `node scripts/visual-qa.mjs 88` → فریم‌های `.tmp/visual-qa/` تمیز
- [ ] ضبط صدا → align-voiceover → `node scripts/export-mp4.mjs 88` → خروجی بی‌نقص
