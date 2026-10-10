# HR & Payroll Audit

### مدیریت کارمندان و تیم (Employees & Team)

- **توضیحات**: مدیریت اطلاعات کارمندان، استخدام، نقش‌ها، دسترسی‌ها و انتساب به شعب.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: حذف فایل‌های پراکنده اکسل برای اطلاعات پرسنل و خودکارسازی اعطای دسترسی به نرم‌افزار بدون نیاز به درگیری با مفاهیم پیچیده مجوزها.
- **الگوریتم / منطق کاری در Hisabche**: ثبت کارمند جدید، احراز هویت (در صورت داشتن دسترسی ورود) و انتساب نقش و شعبه مربوطه. پشتیبانی از Caching، صفحه‌بندی و Projection برای بهینه‌سازی.
- **نتیجه برای کسب‌وکار**: مدیریت متمرکز پرسنل و کنترل دسترسی‌های امن به اطلاعات مالی کسب‌وکار در شعب مختلف.
- **نحوه استفاده (مسیر واقعی UI)**: `apps/web/app/[lang]/(dashboard)/team-and-payroll`
- **Backend**: `backend/src/routes/human-resources.routes.ts`, `backend/src/services/human-resources.service.ts`
- **Frontend**: `packages/app-shell/src/features/human-resources/hr-page.tsx`, `packages/ui/src/components/ui/team-and-payroll/team-and-payroll-view.tsx`
- **API**: GET/POST/PATCH `/api/departments`, `/api/employees`
- **Data / DB**: `employees`, `employee_branch_assignments`, `departments`
- **Tests**: `backend/src/__tests__/employee-branch-columns.test.ts`, `packages/ui/src/__tests__/team-hub.test.ts`
- **Status**: COMPLETE
- **زاویه فروش**: پنل جامع منابع انسانی که مستقیماً با دسترسی‌ها و شعب متصل است و نیاز به نرم‌افزار مجزا را از بین می‌برد.
- **مشکل مشتری که حل می‌کند**: پراکندگی اطلاعات پرسنل، سردرگمی در مدیریت دسترسی سیستم و خطای انسانی.
- **مناسب برای چه نوع کسب‌وکاری**: کسب‌وکارهای متوسط تا بزرگ دارای چندین شعبه و پرسنل با سطوح دسترسی متفاوت.
- **Feature Relationships**: متصل به شعبه (Branch Management)، حقوق (Payroll) و حضور و غیاب (Attendance).
- **NEXT_HOOK**: سیستم ارزیابی عملکرد و پاداش‌دهی اتوماتیک.
- **زبان اثبات (برای دمو)**: "با ثبت یک کارمند در اینجا، سطح دسترسی او به سیستم و شعبه‌اش به صورت خودکار تنظیم می‌شود."
- **Evidence**: `human-resources.service.ts` حاوی تمامی مسیرها، مدیریت Cache و `employee_branch_assignments`.
- **Business Value**: 4
- **Demo Value**: 4
- **Differentiation**: 3
- **Frequency of Use**: 4
- **Sales Impact**: 3

### حضور و غیاب (Attendance)

- **توضیحات**: لیست روزانه حضور، ثبت ورود/خروج، مرخصی.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: پایان دادن به چک کردن دستی دفتر حضور و غیاب و محاسبه ذهنی ساعت کار و اضافه‌کاری برای پرداخت آخر ماه.
- **الگوریتم / منطق کاری در Hisabche**: قانون One Record Per Employee Per Day. سیستم بررسی می‌کند تا رکوردهای تکراری ذخیره نشوند و آپدیت روی همان رکورد روزانه انجام شود. یک روز Open ساعت کار محاسبه‌شده (null) ندارد.
- **نتیجه برای کسب‌وکار**: نظارت دقیق روی ساعات کاری پرسنل و جلوگیری از تقلب، پیش‌نیاز محاسبه صحیح حقوق.
- **نحوه استفاده (مسیر واقعی UI)**: زبانه Attendance در `TeamAndPayrollView` و شیت `attendance-sheet.tsx`
- **Backend**: `backend/src/services/attendance/attendance.domain.ts`, `backend/src/services/payroll/attendance.service.ts`, `backend/src/routes/attendance.routes.ts`
- **Frontend**: `packages/api/src/hooks/attendance.ts`, `packages/ui/src/components/ui/team-and-payroll/attendance-sheet.tsx`
- **API**: GET `/attendance-sheet`, PUT `/attendance-sheet`
- **Data / DB**: `attendance` table
- **Tests**: `backend/src/__tests__/attendance-service.test.ts`, `backend/src/__tests__/attendance-shifts-notes.test.ts`, `backend/src/__tests__/attendance.pg.test.ts`
- **Status**: PARTIAL
- **زاویه فروش**: شفافیت کامل در ساعات ورود و خروج به صورت ثبت سیستمی یکپارچه با شیفت‌ها.
- **مشکل مشتری که حل می‌کند**: ثبت دستی ساعات، تقلب در تایم ورود و خروج، خطای محاسبه ساعات در آخر ماه.
- **مناسب برای چه نوع کسب‌وکاری**: تمام شرکت‌ها و فروشگاه‌های دارای پرسنل ساعتی، شیفتی یا تمام‌وقت.
- **Feature Relationships**: متصل به شیفت‌ها (Work Shifts) و حقوق (Payroll).
- **NEXT_HOOK**: گزارش‌گیری پیشرفته تاخیرها.
- **زبان اثبات (برای دمو)**: "حضور و غیاب که زده میشه، ساعت کار محاسبه میشه اما تا زمانی که شما تایید نکنید، مستقیم روی لیست پرداختی حقوق نمی‌شینه."
- **Evidence**: لاجیک عدم محاسبه صفر در `attendanceFor`، اسکریپت تاییدنشده `attendance-01-migration.sql`.
- **Business Value**: 5
- **Demo Value**: 5
- **Differentiation**: 4
- **Frequency of Use**: 5
- **Sales Impact**: 4

### شیفت‌های کاری (Work Shifts)

- **توضیحات**: تعریف شیفت‌های کاری، ساعات شروع و پایان و زمان‌های استراحت برای محاسبه خودکار تاخیر و کسر کار.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: برنامه‌ریزی آسان شیفت‌ها بدون نیاز به محاسبه دستی میزان تاخیر یا کسر کار هر شخص در پایان ماه.
- **الگوریتم / منطق کاری در Hisabche**: شیفت‌ها بازه زمانی (`startsAt`, `endsAt`) و زمان استراحت (`breakMinutes`) دارند و ساعات حضور و تاخیرها بر اساس آن‌ها اعتبارسنجی و محاسبه می‌شود.
- **نتیجه برای کسب‌وکار**: اتوماسیون کامل شیفت‌بندی و کسر کار.
- **نحوه استفاده (مسیر واقعی UI)**: تنظیمات شیفت‌ها در زبانه Attendance
- **Backend**: `backend/src/services/customers/attendance.domain.ts` (و درهم‌تنیده با لاجیک Attendance)
- **Frontend**: `packages/ui/src/components/ui/team-and-payroll/shift-manager.tsx`, `packages/ui/src/components/ui/team-and-payroll/shift-plan.tsx`
- **API**: GET `/work-shifts`
- **Data / DB**: `work_shifts`
- **Tests**: NOT FOUND
- **Status**: COMPLETE
- **زاویه فروش**: برنامه‌ریزی شیفت‌بندی بدون دردسر و پویا که مستقیما با کارکرد ماهانه لینک می‌شود.
- **مشکل مشتری که حل می‌کند**: سختی برنامه‌ریزی شیفت‌های چرخشی و اشتباه در محاسبه زمان‌های استراحت.
- **مناسب برای چه نوع کسب‌وکاری**: بیمارستان‌ها، فروشگاه‌های زنجیره‌ای، رستوران‌ها و کافه‌ها.
- **Feature Relationships**: وابسته و متصل به Attendance.
- **NEXT_HOOK**: تخصیص هوشمند شیفت‌ها بر اساس شلوغی پیش‌بینی‌شده با هوش مصنوعی.
- **زبان اثبات (برای دمو)**: "شما فقط شیفت رو تعریف کنید، سیستم خودش تاخیرها رو بر اساس ساعت شروع شیفت درمیاره."
- **Evidence**: توابع مرتبط با شیفت در `packages/api/src/hooks/attendance.ts` (`useWorkShifts`).
- **Business Value**: 4
- **Demo Value**: 4
- **Differentiation**: 3
- **Frequency of Use**: 3
- **Sales Impact**: 3

### حقوق و دستمزد (Payroll)

- **توضیحات**: محاسبه حقوق، مالیات، کسورات و صدور خودکار سند حسابداری در دفتر کل (Ledger).
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: تسویه سریع حقوق پرسنل و اطمینان کامل از اینکه تمام پرداختی‌ها، کسورات و مالیات به‌صورت متوازن در دفاتر حسابداری شرکت لحاظ شده‌اند.
- **الگوریتم / منطق کاری در Hisabche**: تبدیل لیست حقوق به ژورنال‌های بالانس شده (Journal Entries). حقوق ناخالص به عنوان هزینه (`salary_expense`) بدهکار، و مالیات (`tax`)، کسورات (`payable`) و خالص پرداختی (`cash`/`bank`) بستانکار می‌شوند.
- **نتیجه برای کسب‌وکار**: یکپارچگی بی‌نقص حقوق پرداختی با حسابداری بدون نیاز به ثبت دستی اسناد.
- **نحوه استفاده (مسیر واقعی UI)**: زبانه Payroll در `TeamAndPayrollView`
- **Backend**: `backend/src/services/payroll/payroll-ledger.domain.ts`, `backend/src/routes/human-resources.routes.ts`
- **Frontend**: `packages/api/src/hooks/payroll.ts`, `packages/ui/src/components/ui/team-and-payroll/payroll-list-table.tsx`, `packages/ui/src/components/ui/team-and-payroll/payroll-outcome.tsx`
- **API**: GET/POST `/payrolls`, PATCH `/payrolls/:id`, GET `/payrolls/summary`
- **Data / DB**: `payrolls`, `journal_entries`, `transactions`
- **Tests**: `backend/src/__tests__/payroll-ledger.test.ts`, `packages/ui/src/components/ui/team-and-payroll/__tests__/payroll-tab-wiring.test.ts`, `packages/ui/src/__tests__/payroll-outcome.test.ts`
- **Status**: COMPLETE
- **زاویه فروش**: واریز حقوق و ثبت دقیق سند حسابداری آن با تمامی جزئیات فقط با یک کلیک.
- **مشکل مشتری که حل می‌کند**: ثبت نشدن سند حسابداری برای حقوق‌های پرداختی و ایجاد مغایرت پنهان در ترازنامه‌های آخر ماه (مشکل J0).
- **مناسب برای چه نوع کسب‌وکاری**: تمامی کسب‌وکارها.
- **Feature Relationships**: وابسته به Accounting و Attendance.
- **NEXT_HOOK**: واریز گروهی (Batch Payout) از طریق وب‌سرویس مستقیم بانکی.
- **زبان اثبات (برای دمو)**: "به محض اینکه فیش حقوقی رو پرداخت می‌زنید، سند حسابداری دقیقاً همون لحظه بدون دخالت دست ثبت میشه و حساب بانکی آپدیت میشه."
- **Evidence**: اسکریپت `phase-j-04-payroll-ledger-migration.sql`، متدهای ثبت و تسویه `useCreatePayroll` و `useSettlePayroll` در هوک‌ها، اعتبارسنجی تراز `linesBalance` در بک‌اند.
- **Business Value**: 5
- **Demo Value**: 5
- **Differentiation**: 5
- **Frequency of Use**: 4
- **Sales Impact**: 5

### تایم‌شیت (Timesheets)

- **توضیحات**: لاگ زمان کارمندان روی پروژه‌ها، محاسبه تایم‌های قابل پرداخت (Billable) و سودآوری پروژه‌ها.
- **چه کاری از صاحب کسب‌وکار را آسان کرده**: محاسبه خودکار هزینه نیروی انسانی صرف‌شده روی پروژه‌ها و فاکتور کردن سریع و بدون خطای آن‌ها برای مشتری.
- **الگوریتم / منطق کاری در Hisabche**: ثبت ساعات با نرخ توافقی (`rateMinor`). اگر ساعت‌ها فاکتور شوند، فیلد `invoice_id` تخصیص می‌یابد و به عنوان قفل عمل می‌کند تا از فاکتور شدن مجدد یا ویرایش پس از صدور جلوگیری کند.
- **نتیجه برای کسب‌وکار**: ردیابی دقیق هزینه نیروی انسانی در هر پروژه و عدم فراموشی در صدور فاکتور کارها برای مشتری.
- **نحوه استفاده (مسیر واقعی UI)**: `packages/ui/src/components/ui/timesheets/timesheets-view.tsx`
- **Backend**: `backend/src/services/timesheets/timesheets.service.ts`, `backend/src/services/timesheets/billing.domain.ts`
- **Frontend**: `packages/api/src/hooks/timesheets.ts`, `packages/ui/src/components/ui/timesheets/timesheets-view.tsx`, `packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx`
- **API**: متدهای `timesheets.service.ts` شامل listEntries, logTime, updateEntry, markBilled, previewBilling
- **Data / DB**: `time_entries`, `project_billing_config`, `invoices`
- **Tests**: NOT FOUND
- **Status**: COMPLETE
- **زاویه فروش**: هیچ ساعتی از کار کارمندان هدر نمی‌رود و دقیقاً تبدیل به پول (Invoice) می‌شود.
- **مشکل مشتری که حل می‌کند**: فراموشی فاکتور کردن ساعات کار پروژه‌ای و ضرر دادن شرکت‌های خدماتی.
- **مناسب برای چه نوع کسب‌وکاری**: شرکت‌های نرم‌افزاری، آژانس‌های مارکتینگ، فریلنسرها، شرکت‌های مشاور و خدماتی.
- **Feature Relationships**: وابسته به Invoices (برای صدور فاکتور) و Projects.
- **NEXT_HOOK**: پیشنهاد قیمت پروژه‌های جدید بر اساس عملکرد و تایم‌شیت پروژه‌های قبلی مشابه.
- **زبان اثبات (برای دمو)**: "ساعت کار پرسنل روی پروژه رو وارد کن، سیستم خودش آخر کار اون رو به پیش‌فاکتور مشتری تبدیل میکنه و اجازه دوبار فاکتور شدن هم نمیده."
- **Evidence**: منطق بررسی و جلوگیری از ویرایش `is('invoice_id', null)` در `timesheets.service.ts`.
- **Business Value**: 5
- **Demo Value**: 4
- **Differentiation**: 4
- **Frequency of Use**: 5
- **Sales Impact**: 4
