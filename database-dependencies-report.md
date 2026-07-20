# 🗄️ Hisabche Database Dependency Report

**Date:** 2026-07-20T08:17:38.463Z

## Summary

| Metric | Count |
|--------|-------|
| Total Tables | 52 |
| Used Tables | 48 |
| Unused Tables | 4 |
| Active Modules | 12 |

## Used Tables

| Table | Description | Priority | Module |
|-------|-------------|----------|--------|
| accounts | حساب‌های مالی | HIGH | accounting |
| attendance | حضور و غیاب | MEDIUM | hr |
| audit_logs | لاگ‌های حسابرسی | HIGH | system |
| background_jobs | کارهای پس‌زمینه | MEDIUM | system |
| bom_items | آیتم‌های لیست مواد | MEDIUM | manufacturing |
| boms | لیست مواد اولیه | MEDIUM | manufacturing |
| checkout_sessions | جلسات پرداخت | HIGH | billing |
| customers | مشتریان | CRITICAL | core |
| departments | دپارتمان‌ها | HIGH | hr |
| employees | کارمندان | HIGH | hr |
| event_log | لاگ رویدادها | MEDIUM | system |
| event_types | انواع رویدادها | MEDIUM | system |
| interactions | تعاملات با مشتری | MEDIUM | crm |
| invoice_items | آیتم‌های فاکتور | CRITICAL | core |
| invoices | فاکتورها | CRITICAL | core |
| journal_entries | اسناد حسابداری | HIGH | accounting |
| journal_lines | ردیف‌های اسناد | HIGH | accounting |
| leaves | مرخصی‌ها | MEDIUM | hr |
| ledger_entries | دفتر کل | HIGH | accounting |
| notifications | اعلان‌ها | HIGH | system |
| opportunities | فرصت‌های فروش | MEDIUM | crm |
| password_reset_tokens | توکن‌های بازنشانی رمز | HIGH | auth |
| payrolls | حقوق و دستمزد | MEDIUM | hr |
| permissions | دسترسی‌ها | HIGH | auth |
| products | محصولات | CRITICAL | core |
| project_members | اعضای پروژه | HIGH | projects |
| project_tasks | وظایف پروژه | HIGH | projects |
| project_time_entries | ثبت زمان پروژه | MEDIUM | projects |
| projects | پروژه‌ها | HIGH | projects |
| purchase_order_items | آیتم‌های سفارش خرید | MEDIUM | inventory |
| purchase_orders | سفارشات خرید | MEDIUM | inventory |
| role_permissions | دسترسی‌های نقش‌ها | HIGH | auth |
| roles | نقش‌ها | HIGH | auth |
| stock_movements | حرکات انبار | HIGH | inventory |
| subscriptions | اشتراک‌ها | HIGH | billing |
| sync_queue | صف همگام‌سازی | HIGH | system |
| transactions | تراکنش‌ها | CRITICAL | core |
| user_roles | نقش‌های کاربران | CRITICAL | auth |
| warehouses | انبارها | HIGH | inventory |
| webhook_events | رویدادهای Webhook | MEDIUM | billing |
| work_orders | دستورات کاری | MEDIUM | manufacturing |
| workflow_actions | اقدامات جریان کاری | HIGH | workflow |
| workflow_instances | نمونه‌های جریان کاری | HIGH | workflow |
| workflow_steps | مراحل جریان کاری | HIGH | workflow |
| workflows | جریان‌های کاری | HIGH | workflow |
| workspace_invites | دعوت‌نامه‌های فضاهای کاری | HIGH | workspace |
| workspace_members | اعضای فضاهای کاری | CRITICAL | workspace |
| workspaces | فضاهای کاری | CRITICAL | workspace |

## Unused Tables

| Table | Description | Priority | Module |
|-------|-------------|----------|--------|
| billing_plans | پلن‌های اشتراک | HIGH | billing |
| invoice_pdf_cache | کش PDF فاکتور | LOW | cache |
| suppliers | تامین‌کنندگان | HIGH | core |
| sync_logs | لاگ همگام‌سازی | MEDIUM | system |
