# مدل وضعیت‌ها

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

## جلسه‌ی خدمت (نوبت)

| از            | به                                                               |
| ------------- | ---------------------------------------------------------------- |
| `scheduled`   | `checked_in`، `in_progress`، `delivered`، `cancelled`، `no_show` |
| `checked_in`  | `in_progress`، `delivered`، `cancelled`                          |
| `in_progress` | `delivered`، `cancelled`، `no_show`                              |
| `delivered`   | `cancelled`                                                      |
| `cancelled`   | پایانی                                                           |
| `no_show`     | پایانی                                                           |

منبع: `isValidSessionStatusTransition` در `service-delivery.domain.ts`.

## پرونده‌ی تعمیر

| از              | به                                                 |
| --------------- | -------------------------------------------------- |
| `received`      | `diagnosing`، `repairing`، `cancelled`             |
| `diagnosing`    | `waiting_parts`، `repairing`، `ready`، `cancelled` |
| `waiting_parts` | `repairing`، `cancelled`                           |
| `repairing`     | `waiting_parts`، `ready`، `cancelled`              |
| `ready`         | `delivered`، `repairing`                           |
| `delivered`     | پایانی                                             |
| `cancelled`     | پایانی                                             |

منبع: `REPAIR_MOVES` در `repair-tickets.ts`.

## حقوق

- `paid` نهایی است: بله · `draft` نهایی است: نه.
- منبع: `isPayrollFinal`. «پرداخت نشد» دلیل می‌خواهد.

## فاکتور

- `pending` یعنی «پرداخت‌نشده»، نه «در انتظار تأیید».
- حذف و لغو از `reverseEffects` رد می‌شود: دفتر، پرداخت‌های خود فاکتور، انبار، بها.
- فاکتوری که روی دستگاه ثبت شده تا جواب سرور شماره‌ی موقت `OFF-…` دارد.
