# بازبینی UX حسابچه — فهرست

> ۴ اکتبر ۲۰۲۶. هر صفحه‌ی فرانت یک فایل در `pages/` دارد.
> پیشنهاد کلی و فازها: [00-PROPOSAL.md](00-PROPOSAL.md) — **منتظر تأیید**.
> روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.

## چطور ساخته شد

1. `scripts/ux-scan.js` همه‌ی `page.tsx`های `apps/web/app` را پیدا می‌کند، کانتینر هر کدام را در
   `packages/ui` دنبال می‌کند و از کد درمی‌آورد: هوک‌های خواندن و نوشتن، تب‌ها، دیالوگ‌ها، لینک‌های
   ورودی و خروجی، عضویت در منو، ماژول دسترسی، route در app-shell، robots و مقاله‌ی راهنما.
2. `scripts/ux-write.js` آن واقعیت‌ها را با قضاوت دستی هر صفحه (کار صفحه، حکم، یافته‌ها) یکی می‌کند
   و فایل‌ها را می‌نویسد.

برای ساخت دوباره بعد از هر فاز:

```bash
node .claude/ux-audit/scripts/ux-scan.js .claude/ux-audit/scripts/ux-scan.json
```

```bash
node .claude/ux-audit/scripts/ux-write.js .claude/ux-audit/scripts/ux-scan.json
```

```bash
node .claude/ux-audit/scripts/ux-index.js
```

⚠️ اسکن ایستاست: هیچ صفحه‌ای رندر نشده و هیچ آمار استفاده‌ای در کار نیست. ستون «حالت‌ها» جستجوی
متنی است و باید با دیدن صفحه تأیید شود.

## شدت یافته‌ها

`4` کار را متوقف می‌کند یا عدد غلط نشان می‌دهد · `3` کاربر باید صفحه را ترک کند یا بگردد ·
`2` اصطکاک قابل‌توجه · `1` ظاهری · `0` مشکل نیست، نقطه‌ی قوت است.

## صفحه‌های داخل برنامه — 50

| نشانی                    | صفحه                     | حکم             | مقصد پیشنهادی                      | فاز | بالاترین شدت | فایل                                                         |
| ------------------------ | ------------------------ | --------------- | ---------------------------------- | --- | ------------ | ------------------------------------------------------------ |
| `/accounting`            | حسابداری                 | بماند           | —                                  | د   | 3            | [accounting.md](pages/accounting.md)                         |
| `/activities`            | رویدادها                 | بماند           | —                                  | ج   | 2            | [activities.md](pages/activities.md)                         |
| `/analysis`              | تحلیل کسب‌وکار           | بماند           | —                                  | —   | 2            | [analysis.md](pages/analysis.md)                             |
| `/approvals`             | تأییدها                  | بماند           | —                                  | ج   | 2            | [approvals.md](pages/approvals.md)                           |
| `/assistant`             | دستیار هوشمند            | بماند           | —                                  | —   | 2            | [assistant.md](pages/assistant.md)                           |
| `/billing`               | اشتراک                   | بماند           | —                                  | ج   | 2            | [billing.md](pages/billing.md)                               |
| `/customers`             | مشتریان و تأمین‌کنندگان  | بماند           | —                                  | و   | 3            | [customers.md](pages/customers.md)                           |
| `/dashboard`             | امروز (داشبورد)          | بماند           | —                                  | —   | 2            | [dashboard.md](pages/dashboard.md)                           |
| `/data-and-sync`         | داده و همگام‌سازی        | بماند           | —                                  | ب   | 3            | [data-and-sync.md](pages/data-and-sync.md)                   |
| `/developers`            | توسعه‌دهندگان            | بماند           | —                                  | ج   | 2            | [developers.md](pages/developers.md)                         |
| `/governance`            | حاکمیت و دسترسی          | بماند           | —                                  | ج   | 2            | [governance.md](pages/governance.md)                         |
| `/invoices`              | فاکتورها                 | بماند           | —                                  | ز   | 3            | [invoices.md](pages/invoices.md)                             |
| `/invoices/new`          | فاکتورساز (گام ۱)        | بماند           | —                                  | ز   | 3            | [invoices__new.md](pages/invoices__new.md)                   |
| `/manufacturing`         | ساخت و تولید             | بماند           | —                                  | ه   | 2            | [manufacturing.md](pages/manufacturing.md)                   |
| `/market-seller`         | فروشگاه من در بازار      | بماند           | —                                  | —   | 2            | [market-seller.md](pages/market-seller.md)                   |
| `/onboarding`            | شروع کار                 | بماند           | —                                  | —   | 3            | [onboarding.md](pages/onboarding.md)                         |
| `/settings`              | تنظیمات                  | بماند           | —                                  | ج   | 3            | [settings.md](pages/settings.md)                             |
| `/team-and-payroll`      | تیم و حقوق               | بماند           | —                                  | و   | 2            | [team-and-payroll.md](pages/team-and-payroll.md)             |
| `/till`                  | صندوق                    | بماند           | —                                  | —   | 0            | [till.md](pages/till.md)                                     |
| `/warehouse`             | انبار و کالاها           | بماند           | —                                  | ه   | 3            | [warehouse.md](pages/warehouse.md)                           |
| `/customers/[id]`        | مشتری (جزئیات)           | بماند (موجودیت) | —                                  | —   | 2            | [customers___id.md](pages/customers___id.md)                 |
| `/invoices/[id]`         | فاکتور (جزئیات)          | بماند (موجودیت) | —                                  | —   | 2            | [invoices___id.md](pages/invoices___id.md)                   |
| `/team-and-payroll/[id]` | کارمند (جزئیات)          | بماند (موجودیت) | —                                  | —   | 1            | [team-and-payroll___id.md](pages/team-and-payroll___id.md)   |
| `/warehouse/[id]`        | کالا (جزئیات)            | بماند (موجودیت) | —                                  | —   | 2            | [warehouse___id.md](pages/warehouse___id.md)                 |
| `/assets`                | دارایی‌های ثابت          | تب              | `/accounting?tab=assets`           | د   | 2            | [assets.md](pages/assets.md)                                 |
| `/bank`                  | بانک                     | تب              | `/accounting?tab=bank`             | د   | 2            | [bank.md](pages/bank.md)                                     |
| `/budgets`               | بودجه                    | تب              | `/accounting?tab=budgets`          | د   | 2            | [budgets.md](pages/budgets.md)                               |
| `/campaigns`             | کمپین‌ها                 | تب              | `/customers?tab=campaigns`         | و   | 2            | [campaigns.md](pages/campaigns.md)                           |
| `/conflicts`             | تعارض‌ها                 | تب              | `/data-and-sync?tab=conflicts`     | ب   | 2            | [conflicts.md](pages/conflicts.md)                           |
| `/data-migration`        | ورود داده                | تب              | `/data-and-sync?tab=import`        | ب   | 2            | [data-migration.md](pages/data-migration.md)                 |
| `/expiry`                | انقضا                    | تب              | `/warehouse?tab=expiry`            | ه   | 2            | [expiry.md](pages/expiry.md)                                 |
| `/marketplace`           | بازار برنامه‌ها          | تب              | `/developers?tab=apps`             | ج   | 2            | [marketplace.md](pages/marketplace.md)                       |
| `/operations`            | عملیات و پیش‌بینی        | تب              | `/warehouse?tab=reorder`           | ه   | 3            | [operations.md](pages/operations.md)                         |
| `/orders`                | سفارش‌های فروش           | تب              | `/invoices?tab=orders`             | ز   | 3            | [orders.md](pages/orders.md)                                 |
| `/promotions`            | تخفیف‌ها و فهرست قیمت    | تب              | `/invoices?tab=pricing`            | ز   | 2            | [promotions.md](pages/promotions.md)                         |
| `/purchasing`            | سفارش‌های خرید           | تب              | `/invoices?tab=purchase-orders`    | ز   | 3            | [purchasing.md](pages/purchasing.md)                         |
| `/referrals`             | معرفی دوستان             | تب              | `/billing?tab=referrals`           | ج   | 1            | [referrals.md](pages/referrals.md)                           |
| `/stock-count`           | شمارش انبار              | تب              | `/warehouse?tab=count`             | ه   | 3            | [stock-count.md](pages/stock-count.md)                       |
| `/sync-center`           | مرکز همگام‌سازی          | تب              | `/data-and-sync?tab=sync`          | ب   | 3            | [sync-center.md](pages/sync-center.md)                       |
| `/tasks`                 | پیگیری‌ها                | تب              | `/customers?tab=follow-up`         | و   | 2            | [tasks.md](pages/tasks.md)                                   |
| `/timesheets`            | ساعات کار                | تب              | `/team-and-payroll?tab=timesheets` | و   | 2            | [timesheets.md](pages/timesheets.md)                         |
| `/wallet`                | کیف پول                  | تب              | `/billing?tab=wallet`              | ج   | 2            | [wallet.md](pages/wallet.md)                                 |
| `/workflow-templates`    | قالب‌های گردش‌کار        | تب              | `/governance?tab=workflows`        | ج   | 2            | [workflow-templates.md](pages/workflow-templates.md)         |
| `/invoices/new/preview`  | پیش‌نمایش فاکتور (گام ۲) | گام/حالت        | `/invoices/new?step=preview`       | ز   | 3            | [invoices__new__preview.md](pages/invoices__new__preview.md) |
| `/quick-invoice`         | فاکتور سریع              | گام/حالت        | `/invoices/new?mode=quick`         | ز   | 3            | [quick-invoice.md](pages/quick-invoice.md)                   |
| `/accounting-workspace`  | فضای کاری حسابداری       | حذف هاب         | `/accounting`                      | الف | 3            | [accounting-workspace.md](pages/accounting-workspace.md)     |
| `/domain/[domain]`       | فضای کاری (نشانی عمومی)  | حذف هاب         | `هاب همان حوزه`                    | الف | 3            | [domain___domain.md](pages/domain___domain.md)               |
| `/inventory-workspace`   | فضای کاری انبار          | حذف هاب         | `/warehouse`                       | الف | 3            | [inventory-workspace.md](pages/inventory-workspace.md)       |
| `/people-workspace`      | فضای کاری افراد          | حذف هاب         | `/team-and-payroll`                | الف | 3            | [people-workspace.md](pages/people-workspace.md)             |
| `/sales-workspace`       | فضای کاری فروش           | حذف هاب         | `/invoices`                        | الف | 3            | [sales-workspace.md](pages/sales-workspace.md)               |

## صفحه‌های عمومی — 36

بیرون از دامنه‌ی ادغام: سئو، لینک ایمیل یا توکن به نشانی جدا نیاز دارد. فایل هر کدام واقعیت‌های
کد را ثبت کرده است.

| نشانی                               | صفحه                 | فایل                                                                                   |
| ----------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `/`                                 | لندینگ               | [home.md](pages/home.md)                                                               |
| `/about`                            | صفحه‌ی عمومی         | [about.md](pages/about.md)                                                             |
| `/accept-invite`                    | ورود و حساب          | [accept-invite.md](pages/accept-invite.md)                                             |
| `/blog`                             | وبلاگ                | [blog.md](pages/blog.md)                                                               |
| `/blog/[slug]`                      | وبلاگ                | [blog___slug.md](pages/blog___slug.md)                                                 |
| `/blog/category/[slug]`             | وبلاگ                | [blog__category___slug.md](pages/blog__category___slug.md)                             |
| `/blog/category/[slug]/page/[page]` | وبلاگ                | [blog__category___slug___page___page.md](pages/blog__category___slug___page___page.md) |
| `/blog/page/[page]`                 | وبلاگ                | [blog__page___page.md](pages/blog__page___page.md)                                     |
| `/blog/tag/[slug]`                  | وبلاگ                | [blog__tag___slug.md](pages/blog__tag___slug.md)                                       |
| `/blog/tag/[slug]/page/[page]`      | وبلاگ                | [blog__tag___slug___page___page.md](pages/blog__tag___slug___page___page.md)           |
| `/contact`                          | صفحه‌ی عمومی         | [contact.md](pages/contact.md)                                                         |
| `/docs`                             | راهنما               | [docs.md](pages/docs.md)                                                               |
| `/docs/[slug]`                      | راهنما               | [docs___slug.md](pages/docs___slug.md)                                                 |
| `/features/[slug]`                  | صفحه‌ی قابلیت        | [features___slug.md](pages/features___slug.md)                                         |
| `/feedback/[token]`                 | صفحه‌ی عمومی با توکن | [feedback___token.md](pages/feedback___token.md)                                       |
| `/forgot-password`                  | ورود و حساب          | [forgot-password.md](pages/forgot-password.md)                                         |
| `/legal/accessibility`              | حقوقی                | [legal__accessibility.md](pages/legal__accessibility.md)                               |
| `/legal/cookies`                    | حقوقی                | [legal__cookies.md](pages/legal__cookies.md)                                           |
| `/legal/copyright`                  | حقوقی                | [legal__copyright.md](pages/legal__copyright.md)                                       |
| `/legal/data-deletion`              | حقوقی                | [legal__data-deletion.md](pages/legal__data-deletion.md)                               |
| `/legal/disclaimer`                 | حقوقی                | [legal__disclaimer.md](pages/legal__disclaimer.md)                                     |
| `/legal/gdpr`                       | حقوقی                | [legal__gdpr.md](pages/legal__gdpr.md)                                                 |
| `/legal/privacy`                    | حقوقی                | [legal__privacy.md](pages/legal__privacy.md)                                           |
| `/legal/refund`                     | حقوقی                | [legal__refund.md](pages/legal__refund.md)                                             |
| `/legal/security`                   | حقوقی                | [legal__security.md](pages/legal__security.md)                                         |
| `/legal/terms`                      | حقوقی                | [legal__terms.md](pages/legal__terms.md)                                               |
| `/login`                            | ورود و حساب          | [login.md](pages/login.md)                                                             |
| `/market`                           | بازار کالا (عمومی)   | [market.md](pages/market.md)                                                           |
| `/market/[seller]`                  | بازار کالا (عمومی)   | [market___seller.md](pages/market___seller.md)                                         |
| `/market/[seller]/[listing]`        | بازار کالا (عمومی)   | [market___seller____listing.md](pages/market___seller____listing.md)                   |
| `/oauth/authorize`                  | ورود و حساب          | [oauth__authorize.md](pages/oauth__authorize.md)                                       |
| `/portal/[token]`                   | صفحه‌ی عمومی با توکن | [portal___token.md](pages/portal___token.md)                                           |
| `/public-invoice/[token]`           | صفحه‌ی عمومی با توکن | [public-invoice___token.md](pages/public-invoice___token.md)                           |
| `/public-task/[token]`              | صفحه‌ی عمومی با توکن | [public-task___token.md](pages/public-task___token.md)                                 |
| `/reset-password`                   | ورود و حساب          | [reset-password.md](pages/reset-password.md)                                           |
| `/signup`                           | ورود و حساب          | [signup.md](pages/signup.md)                                                           |
