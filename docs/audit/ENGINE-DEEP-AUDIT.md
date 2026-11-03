# ENGINE DEEP AUDIT — Phase 1.1 (Task A)

READ-ONLY. هشت موتوری که در ممیزی اول فقط «وجود» داشتند، اینجا با مدل ۱۳ بُعدی بررسی شدند.
برچسب بُعدها: `PROVEN` · `PARTIAL` · `MISSING` · `N/A` · `UNVERIFIED` · `BLOCKED_EXTERNAL`.
هیچ بُعدی `PROVEN` نیست که فقط تست source-assertion یا mock داشته باشد؛ دیتابیس واقعی PostgreSQL روی این ماشین `BLOCKED_EXTERNAL` است.

## خلاصه

| #   | Engine        | Implementation | Verification       | Architecture                    | Final verdict                |
| --- | ------------- | -------------- | ------------------ | ------------------------------- | ---------------------------- |
| 1   | Cycle Count   | PARTIAL        | PARTIALLY_VERIFIED | WRONG_LAYER + DUPLICATED (جزئی) | PARTIAL                      |
| 2   | Reorder       | PARTIAL        | PARTIALLY_VERIFIED | DUPLICATED_AUTHORITY            | PARTIAL                      |
| 3   | Branch        | PARTIAL        | PARTIALLY_VERIFIED | NEEDS_REFACTOR                  | PARTIAL                      |
| 4   | Marketplace   | PARTIAL        | PARTIALLY_VERIFIED | CORRECT (دو معنی)               | PARTIAL                      |
| 5   | Notifications | PARTIAL        | PARTIALLY_VERIFIED | NEEDS_REFACTOR                  | PARTIAL                      |
| 6   | Portal        | PARTIAL        | PARTIALLY_VERIFIED | CORRECT                         | IMPLEMENTED_WITH_LIMITATIONS |
| 7   | Audit Log     | PARTIAL        | PARTIALLY_VERIFIED | NEEDS_REFACTOR                  | PARTIAL                      |
| 8   | Webhooks      | IMPLEMENTED    | PARTIALLY_VERIFIED | CORRECT                         | IMPLEMENTED_WITH_LIMITATIONS |

هیچ‌کدام `FULLY_IMPLEMENTED` نیست: برای هیچ‌کدام VERIFY اجراشده‌ی انسانی یا تست PostgreSQL واقعی در دست نیست.

---

## 1. Cycle Count — `PARTIAL`

مسیر: `CycleCountContainer` ← `packages/api/src/hooks/inventory-operations.ts` ← `POST /api/cycle-counts[/:id/lines|complete|cancel]` (`backend/src/routes/cycle-count.routes.ts:82-139`) ← `requireCapability('stocktake.write'|'stocktake.complete')` ← `CycleCountService` (`backend/src/services/inventory/cycle-count.service.ts`) ← جدول‌های `cycle_counts` / `cycle_count_lines` (`docs/phase-l-03-cycle-counts-migration.sql:83,141`).

| بُعد               | وضعیت   | شاهد                                                                                                                                                                                                |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain             | PROVEN  | قیمت‌گذاری واریانس در `inventory-costing/stock-count.domain.ts` و فراخوانی `priceLine/summariseCount` (service:168-186)                                                                             |
| Data               | PARTIAL | جدول‌ها هست؛ `docs/VERIFY-phase-l-03*` وجود ندارد (`ls docs` بدون نتیجه) → اجرا/تأیید مایگریشن ثابت‌نشده                                                                                            |
| API                | PROVEN  | ۶ route، ورودی zod (routes:20-37)                                                                                                                                                                   |
| Authorization      | PARTIAL | `stocktake.write/complete` در `authorization.domain.ts:103-104,190`؛ branch scope بررسی نمی‌شود                                                                                                     |
| Accounting Effect  | MISSING | سند دفتر زده نمی‌شود؛ خود کد می‌گوید حساب «کسری موجودی» تعریف نشده (service:245-251)                                                                                                                |
| Inventory Effect   | PARTIAL | حرکت `adjustment` درج می‌شود (service:192-206) **بدون `warehouse_id`** و بدون لایه‌ی بها؛ شمارش‌شدن = «کم‌شدن لایه» نیست                                                                            |
| Offline            | N/A     | ماتریس: هر ۶ route = `online_required` (`offline-endpoint-matrix.ts:142,143,389-392`)؛ رجیستری برای `stockcount.create` `execution:'local'` می‌گوید (`feature-registry.ts:217`) که قصد است نه رفتار |
| Sync               | N/A     | چون online-only                                                                                                                                                                                     |
| UI Contract        | PROVEN  | `packages/ui/src/components/ui/cycle-count/*` + مسیر در `app.tsx`                                                                                                                                   |
| i18n               | PROVEN  | کلید `cycleCount` در هر سه `common.json`                                                                                                                                                            |
| Tests              | PARTIAL | `cycle-count-guard.test.ts` فقط source-assertion است؛ تست HTTP/DB واقعی نیست                                                                                                                        |
| Migration / VERIFY | PARTIAL | مایگریشن هست، VERIFY جدا نیست                                                                                                                                                                       |
| Documentation      | PARTIAL | `.claude/HANDOFF-PHASES-G-TO-O.md` شکاف دفتر را می‌گوید                                                                                                                                             |

- **Authoritative command:** `POST /api/cycle-counts/:id/complete`. **State:** `cycle_counts` + `stock_movements`. **Read model:** `GET /api/cycle-counts`. **Authorization authority:** `requireCapability`. **Offline/Sync authority:** ندارد (online-only).
- **WRONG_LAYER / DUPLICATED_AUTHORITY:** `complete()` مستقیماً `stock_movements` را `insert` می‌کند (service:206) نه از مسیر کانونی `warehouse.service`/costing. ماژول‌های دیگری هم همین جدول را می‌نویسند (۱۹ فایل سرویس `stock_movements` را لمس می‌کنند، `grep`).
- **ریسک‌های اثبات‌شده از خود کد:**
  1. حرکت بدون `warehouse_id` → همان الگوی BUG-080 در `CLAUDE.md` (کالا ۲۰ و انبار −۱۰). `warehouse_id` شمارش در `cycle_counts` هست ولی به حرکت منتقل نمی‌شود (service:194-203).
  2. ترتیب غیراتمی: حرکت‌ها اول درج می‌شوند (206)، CAS وضعیت بعدش (226-241). دو `complete` هم‌زمان هر دو حرکت می‌نویسند و فقط یکی وضعیت را می‌بندد؛ کامنت 239-240 خطر را می‌داند ولی محافظ بعد از اثر است. supabase-js تراکنش ندارد (قانون ۴ در CLAUDE.md → باید RPC باشد).
  3. بدون چک قفل دوره/شعبه، بدون Idempotency-Key، بدون audit.
- **Final verdict:** `PARTIAL`. سؤال بحرانی: «آیا از مسیر کانونی موجودی تطبیق می‌دهد؟» → **خیر**، مستقیم می‌نویسد.

## 2. Reorder — `PARTIAL`

مسیر: `inventory-ops` UI ← `GET /api/inventory/reorder-suggestions` و `POST …/draft-po` (`backend/src/routes/inventory-insights.routes.ts:26,73`) ← `ReorderService` + `reorder.domain.ts` ← `products`/`stock_movements`.

| بُعد              | وضعیت      | شاهد                                                                                                                                            |
| ----------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain            | PROVEN     | `buildReorderSuggestions` از فروش واقعی (`reorder.service.ts:89-103`)                                                                           |
| Data              | PARTIAL    | `purchase_order_items` به‌عنوان «در راه» قابل‌اتکا نیست؛ خود کد می‌گوید (`reorder.service.ts:175-178`)                                          |
| API               | PROVEN     | دو endpoint                                                                                                                                     |
| Authorization     | PARTIAL    | GET فقط `authenticate + requireWorkspaceContext` (`inventory-insights.routes.ts:27`)، POST `purchase.write` (`inventory-insights.routes.ts:74`) |
| Accounting Effect | N/A        | پیشنهاد؛ PO سند دفتر نمی‌زند                                                                                                                    |
| Inventory Effect  | N/A        | رزرو/«در راه» محاسبه نمی‌شود: `reserved`، `incoming`، `safety stock`، `max` در `reorder.domain.ts` نیامده (grep خالی) و scope انبار ندارد       |
| Offline           | PARTIAL    | موتور محلی هر دو را دارد (`local-engine/src/routes/stock-insights.ts:34`, `purchasing.ts:355`)                                                  |
| Sync              | UNVERIFIED | نوشته‌ی آفلاین `purchase_order` با id تصادفی (`purchasing.ts:387`) و مسیر outbox بررسی نشد                                                      |
| UI                | PROVEN     | `inventory-ops-view.tsx`                                                                                                                        |
| i18n              | PROVEN     | `reorder` در `en/common.json` (۱۵ ارجاع)                                                                                                        |
| Tests             | PARTIAL    | `reorder-dead-stock.test.ts` (دامنه)؛ تست draft-po در `stock-and-licence-route-guards.test.ts` (source)                                         |
| Migration         | N/A        | جدول تازه ندارد                                                                                                                                 |
| Documentation     | PARTIAL    | —                                                                                                                                               |

- **Authoritative command:** `purchasingService.createPurchaseOrder` (`inventory-insights.routes.ts:115`). **Read model:** `ReorderService.suggestions`.
- **DUPLICATED_AUTHORITY (اثبات‌شده، دو پیاده‌سازی با قواعد متفاوت):**

  | قاعده              | سرور (`inventory-insights.routes.ts`)  | دستگاه (`local-engine/src/routes/purchasing.ts`) |
  | ------------------ | -------------------------------------- | ------------------------------------------------ |
  | تأمین‌کننده نامشخص | رد با `DRAFT_PO_LINE_INCOMPLETE` (:91) | `'default-supplier'` حدس زده می‌شود (:375)       |
  | قیمت ۰             | رد                                     | `unitPrice ?? 0` پذیرفته می‌شود (:380)           |
  | مجوز               | `purchase.write` (:74)                 | `warehouse.manage` (:356)                        |
  | وضعیت              | `'pending'` (:118)                     | `'draft'` (:390)                                 |
  | شناسه              | DB                                     | `Math.random()` (:387)                           |

  خلاف قانون «تأمین‌کننده/قیمت را حدس نزن» (`CLAUDE.md` §12) و خلاف «offline = همان قواعد» (درس ۲۲۷).

- بدون Idempotency-Key؛ چند تأمین‌کننده در یک حلقه بدون تراکنش (`inventory-insights.routes.ts:114-127`): خطا در وسط = بعضی PO ساخته شده.
- **Final verdict:** `PARTIAL`. پاسخ سؤال بحرانی: پیشنهاد فقط read-model است، ولی `draft-po` یک mutation تدارکاتی است و **دو مسیر ناهمگون** دارد.

## 3. Branch — `PARTIAL`

مسیر: هاب شعبه ← `/api/branches*` (`branch.routes.ts:57-159`) ← `BranchService` (`services/branch/branch.service.ts`) ← `branches`, `member_branches` (`docs/branch-migration.sql:23,48`) + ستون `branch_id` روی اسناد.

| بُعد              | وضعیت       | شاهد                                                                                                                                                                                            |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain            | PROVEN      | قواعد در `@hisabche/validation` و مشترک با موتور محلی (`branch.domain.ts:1-9`)                                                                                                                  |
| Data              | PROVEN      | `branch_id` روی invoices/payments/journal/stock_movements (`branch-migration.sql:59-62`)                                                                                                        |
| API               | PROVEN      | ۵ route                                                                                                                                                                                         |
| Authorization     | PARTIAL     | route ایجاد/ویرایش `workspace.manage`، تخصیص `member.manage`؛ اعمال scope در **۷ فایل route** (`grep branchScope                                                                                | resolveActive | scopeFor`: invoice.routes، warehouse-access، till-choice…) — نه همه‌ی خواندن‌ها |
| Accounting Effect | PARTIAL     | قفل دوره‌ی شعبه در SQL `accounting_post_journal_entry` اعمال می‌شود؛ لایه‌ی TS فقط قفل شرکت (از ممیزی قبل)                                                                                      |
| Inventory Effect  | PARTIAL     | دسترسی انبار = دسترسی شعبه (`warehouse-access.ts`)                                                                                                                                              |
| Offline           | **MISSING** | موتور محلی `scope: { kind: 'all' }` ثابت برمی‌گرداند و می‌گوید «کاربر دستگاه مالک است» (`local-engine/src/routes/branches.ts:91-93`) → محدودیت شعبه‌ی تنظیم‌شده‌ی سرور روی دستگاه اعمال نمی‌شود |
| Sync              | UNVERIFIED  | pull قفل شعبه‌ی سرور→دستگاه ساخته نشده (ممیزی قبل)                                                                                                                                              |
| UI                | PROVEN      | هاب شعبه + `resolveActive` در فاکتور                                                                                                                                                            |
| i18n              | UNVERIFIED  | کلیدهای شعبه شمرده نشد                                                                                                                                                                          |
| Tests             | PARTIAL     | `branch-rules.test.ts`، `authorization-scope*.test.ts`، `audit-row-branch.test.ts`، `branch-period-lock-device.test.ts`؛ DB واقعی نه                                                            |
| Migration         | PARTIAL     | `docs/branch-migration.sql` + چند فاز (`phase-g-01/03`, `phase-j-01`)؛ اجرای انسانی ثابت‌نشده                                                                                                   |

- **سؤال بحرانی — ایزولاسیون شعبه در لایه‌ی DB یا فقط برنامه؟** تنها سیاست RLS مربوط به `member_branches` است (`docs/branch-migration.sql:90`, `SETUP-COMPLETE.sql:4020`)؛ برای جدول‌های کسب‌وکاری (invoices…) سیاست مبتنی بر شعبه یافت نشد (`grep member_branches … policy` فقط همان). پس **ایزولاسیون شعبه = application-level filtering**؛ سرور با service_role کار می‌کند. RLS واقعی: `BLOCKED_EXTERNAL`.
- **Offline bypass:** بله، قطعی از کد — دستگاه همه‌ی شعبه‌ها را می‌بیند و هیچ مرجع سرور-محدودی ندارد.
- Authoritative state: `branches`/`member_branches`؛ read model: `GET /api/branches`؛ forbidden alternatives: فیلتر دستی در route‌هایی که از `resolveActive` رد نمی‌شوند → `NEEDS_REFACTOR`.
- **Final verdict:** `PARTIAL`.

## 4. Marketplace — `PARTIAL` (دو سطح با یک نام)

دو چیز با نام marketplace وجود دارد: **(الف) بازار اپ‌ها** (`marketplace.routes.ts`، `oauth/marketplace.service.ts`: مرور، review، گزارش، publisher) و **(ب) بازار کالا** (`market.routes.ts`, `market-public.routes.ts`, `services/market/market.service.ts`: فروشنده، آگهی، لیست عمومی).

| بُعد                                            | وضعیت       | شاهد                                                                                                                                        |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain/Data (ب)                                 | PROVEN      | `seller_profiles`, listings؛ `docs/goods-marketplace-01-migration.sql` + `VERIFY-goods-marketplace-01.sql` + `goods-marketplace.pg.test.ts` |
| Order/Payment/Fulfillment/Settlement/Commission | **MISSING** | «There is no ordering or payment here» (`market.service.ts:20`)؛ هیچ ستون/route سفارش/کمیسیون یافت نشد                                      |
| API                                             | PROVEN      | ۱۰ route فروشنده/ادمین (market.routes.ts:91-212) + ۴ route عمومی (market-public.routes.ts:43-70)                                            |
| Authorization                                   | PROVEN      | فروشنده `workspace.manage`؛ ادمین `platformAdminGuard`؛ عمومی بدون احراز (فقط خواندنی)                                                      |
| Offline                                         | N/A         | ماتریس `online_required`                                                                                                                    |
| Webhooks                                        | N/A         | رویداد `order.*` فقط از state machine سفارش فروش (CLAUDE.md) — بازار کالا رویدادی ندارد                                                     |
| Tests                                           | PARTIAL     | `goods-marketplace.test.ts` + `.pg.test.ts` (اجرا BLOCKED_EXTERNAL) ، `marketplace.test.ts`                                                 |
| i18n/UI                                         | UNVERIFIED  | —                                                                                                                                           |

- مسیر کامل تولیدی که وجود دارد: «فروشنده آگهی می‌سازد → صفحه‌ی عمومی نشان می‌دهد». **هیچ مسیر خرید-تا-تسویه ندارد.**
- **Final verdict:** `PARTIAL` — یک **کاتالوگ آگهی** است، نه marketplace تراکنشی. برای رجیستری: «marketplace تراکنشی» = `MISSING`، «کاتالوگ/معرفی» = `IMPLEMENTED`.

## 5. Notifications — `PARTIAL`

| بُعد             | وضعیت      | شاهد                                                                                                                                                                                  |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain           | PARTIAL    | تنها `NotificationService.create` با `INSERT` مستقیم در `notifications` (`notification.service.ts:44-56`)                                                                             |
| Delivery system  | MISSING    | کانال، صف، retry، dedupe، ترجیحات کاربر در این سرویس نیست؛ فقط ردیف درون‌برنامه‌ای. ایمیل مسیر جدا دارد: `email-outbox.ts` (attempts/retry/idempotency: `:36-37,46,94-95`)            |
| Recipient        | PARTIAL    | `user_id` الزامی؛ بدون گیرنده → `console.error` و `return null` بی‌صدا (`:35-42`)                                                                                                     |
| Idempotency      | MISSING    | هر فراخوانی یک ردیف                                                                                                                                                                   |
| Event sources    | PARTIAL    | ۶ فراخواننده‌ی `notificationService.create`: `job-scheduler.plugin.ts:41`, `crm.service.ts:260,293`, `event-log.service.ts:221`, `invoice.service.ts:1658`, `workflow.service.ts:754` |
| Offline/Sync     | PARTIAL    | ماتریس: خواندن/علامت‌خوانده `available` (`offline-endpoint-matrix.ts:289-290,343-344`) — تولید اعلان از دستگاه بررسی نشد (UNVERIFIED)                                                 |
| Tests            | PARTIAL    | `notification-keys.test.ts` و `task-notifications.test.ts` موجودند (ترجمه‌ی کلید و اعلان کار)؛ تست رفتار `NotificationService.create` یافت نشد                                        |
| Migration/VERIFY | UNVERIFIED | `ls docs                                                                                                                                                                              | grep -i notif` → چیزی |

- حکم معماری: **UI message + in-app store**، نه «domain event + delivery system». اعلان به‌عنوان حقیقت کسب‌وکار استفاده نمی‌شود (خوب)، ولی متن اعلان در سرور ساخته می‌شود (نقض «متن سرور ترجمه نیست»، CLAUDE.md ۱۴ اکتبر) → `NEEDS_REFACTOR`. تولید از ۶ نقطه‌ی پراکنده (نه یک event bus).
- **Final verdict:** `PARTIAL`.

## 6. Portal Screens — `IMPLEMENTED_WITH_LIMITATIONS`

پورتال مشتری: `customer-portal.routes.ts` (۳ route مدیریت لینک + ۱ route عمومی `GET /api/public/portal/:token`) ← `CustomerPortalService`. صفحه‌ی `PublicPortalContainer` در `packages/ui/src/screens.ts:108`. لینک حضور کارمند (`/my-attendance/[token]`) و فروشگاه عمومی (`/api/public/…`) سطوح عمومی دیگرند.

| بُعد             | وضعیت   | شاهد                                                                                                                         |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Backend support  | PROVEN  | سرویس مانده، فاکتورها، پرداخت‌ها، سفارش‌ها را از جدول‌ها می‌خواند (`customer-portal.service.ts:184-209`)                     |
| Authentication   | PROVEN  | توکن ۶۴ hex (`customer-portal.routes.ts:28`)، سازنده‌ی لینک در هر بازدید دوباره سنجیده می‌شود (header route:7-9)             |
| Authorization    | PROVEN  | ساخت/لغو `customer.write`، خواندن `customer.read` (:37-38)                                                                   |
| Tenant isolation | PARTIAL | لینک `workspace_id`+`customer_id` دارد (service:158)؛ فیلتر سمت سرور؛ RLS واقعی BLOCKED_EXTERNAL                             |
| Mutations        | N/A     | فقط خواندنی — **پرداخت/تأیید از پورتال ممکن نیست**                                                                           |
| Financial truth  | PARTIAL | سقف `PORTAL_LIST_LIMIT` روی فهرست‌ها (service:196,206) با `count: exact` برای تعداد؛ مانده از همان منبع مرکزی                |
| Offline          | N/A     | ماتریس `online_required`                                                                                                     |
| Tests/Migration  | PARTIAL | `customer-portal.test.ts`؛ `developer-platform-04-portal-migration.sql` + `VERIFY-developer-platform-04.sql` + `.pg.test.ts` |

- طبق قاعده، «صفحه‌ی پورتال خودش قابلیت نیست»؛ اینجا پشتوانه‌ی بک‌اند واقعی دارد ولی **فقط خواندنی** است. پورتال تأمین‌کننده/معلم/دانش‌آموز/کارمند (به‌جز لینک حضور) وجود ندارد → `NOT_YET_SUPPORTED`.
- **Final verdict:** `IMPLEMENTED_WITH_LIMITATIONS` (مشتری، فقط خواندن).

## 7. Audit Log — `PARTIAL`

| بُعد                               | وضعیت                 | شاهد                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity/actor/ws/branch/server time | PROVEN                | `AuditService.log` می‌نویسد `user_id, action, entity, old/new_data, ip, workspace_id, branch_id, created_at` (`audit.service.ts:60-90`)                                                                                                                                                                                                                 |
| Immutability                       | PROVEN (منطق)         | تریگر `audit_logs_immutable_trigger` جلوی UPDATE و DELETE (مگر retention) (`docs/admin-02-security-migration.sql:78-105`) + `VERIFY-admin-02-security.sql:25`؛ اجرای انسانی تأیید نشده                                                                                                                                                                  |
| Hash chain                         | **MISSING (نویسنده)** | `verifyChain` ستون‌های `hash/prev_hash` را می‌خواند (`audit.service.ts:480-502`) و route دارد (`audit.routes.ts:143`)؛ ولی `log()` هرگز آن‌ها را نمی‌نویسد و هیچ مایگریشن/تریگری برایشان نیست (`grep prev_hash docs backend` فقط خود reader). یعنی زنجیره‌ی «تأییدپذیر» **هیچ‌وقت داده ندارد** — الگوی «قانون هست و کسی صدایش نمی‌زند» (CLAUDE.md §۷٫۱) |
| Write coverage                     | PARTIAL               | یک قیف واحد: `logBusinessEvent` (۷۶ محل فراخوانی در سرویس‌ها) → `auditService.log` (`event-log.service.ts:178`)؛ به‌علاوه فراخوانی مستقیم در admin/budget/sod. پوشش همه‌ی mutationها اثبات نشد (مثلاً `cycle-count.service.ts` و `draft-po` هیچ audit ندارند)                                                                                           |
| Failure semantics                  | PARTIAL               | `log()` خطا را پرتاب می‌کند (`:88`)، ولی فراخواننده‌ها معمولاً آن را بلعیده/نانوشته‌ست (UNVERIFIED تک‌به‌تک)                                                                                                                                                                                                                                            |
| Query/export                       | PROVEN                | `listForWorkspace`, `getEntityHistoryForWorkspace`, `exportLogs`؛ routes با `report.operational.read`                                                                                                                                                                                                                                                   |
| Offline                            | MISSING               | ماتریس/موتور محلی ردپای ممیزی سمت دستگاه ندارد (grep `audit` در local-engine فقط budgets/تست‌ها)                                                                                                                                                                                                                                                        |
| Tests                              | PARTIAL               | `audit.test.ts` (ردیف‌های زنجیره‌ای را در خود تست با دست می‌سازد، `audit.test.ts:30-47`، پس نویسنده‌ی تولیدی را نمی‌سنجد)، `audit-row-branch.test.ts`, `audit-workspace-columns.test.ts`                                                                                                                                                                |
| Sensitive fields                   | UNVERIFIED            | حذف داده‌ی حساس از `old_data/new_data` بررسی نشد                                                                                                                                                                                                                                                                                                        |

- معماری: قیف نوشتن یکی است (خوب)؛ `activities`/اعلان از همان `logBusinessEvent` جدا شاخه می‌شوند. **DUPLICATED** نیست؛ ضعف در پوشش و در زنجیره‌ی هش است.
- پاسخ «آیا برای مالی/امنیتی کافی و tamper-resistant است؟» → **تا اینجا نه**: append-only دارد (نیازمند VERIFY)، اما زنجیره‌ی هش ادعاشده بدون نویسنده است و پوشش نوشتن ناقص است.
- **Final verdict:** `PARTIAL`.

## 8. Webhooks — `IMPLEMENTED_WITH_LIMITATIONS`

دو سطح: **ورودی** (Stripe: `services/webhook.service.ts` با `claimWebhook`/`releaseClaim` برای idempotency، `:313,337`) و **خروجی** (پلتفرم توسعه‌دهنده: `services/developer/*`).

| بُعد                | وضعیت      | شاهد                                                                                                                       |
| ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Registration/Events | PROVEN     | `WEBHOOK_EVENTS`، رجیستری endpoint (`developer.repository.ts:48-69`)                                                       |
| Signing             | PROVEN     | `signWebhookPayload(secret, body, timestamp)` + هدر امضا (`developer.service.ts:221-225`)                                  |
| SSRF guard          | PROVEN     | `isPrivateAddress` (`developer.domain.ts:230`) و بررسی DNS در `developer.service.ts:124-125`                               |
| Retry/Backoff       | PROVEN     | backoff نمایی تا ۶ ساعت (`developer.domain.ts:212-214`)، `attempts/max_attempts/next_attempt_at` (`repository:79-81`)      |
| Dead-letter         | PARTIAL    | endpoint بعد از شکست‌های پیاپی `is_active=false` + `disabled_reason` (`repository:48,69`)؛ صف مرده‌ی جدا ندارد             |
| Idempotency/Replay  | PROVEN     | `event_id` روی هر تحویل، `claim_webhook_deliveries` با lease، `replay_webhook_deliveries` + هدر replay (`service:228,532`) |
| Worker wiring       | PROVEN     | `drainWebhooks` از `job-scheduler.plugin.ts:303`                                                                           |
| Ordering            | UNVERIFIED | تضمین ترتیب رویدادها بررسی نشد                                                                                             |
| Tests/Migration     | PARTIAL    | `developer-platform*.pg.test.ts` (۹ فایل، BLOCKED_EXTERNAL)، `VERIFY-developer-platform*.sql` (۹ فایل)                     |
| Offline             | N/A        | سمت سرور                                                                                                                   |

- **Final verdict:** `IMPLEMENTED_WITH_LIMITATIONS` — از «HTTP callback ساده» بسیار جلوتر است (امضا، SSRF، retry، replay، lease). محدودیت‌ها: ترتیب، صف مرده‌ی جدا، و نبود اثبات روی PostgreSQL واقعی.

---

## اثر روی امتیاز و معماری

- هیچ‌کدام از ۳۴ قابلیتِ ورودیِ امتیاز تغییر وضعیت `IMPLEMENTED/PARTIAL` نداد؛ **Score unchanged** (۷۰٫۱ / ۸۶٫۲ / ۶۷٫۲).
- یافته‌های تازه که به شکاف‌ها اضافه می‌شود (بدون تغییر عدد امتیاز):
  - `GAP-NEW-1` (P1): Cycle Count حرکت بی‌انبار می‌نویسد و `complete` غیراتمی است.
  - `GAP-NEW-2` (P1): `draft-po` دو پیاده‌سازی ناهمگون (سرور/دستگاه).
  - `GAP-NEW-3` (P1): محدودیت شعبه روی دستگاه اعمال نمی‌شود (`scope: all` ثابت).
  - `GAP-NEW-4` (P2): زنجیره‌ی هش Audit Log بدون نویسنده.
  - `GAP-NEW-5` (P2): Notifications بدون dedupe/کانال/ترجیحات.
