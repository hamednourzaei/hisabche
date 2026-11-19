# گزارش ترند → ریفکتور Reel #112 «برگشت به گذشته»

**تاریخ:** 2026-11-18 · **فایل ریفکتورشده:** `src/reels/reel-112-flashback-rewind.ts`
**روش:** جستجوی وب (۸ پرسوجو، انگلیسی + فارسی) + قرائت قراردادهای موتور داخل مخزن
(`src/engine/types.ts`، `sound.ts`، `speech-model.ts`، `.claude/reel-plugin/production-guardrails.md`)
تا هر تغییر «ترند» دقیقاً با قانونهای سخت خروجی سازگار باشد.

---

## ۱. ترندهای تثبیتشده در ادیت موشنگرافیک کوتاه

| #   | ترند                                                                                   | شواهد                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | هوک در ۱ تا ۳ ثانیهی اول — سرنوشت ویدیو در هوک است، نه در ادیت بعدش                    | «Your hook is the first 1–3 seconds» — ernestofficial؛ Reel Trends 2026 — The Social Content Factory؛ How to Create Viral Instagram Reels in 2026 — ReelScale                                 |
| T2  | تایپوگرافی کینتیک از تزئین به رسانهی اصلی — با خویشتنداری: یک تیتر کینتیک در هر قاب    | Motion Graphics Trends for 2026 — Art of Styleframe («kinetic type belongs on one headline per page»)؛ 16 Animation Trends to Watch in 2026؛ Motion Design Trends 2026: B2B Guide — Motionlab |
| T3  | بافت لمسی/دستساز — گرِین، کاغذ پاره، فولی واقعی؛ با میزانسنج (گرِین لایهی کم رنگ)      | Video & Motion Design Trends — Envato Elements («handmade craft and analog texture»)؛ Art of Styleframe (grain ~0.35 opacity)                                                                 |
| T4  | گرامر ریوایند/VHS بهعنوان دستهی ترند — اغراق دیجیتال + گلیچ + رترو + نماد rewind       | Rewind Effect Templates (VHS, Glitch & Retro) — Envato؛ آموزشهای Premiere/CapCut rewind؛ استوک: rewind symbol + countdown + analog noise                                                      |
| T5  | کات روی بیت و «هر کات با قصد» — velocity ramp همگام با صدا؛ زیر گوینده افکتها کم میشود | نتایج editing-tips («Every cut must have intent… Beat-synced cuts… dial back the effects during voice over»)؛ r/editors — layering SFX                                                        |
| T6  | طراحی صدای لایهای — روی هر بیت یک SFX، نه سروصدا                                       | «3-Layer Method» برای صداگذاری حرفهای؛ فارسی: «۴ افکت صوتی که کیفیت ریلزهاتو میبره چند لول بالاتر»                                                                                            |
| T7  | زیرنویس موشن کلمهبهکلمه استاندارد شده                                                  | «زیرنویس فارسی + تکست موشن ترند»؛ ابزارهای Captions AI؛ در موتور حسابچه همان نوار کارائوکه (Hard Rule 1)                                                                                      |
| T8  | نگهداشتن ریتم در HOLDهای بلند — tick/echo بدون شلوغی                                   | استخراج از T4–T6 + قانون بودجهی صحنه (Hard Rule 11 موتور)                                                                                                                                     |

## ۲. نگاشت ترند → تغییر در فایل

| ترند                | تغییر عینی در reel-112                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| T1 هوک              | ضربهی question-stamp از ۲٫۱s به ۱٫۹۲s محلی رسید؛ اولین بیت صوتی هر صحنه ≤0٫۵s (S1: 0.12s)؛ هیچ صحنهای بیصدا وارد نمیشود |
| T2 کینتیک خویشتندار | بودجهی emphasis: حداکثر ۲ کلمهی تأکیدی در هر صحنه («دفتر» در S1 emphasis گرفت، حذف شد؛ بیت صوتیش ماند)                  |
| T3 بافت لمسی        | صداگذاری کاغذی به فولی کاتالوگ ۲۰۲۶: `clockTickRapid` (ساعت)، `markerScribble` (دستنویس)، `paperRustle`/`paperTear`     |
| T4 ریوایند          | سه cameraSwish پراکنده (۲٫۰۳/۴٫۴/۶٫۷۷) → شتابگیرندهی ۰٫۸۵→۱٫۳۰→۱٫۵۸ که میکوبد روی بیت کپی؛ echo ریوایند در ۹٫۳          |
| T5 کات باقصد        | آخرین رویداد صوتی هر صحنه ≥1٫5s قبل از پایان صحنه (پنجرهی خروج 0٫۱۸s بیصدا)؛ هر کلمهی صدادار action دارد (AV-Sync §1)   |
| T6 صدای لایهای/کم   | HOLDها فقط ۱–۲ cue: `sync` قفل سندها (۶٫۶)، `chime` پیشCTA (۹٫۶)، `clockTickRapid` اضطراب (۷٫۰)                         |
| T7 کپشن کلمهبهکلمه  | word planها منبع کارائوکه ماندند؛ `confidence: null` روی تکتک کلمهها + `alignmentSource: 'cadence-model'`               |
| T8 ریتم در HOLD     | S3: tick اضطراب ۷٫۰ + echo ۹٫۳ · S4: sync ۶٫۶ + chime ۹٫۶ · S1: chime ۳٫۴ · S2: chime ۶٫۴                               |

تمیزکاری فارسی (Hard Rule 15): نیمفاصلههای شکسته اصلاح شد — شبانهی→شبانهی، ریشهی→ریشهی،
مینویسی→مینویسی، برنمیگرده→برنمیگرده، ماشینحساب→ماشینحساب، بههم→بههم،
دوبارهکاری→دوبارهکاری، نتیجهی→نتیجهی، آنرا→آن را؛ واژهی بازار «مغایرت حساب» در friction نشست.

## ۳. قراردادهای منجمد

- مرز صحنهها و تایمالاین ۴۲ثانیهای متعلق به `src/scenes/flashback-timing.ts` (S112.factors) است — دست نخورد تا «یک تایمالاین ماستر» (Hard Rule 13) نشکند.
- رشتههای action منجمد: فقط همان ۱۹ action کلمهای + ۵ action پایانی نسخهی اصلی؛ AV-Sync §1.
- SoundKind: صداهای تازه `clockTickRapid`، `markerScribble`، `sync` — همگی عضو پالت رسمی `src/engine/sound.ts`.
- فاصلهی رویدادها: جفت رویدادهای شنیدنی ≥150ms قبل از ضریب (قانون ادغام §3)؛ توالی کلمات monotonic.
- `sentenceEnding` بدون صدا (§2)؛ CTA: ورود کارت 0٫35s، هول ≥3s، فریم آخر تمیز (Hard Rule 10).

## ۴. بررسی نهایی پیش از تحویل

توالی کلمات ۵ صحنه ✓ · بدون رویداد در پنجرهی خروج ✓ · هر صدای دارای action ✓ ·
همهی kindها معتبر ✓ · `musicMood: 'tense'`، `theme: 'cinematic-obsidian'`， `noZoom: true` ✓.
در workspace خودت: `npm run typecheck` و `node scripts/check-av-sync.mjs 112 --mix`.

## ۵. منابع

- https://thesocialcontentfactory.com/reel-trends
- https://reelscale.in/blog/how-to-create-instagram-reels-that-go-viral-2026
- https://artofstyleframe.com/blog/motion-graphics-trends-2026-sources
- https://elements.envato.com/learn/motion-design-trends
- https://elements.envato.com/video-templates/rewind+effect
- https://www.reddit.com/r/editors/comments/s86bp1/best_editing_techniques_for_smoothly_integrating
- ویدیو هوک ernestofficial (Facebook Watch؛ از اسنیپت جستجو)
- قراردادهای داخلی مخزن: `src/engine/{types,sound,speech-model}.ts`، `.claude/reel-plugin/production-guardrails.md`
