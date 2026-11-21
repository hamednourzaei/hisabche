# گزارش نهایی — ممیزی ۱۰۰-امتیازی Admin و مانیتورینگ یکپارچه هسته‌ها

تاریخ: ۲۱ نوامبر ۲۰۲۶ · شاخه `main` · HEAD پایه `4edfb591`
**عامل هیچ عملیات نوشتنی git اجرا نکرد** (بدون commit/push/reset/stash/checkout/clean).
میانه مأموریت، خود مالک کامیت `56b835c3` («fixed adminpanel») را شامل پیاده‌سازی
ایجاد کرد؛ پنج سند مأموریت که پس از آن نوشته شدند در working tree باقی‌اند.
اسناد همراه: `ADMIN-100-POINT-AUDIT.md` (ممیزی پیش از اصلاح)،
`ADMIN-100-POINT-IMPLEMENTATION-COVERAGE.md` (ماتریس پوشش + رکورد اجرا)،
`UNIFIED-CORE-MONITORING-ARCHITECTURE.md`، `CORE-METRICS-REGISTRY.md`،
`ADMIN-REALTIME-RELIABILITY.md`.

## A. نتیجه کلی

| شاخص               | نتیجه                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| کل معیارهای ممیزی  | ۱۰۰                                                                          |
| PASS پیش از اصلاح  | ۶۵                                                                           |
| FAIL پیش از اصلاح  | ۲۷                                                                           |
| FAIL رفع‌شده       | ۲۷ (همه؛ ۴ معیار وابسته به migration در وضعیت NOT_VERIFIED صادقانه ثبت شدند) |
| PASS نهایی         | ۸۸                                                                           |
| NOT_VERIFIED نهایی | ۷ (۳ مورد اولیه + ۴ مورد وابسته به دیتابیس زنده/CI)                          |
| NOT_APPLICABLE     | ۵                                                                            |
| P0 باز             | ۰                                                                            |
| P1 باز             | ۰ — F-03 پیاده‌سازی و تست نوشته شده؛ اجرای migration منتظر تأیید انسانی      |
| P2 باز             | ۰ — F-09/F-10 پیاده‌سازی شده؛ راستی‌آزمایی زنده منتظر migration              |

## B. وضعیت مانیتورینگ

| مورد                | وضعیت                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Registry       | VERIFIED_COMPLETE — ۲۶ هسته واقعی با مالک، SLO و گروه عملیات بسته؛ گارد: هر مسیر الگوی اعلام‌شده backend به دقیقاً یک هسته نسبت داده می‌شود                            |
| Core Coverage       | VERIFIED_WITH_LIMITATIONS — همه هسته‌ها در رتبه‌بندی حاضرند؛ بدون داده = UNKNOWN با علت، هرگز حذف/سالمِ صفر                                                            |
| Instance Coverage   | IMPLEMENTED_NOT_LIVE_VERIFIED — lookback ۲۴ساعته + process_role + lastSeen/offline در SQL و UI؛ ردیف زنده منتظر migration                                              |
| Worker Coverage     | IMPLEMENTED_NOT_LIVE_VERIFIED — گیج‌های exact صف کار (pending/processing/stuck/retry) در همان flush؛ منتظر migration                                                   |
| Live Stream         | VERIFIED_WITH_LIMITATIONS — SSE احراز هویت‌شده با مصرف‌کننده واقعی؛ تست HTTP واقعی (snapshot نسخه‌دار، heartbeat، cleanup، سقف ۲۰ اتصال → 503)                         |
| Multi-instance      | VERIFIED_WITH_LIMITATIONS — داده تجمیعی DB همه instanceها؛ push زیر-دقیقه‌ای بین instanceها نیازمند Redis pub/sub است که وجود ندارد (محدودیت ثبت‌شده، نه جعل)          |
| Core Pressure       | VERIFIED_COMPLETE — فرمول نسخه‌دار pressure-v1 با ۱۳ تست واحد (مقادیر محاسبه‌شده دستی، آستانه‌ها، ماتریس ورودی ناموجود)                                                |
| Historical Data     | IMPLEMENTED_NOT_LIVE_VERIFIED — minute/hour + rollup/prune + بازه ۳۰روزه؛ تست PG نوشته شده، اجرا در CI                                                                 |
| Alerts              | VERIFIED_WITH_LIMITATIONS — یک ارزیاب، قاعده per-core با override، رویداد raised/resolved با شواهد، dedup در سطح DB، cooldown، audit؛ ۷ تست چرخه؛ GET بدون side effect |
| Database Monitoring | PASS — vitals زنده + تاریخچه دقیقه‌ای (db_metrics_minute)                                                                                                              |
| Mobile Responsive   | PASS — DataTable حالت کارت <768px، KpiGrid ۲ستونه موبایل، Sheet تمام‌عرض                                                                                               |

## C. بیشترین فشار هسته‌ها

**NOT_LIVE_VERIFIED** — داده عملیاتی زنده وجود ندارد (migration اعمال نشده و
دیتابیس زنده در دسترس نیست). طبق قانون مأموریت این جدول با داده ساختگی پر نشد.
فرمول و رتبه‌بندی با تست واحد و تست HTTP (داده fake صریحاً در تست) اثبات شده‌اند؛
پس از اعمال migration، رتبه‌بندی از `core_metrics_minute` واقعی پر می‌شود.

## D. کتابخانه‌های استفاده‌شده

| Library                                  | وضعیت قبلی                     | کاربرد نهایی                                         | دلیل                                            |
| ---------------------------------------- | ------------------------------ | ---------------------------------------------------- | ----------------------------------------------- |
| recharts + ChartContainer (@hisabche/ui) | موجود، در admin استفاده نمی‌شد | TrendChart مشترک (lazy-loaded مثل SalesChart)        | مأموریت §۱۱: کتابخانه موجود، نه dependency جدید |
| KpiCard/KpiGrid (@hisabche/ui)           | موجود، export نشده در admin    | ۱۸ کارت KPI Overview/DB                              | حذف Kpi div محلی (F-13)                         |
| DataTable مشترک                          | موجود                          | رتبه‌بندی هسته‌ها + instanceها + رویدادها            | جستجو/مرتب‌سازی/کارت موبایل داخلی               |
| @hisabche/formatting                     | موجود                          | formatBytes با null→UNKNOWN                          | حذف جدول واحد محلی (F-12)                       |
| TanStack Query                           | موجود                          | setQueryData از رویدادهای استریم + polling کنترل‌شده | یک منبع حقیقت، بدون state موازی                 |
| Radix Sheet                              | موجود                          | جزئیات هسته                                          | primitive مشترک                                 |
| embedded-postgres                        | موجود                          | تست PG migration (CI)                                | بدون سرویس خارجی                                |
| **dependency جدید**                      | —                              | **هیچ**                                              | manifest/lockfile دست‌نخورده                    |

## E. فایل‌های تغییرکرده (این مأموریت)

**Backend (جدید):** `services/monitoring/core-registry.ts` (رجیستری ۲۶ هسته)،
`core-pressure.domain.ts` (فرمول فشار)، `core-gauges.ts` (گیج صف/DB)؛
تست‌های `monitoring-core-registry`, `monitoring-core-pressure`,
`monitoring-core-alerts`, `monitoring-stream`, `admin-core-monitoring-01.pg`.

**Backend (ویرایش):** `route-metrics.ts` (بعد هسته در همان collector + process_role +
degradation پیش از migration)، `monitoring.service.ts` (coreSnapshot/coreSeries/
alertEvents + ارزیاب هشدار هسته)، `admin-monitor.routes.ts` (۴ مسیر جدید + SSE)،
`index.ts` (سیم‌کشی begin/end + gauges + dep-wait)، `scheduler/index.ts`
(rollup/prune هسته در همان tick ساعتی)، `monitoring-wall.test.ts` (گارد بازنویسی
به تصمیم جدید: استریم ادمین 401 می‌خواهد)، `monitoring-route-metrics.test.ts`.

**Frontend (جدید):** `apps/admin/lib/monitor-stream.ts` (کلاینت SSE)،
تست‌های `monitor-stream`, `monitor-wiring`؛ `packages/ui/.../trend-chart.tsx` +
`trend-chart-internal.tsx` + تست رندر.

**Frontend (ویرایش):** `monitor-panel.tsx` (بازسازی کامل در همان تب)،
`use-admin-monitor.ts` (انواع هسته + هوک استریم + paused polling + 30d)،
`components/ui/index.ts` و `packages/ui/src/index.ts` (exportهای مشترک)،
`no-new-ui-primitives.test.ts` (ثبت آگاهانه TrendChart در snapshot — گارد تضعیف نشد).

**i18n:** `packages/i18n/messages/{fa,af,en}/common.json` — ۷۰+ کلید جدید،
هر سه زبان هم‌تعداد (۱۵۹ کلید monitor).

**Docs/SQL:** `docs/admin-core-monitoring-01-migration.sql` +
`docs/VERIFY-admin-core-monitoring-01.sql` + ۵ سند docs/admin +
`docs/engineering/CHANGE_REVIEW_NOTEBOOK.md`.

**کار قبلی کاربر (حفظ‌شده، دست‌نخورده):** اصلاح HSTS در apps/admin (۳ فایل) و
کار warehouse nav-overflow (`hub-branch.tsx`, `segmented-control.tsx`,
`warehouse-tabs-container.tsx`, `warehouse-nav-overflow.test.ts`).

## F. تست‌ها (دستور، Exit، تعداد)

| دستور                                                      | اجراشده | Pass |       Fail |              Exit |
| ---------------------------------------------------------- | ------: | ---: | ---------: | ----------------: |
| backend `npx vitest run --project unit` (کامل)             |    ۵۹۳۲ | ۵۹۳۲ |          ۰ |                ۱* |
| backend `referral-programme.test.ts` (جدا)                 |      ۲۹ |   ۲۹ |          ۰ |                 ۰ |
| backend سوئیت‌های مانیتورینگ (۸ فایل)                      |      ۶۹ |   ۶۹ |          ۰ |                 ۰ |
| backend `admin-core-monitoring-01.pg.test.ts --project pg` |      ۱۲ |    — |  beforeAll | ۱ (BLOCKED محیطی) |
| apps/admin `vitest run` (کامل)                             |      ۹۰ |   ۹۰ |          ۰ |                 ۰ |
| packages/ui `vitest run` (کامل)                            |    ۲۸۹۸ | ۲۸۹۶ | ۰ (۲ skip) |                 ۰ |
| `npx tsc --noEmit` backend/admin/ui                        |       — |    — |          ۰ |                 ۰ |
| `npx eslint` فایل‌های تغییرکرده (۳ بسته)                   |       — |    — |    ۰ error |                 ۰ |
| `git diff --check`                                         |       — |    — |          ۰ |                 ۰ |

\* همه ۵۹۳۲ تست پاس شدند؛ exit=1 از ۴ خطای teardown ورکر vitest
(`Closing rpc while onUserConsoleLog was pending`) و در اجرای دوم یک تست
timing-flaky نامرتبط (`referral-programme`) زیر بار موازی بود — همان فایل
جداگانه ۲۹/۲۹ پاس می‌شود و توسط این مأموریت لمس نشده است. صادقانه ثبت شد.

## G. محدودیت‌ها

1. **Migration منتظر تأیید انسانی:** `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
   تا اعمال آن، جداول/RPCهای هسته روی دیتابیس زنده وجود ندارند؛ خواندن هسته‌ها
   به شاخه خطا/UNKNOWN می‌رود و مانیتورینگ زیرساخت مختل نمی‌شود (degradation تست‌شده).
2. **Postgres محلی BLOCKED:** خطای ۱۳۱۴ (`SeCreateGlobalPrivilege`، توکن فیلترشده
   ویندوز) — همان بلاکر مستندشده قبلی. ۱۲ تست PG نوشته و آماده اجرا در CI؛
   هرگز PASS شمرده نشد. تنظیمات امنیتی سیستم تغییر نکرد.
3. **استقرار production:** استریم/نمودار/رتبه‌بندی در سطح HTTP محلی و تست واحد
   راستی‌آزمایی شدند؛ راستی‌آزمایی production منتظر deploy است.
4. **بار/پروفایل/باندل:** معیارهای ۲۵/۶۴/۶۷ طبق قانون «بدون build تولیدی»
   NOT_VERIFIED ماندند.
5. **Code Intelligence:** در پایه PARTIALLY_STALE بود؛ rebuild مجاز نبود —
   جستجوی هدفمند دیسک استفاده و محدودیت ثبت شد.
6. **Attribution در مرز مسیر:** عملیات درون-درخواستی جداگانه شمرده نمی‌شود؛
   موتورهای داخلی (jobs) با گیج exact پوشش داده شده‌اند — trade-off مستند.
7. **queue wait time** هنوز per-job ثبت نمی‌شود (NULL = UNKNOWN، نه صفر).

## H. وضعیت‌های رسمی

| بخش                                | وضعیت                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| 1. Implementation                  | VERIFIED_COMPLETE (کد + سیم‌کشی کامل؛ بخش DB منتظر اعمال migration)            |
| 2. Automated Tests                 | VERIFIED_COMPLETE (۶۰۰۰+ تست سبز؛ PG در CI)                                    |
| 3. Runtime Verification            | VERIFIED_WITH_LIMITATIONS (HTTP واقعی محلی برای استریم/مسیرها؛ UI در تست رندر) |
| 4. Production Verification         | NOT_LIVE_VERIFIED (deploy نشده)                                                |
| 5. Database Migration Verification | BLOCKED locally / PENDING HUMAN CONFIRMATION (فایل VERIFY آماده)               |
| 6. Real-time Verification          | VERIFIED_WITH_LIMITATIONS (تست HTTP + ۱۲ تست کلاینت؛ production منتظر deploy)  |
| 7. Multi-instance Verification     | VERIFIED_WITH_LIMITATIONS (منطق با fake RPC تست شد؛ PG چند-instance در CI)     |
| 8. Code Intelligence Freshness     | VERIFIED_WITH_LIMITATIONS (PARTIALLY_STALE ثبت شد؛ rebuild مجاز نبود)          |

**قانون نهایی رعایت شد:** هیچ موردی صرفاً به‌خاطر نوشته‌شدن کد VERIFIED_COMPLETE
اعلام نشد؛ هر وضعیت به شواهد اجرایی واقعی گره خورده است.
