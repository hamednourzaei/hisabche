# 11 — EMPLOYEE / ATTENDANCE / PAYROLL FLOW

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×3، PARTIAL ×3، NOT_VERIFIED ×2
مرتبط: [09](09-ACCOUNTING-LEDGER-FLOW.md) · [13](13-PERMISSION-FLOW.md)

دامنه وجود دارد: کارمند/حضور/حقوق/مرخصی در `backend/src/services/human-resources.service.ts` و `backend/src/services/payroll/` (attendance، shift، لینک حضور عمومی).

## FLOW-060 — حقوق

- ایجاد: `HumanResourcesService.createPayroll` (`:609`) ⇒ ردیف `payrolls` (پیش‌نویس).
- نتیجه: `updatePayrollStatus` (`:710`) — «پرداخت‌شده» نهایی است (`PAYROLL_ALREADY_PAID`، رد در شرط WHERE)؛ «پرداخت نشد» دلیل می‌خواهد.
- ثبت دفتر: وقتی `status==='paid'` ⇒ `bookPayroll` (`:769`) ⇒ `payrollLines` (`packages/validation/src/schemas/payroll-rules.ts:78`):
  Dr `salary_expense` = gross؛ Cr `tax` = tax؛ Cr `payable` = کسورات (مثل بازپرداخت مساعده)؛ Cr `cash|bank` = gross − tax − کسورات. `cashRole = cash` اگر حساب نقد وجود دارد وگرنه `bank` (`:780`).
- بازتلاش: `POST /api/payrolls/:id/book` با `payroll.post` (`human-resources.routes.ts:434-451`).
- نبود حساب ⇒ ثبت می‌شود، دفتر نه (`MISSING_ACCOUNTS`، `payroll_posting_readiness` view).
- Idempotency دفتر: `ledger.postDocument` بر پایه (payroll, id) ⇒ دو بار ثبت = یک سند. Idempotency ساخت حقوق: `payrolls.client_request_id` در migration `payroll-idempotency-01` — `LIVE_VERIFIED_BY_HUMAN` برای وجود ستون و ایندکس (نتیجهٔ VERIFY را کاربر در همین نشست چسباند: `column_client_request_id_exists: true, index_idx_payrolls_client_request_id_exists: true`)؛ رفتار زندهٔ فلو در این فاز اجرا نشد.
- آفلاین: `local-engine/src/routes/payroll.ts` + نگاشت ماتریس `POST /payrolls/:x/book` (feature `hr.payroll_rebook` سرور-فقط). انتقال به ابر برای حقوق: `NOT_IMPLEMENTED`.

## حضور

- برگهٔ حضور فقط از `payroll/attendance.service.ts`؛ «ثبت‌نشده ≠ غایب»؛ به حقوق وصل نیست (CLAUDE.md).
- لینک کارمند: درخواست append-only (`attendance_submissions`)، منطقهٔ زمانی محل کار الزامی (`ATTENDANCE_TIME_ZONE_NOT_SET`).
- دستگاه‌ها: `attendance-devices` (generic فقط).
- NOT_VERIFIED: ارتباط خودکار حضور→حقوق (طبق CLAUDE.md وجود ندارد)؛ مرخصی `leaves`.

## Permission

`payroll.read/write/post` (route)، آفلاین `payroll.write`, `employee.write`, `leave.write` (`local auth.ts`).
