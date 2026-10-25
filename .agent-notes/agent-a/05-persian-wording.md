# Pass 5 — Persian wording (the product's own voice)

## Files read

- `packages/i18n/messages/fa/common.json` — scripted sampling only (never whole):
  namespace leaf counts + 14 samples per namespace.
- `packages/i18n/messages/af/common.json` — same keys, only differences recorded.
- Script: `.agent-notes/agent-a/i18n-sample.mjs` → `_i18n-sample.txt` (555 lines).

## Facts proven

- 153 top-level namespaces. Largest: admin 853, landing 800, docs 395,
  accounting 232, migration 227, attendance 213, invoiceBuilder 212,
  warehouse 205, manufacturing 193, invoices 149, nav 145, till 139,
  customers 140, ai 20 (assistant), offline 19, sync 49.
- `reports` = 0 leaves and `approvals` = 0 leaves: reports live under `analysis`
  (104) and `accounting`; approvals under `approvalsHub` (4). Do not name a
  «گزارش‌ها» menu that the keys do not support.
- The voice is second person, conversational: «برای دیدن نمودارتان شروع به
  فروش کنید»، «از دفترهایتان بپرسید»، «چه کسی چقدر باید بپردازد».
- Feature vocabulary to reuse: فاکتور / مشتری / انبار / صندوق / دستیار حسابچه /
  تفکیک وظایف / مغایرت بانکی / بستن ماه / انتقال داده / همگام‌سازی.
- Honest-state vocabulary already shipped: «این کار اینترنت می‌خواهد» (badge
  «نیازمند اینترنت»)، «این دستگاه هنوز این فهرست را دریافت نکرده است»،
  «اطلاعات و اسناد محلی شما کاملاً محفوظ است»، «بخشی از بها تخمینی است».
- Offline temporary invoice number is labelled «موقت» (`offline.temporary_invoice_number`).
- AI is framed as an assistant with a monthly question allowance: «سقف پرسش‌های
  این ماه تمام شده است»، «پرسش باقی‌مانده».
- Till explains itself: cash in/out, every cash movement with the balance after
  it, invoice cash payments arrive here automatically, bank transfer writes a
  journal entry (`till.ledger_hint`, `till.transfer_hint`).
- Manufacturing has a real "not switched on" message: `MANUFACTURING_MIGRATION_PENDING`
  → the module can be present and not enabled for a book.
- Plan limit message names the ceiling and the way out (`billing.limitReached.invoices`).

## Dari differences that really matter (quoted)

- انبار → **گدام**؛ «از انبار» → «از گدام».
- فاکتور → **بل**؛ «شماره فاکتور» → «شماره بل»؛ «فاکتور نسیه» (af) vs
  «فاکتور اعتباری» (fa).
- مشتریان → **مشتری‌ها**؛ تأمین‌کنندگان → **تأمین‌کننده‌ها**.
- «خوش آمدید» → «خوش اومدی»؛ «رمز عبور را فراموش کردید؟» → «رمزت رو فراموش کردی؟».
- سود و زیان → «صورت سود و زیان»؛ بودجه → «بودیجه»؛ وام → «قرضه».
- کالا (fa) vs محصول/جنس (af) — both appear; keep کالا in fa text.

## Facts not proven

- That every fa key has an af counterpart (only sampled namespaces compared).
- `reports`/`approvals` emptiness is a key-shape fact, not proof that no report
  screen exists (analysis + accounting screens do exist).

## Deliberately skipped

- `admin` (853) and `docs` (395) namespaces — admin is not customer-facing,
  docs keys are help text; `landing` body beyond samples (Pass 6 covers claims).
