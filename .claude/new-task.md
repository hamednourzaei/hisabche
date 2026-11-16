## تمام کار هارو spec  بندی فاز بندی ساختار بندی با کد مطابقت بده سپس audit بندی بکن و یک پرامپت بده بدم انتی گرویتی و تمام این مراحل را کامل بکند هم برای انلاین افلاین موبایل ویندوز و وب با ماژول های دانلود پذیر و زیرساخت فعلی و در انتهای هر فاز یک تیک کنار هر فاز کامل کرد بزاره که در انتهای پرامپت خودت یک بازبینی ساختاری و کدی رویه تمام کدی که زده انجام بدی و اگه باگی گپی یا کاری انجام نشده بود خودت کامل انجامش بدی  
##   
## HISABCHE — 67 INDUSTRY OPERATIONAL WORKFLOW & EXPERIENCE BLUEPRINT  
## ROLE  
You are the Principal Business Systems Architect, Industry Workflow Analyst, ERP Product Designer, UX Architect, Financial Workflow Analyst and Cross-Platform Product Engineer for the existing Hisabche monorepo.  
Repository: https://github.com/hamednourzaei/hisabche  
Your assignment begins ONLY after the HISABCHE PRINCIPAL ENGINEERING COMPLETION MASTER PROMPT V3.0 has been completed or its remaining blockers have been documented.  
Your mission is to design a complete, realistic, page-by-page operational experience for every one of the 67 registered business industries in Hisabche.  
This is not a naming exercise.  
This is not a dashboard color customization exercise.  
This is not a collection of generic industry descriptions.  
You must design how each actual business operates inside Hisabche, from opening the business each morning to completing its daily operations, receiving payments, handling customers, managing employees, closing the day and reviewing financial performance.  
The result must be a complete, evidence-based operational blueprint for all 67 industries.  
Work independently and sequentially.  
Do not use subagents, parallel agents or background sessions.  
Do not ask the owner questions.  
Do not modify the existing architecture or create parallel business systems.  
Do not implement features during this phase unless explicitly required to correct a documentation or specification defect. This phase is primarily an operational discovery, workflow design and product specification phase.  
   
⸻  
   
## 1. REPOSITORY-FIRST DISCOVERY  
Before designing anything, inspect the actual current repository.  
Read:  
* AGENTS.md.  
* Architecture documentation.  
* Operational DNA documentation.  
* Business type registry.  
* Industry IDs.  
* Archetype mappings.  
* Capability registry.  
* Navigation contracts.  
* Dashboard registry.  
* KPI definitions.  
* Semantic terminology.  
* PageHub and HubTabs.  
* Existing forms and actions.  
* Existing domain services.  
* Existing business workflows.  
* Permissions.  
* Database schemas.  
* Offline behavior.  
* Localization.  
* Existing industry coverage matrices.  
* V3.0 execution report.  
Do not trust historical counts.  
## 1.1 Verify the 67 industries  
Read the authoritative business registry:  
```
packages/ui-contract/src/business-types.ts

```
Use the actual repository path if it has changed.  
Extract all registered business IDs.  
Verify:  
* Exact number of industries.  
* Stable IDs.  
* Existing names.  
* Existing categories.  
* Existing archetypes.  
* Existing capabilities.  
* Existing overrides.  
* Existing localization keys.  
The target is 67 registered industries.  
If the registry contains a different number, report the discrepancy and use the actual registered entries. Never invent industry IDs to force the count to 67.  
Every registered industry must receive its own complete workflow specification.  
No industry may be silently omitted.  
## 1.2 Verify existing implementation  
For each industry determine:  
* What already works.  
* What is shared.  
* What is configurable.  
* What is industry-specific.  
* What is missing.  
* What is only represented visually.  
* What is connected to real domain services.  
* What works offline.  
* What is unsupported.  
Never design an imaginary feature as if it already exists.  
Clearly distinguish:  
EXISTING_AND_VERIFIED EXISTING_BUT_INCOMPLETE CONFIGURATION_REQUIRED NEW_CAPABILITY_REQUIRED NOT_SUPPORTED BLOCKED_EXTERNAL  
   
⸻  
   
## 2. THE CORE PRODUCT PRINCIPLE  
Hisabche must provide:  
ONE BUSINESS OPERATING SYSTEM ONE SHARED DOMAIN CORE ONE FINANCIAL ENGINE ONE PERMISSION SYSTEM ONE NAVIGATION ARCHITECTURE ONE OPERATIONAL DNA MODEL ONE KPI DEFINITION SYSTEM ONE CROSS-PLATFORM EXPERIENCE  
But:  
67 DISTINCT OPERATIONAL EXPERIENCES.  
Do not create 67 independent applications.  
Do not create 67 independent dashboards.  
Do not duplicate accounting, inventory, CRM, workforce or payment engines.  
Instead, compose each industry experience from existing shared capabilities and verified industry-specific operational requirements.  
Use the existing three-level model:  
1. Archetype.  
2. Operational DNA.  
3. Workspace configuration.  
An industry defines its recommended defaults, not an immutable limitation.  
A business that operates across multiple industries must be able to combine compatible capabilities.  
   
⸻  
   
## 3. REQUIRED DELIVERABLE STRUCTURE  
Create or update the existing canonical documentation structure.  
Recommended structure:  
```
docs/industries/
docs/industries/README.md
docs/industries/INDUSTRY-REGISTRY.md
docs/industries/INDUSTRY-COVERAGE-MATRIX.md
docs/industries/SHARED-PAGE-CATALOG.md
docs/industries/SHARED-CAPABILITY-MATRIX.md
docs/industries/WORKFLOW-STATE-MODEL.md
docs/industries/ROLE-PERMISSION-MATRIX.md
docs/industries/OFFLINE-WORKFLOW-MATRIX.md
docs/industries/CROSS-PLATFORM-MATRIX.md
docs/industries/ACCEPTANCE-CRITERIA.md

```
Create one dedicated specification for every actual registered industry:  
```
docs/industries/<industry-id>/README.md
docs/industries/<industry-id>/DAILY-WORKFLOW.md
docs/industries/<industry-id>/PAGE-BY-PAGE-UX.md
docs/industries/<industry-id>/OPERATIONS-AND-TRANSACTIONS.md
docs/industries/<industry-id>/KPI-AND-REPORTS.md
docs/industries/<industry-id>/ROLES-AND-PERMISSIONS.md
docs/industries/<industry-id>/OFFLINE-AND-DEVICE.md
docs/industries/<industry-id>/GAPS-AND-REQUIREMENTS.md

```
Use the actual industry ID as the directory name.  
Avoid duplicating information that belongs to shared architecture documentation.  
Industry-specific documents should reference the authoritative shared specifications.  
   
⸻  
   
## 4. INDUSTRY PROFILE  
For each of the 67 industries document:  
## 4.1 Business identity  
* Industry ID.  
* Localized industry name.  
* Archetype.  
* Operational DNA.  
* Typical business size.  
* Typical staff roles.  
* Main revenue sources.  
* Main cost sources.  
* Typical customer types.  
* Suppliers.  
* Main products or services.  
* Operational characteristics.  
Do not invent market statistics.  
Where business practices vary by country, region or business model, describe the alternatives instead of forcing one assumption.  
## 4.2 Business operating model  
Explain:  
* What the business sells.  
* How it receives orders.  
* How it delivers products or services.  
* How it schedules work.  
* How it consumes inventory.  
* How it charges customers.  
* How it receives money.  
* How it handles credit.  
* How it pays suppliers.  
* How employees participate.  
* How work is completed.  
* How revenue and costs are recognized.  
Distinguish product sales, service delivery, deposits, advances, liabilities, packages, subscriptions and deferred revenue correctly.  
## 4.3 Business lifecycle  
Describe the actual lifecycle of the main business transaction.  
Examples:  
Retail: Product → Cart → Sale → Payment → Stock deduction → Receipt → Ledger.  
Beauty salon: Appointment → Reservation → Deposit → Service → Consumables → Employee commission → Settlement → Ledger.  
Education: Student → Enrollment → Package → Attendance → Credit consumption → Payment → Progress report.  
Repair: Customer → Device/Asset → Service ticket → Diagnosis → Parts → Labor → Completion → Payment → Warranty.  
These are illustrative examples only. Derive each actual workflow from the industry’s operational requirements.  
   
⸻  
   
## 5. PAGE-BY-PAGE EXPERIENCE SPECIFICATION  
This is the most important deliverable.  
For every industry, inspect the actual navigation and page contracts.  
Then document every applicable page.  
Do not automatically include every page in every industry.  
Do not hide important functionality merely to make the interface appear simple.  
For every page, provide the following specification.  
## 5.1 Page identity  
* Page ID.  
* Current route.  
* Page name.  
* Industry-specific name.  
* Archetype.  
* Operational purpose.  
* User roles.  
* Required capabilities.  
* Required permissions.  
* Online/offline availability.  
* Priority.  
## 5.2 Page layout  
Describe the page from top to bottom:  
1. Header.  
2. Page title.  
3. Main actions.  
4. KPI area.  
5. Search and filters.  
6. Primary content.  
7. Secondary content.  
8. Detail panels.  
9. Footer or pagination.  
10. Mobile layout.  
Be explicit about the order and purpose of each section.  
## 5.3 Page data  
For every visible element specify:  
* Field name.  
* Semantic label.  
* Data source.  
* Data type.  
* Unit.  
* Currency.  
* Required or optional.  
* Editable or read-only.  
* Visibility conditions.  
* Permission requirements.  
* Empty state.  
* Loading state.  
* Error state.  
Do not invent API fields.  
When a field does not exist, mark it as a required domain/API/schema change rather than pretending it already exists.  
## 5.4 Main actions  
For every button or action specify:  
* Label.  
* Purpose.  
* Required permission.  
* Input.  
* Validation.  
* Domain operation.  
* Expected result.  
* State transition.  
* Accounting impact.  
* Inventory impact.  
* Employee impact.  
* Audit impact.  
* Offline behavior.  
* Failure behavior.  
## 5.5 Industry-specific changes  
For each shared page explicitly describe:  
* What remains unchanged.  
* What is renamed.  
* What is added.  
* What is removed from the visible composition.  
* What becomes optional.  
* What becomes mandatory.  
* What moves to another tab.  
* What is visible only to managers.  
* What is visible only to accountants.  
* What is unavailable for this industry.  
Removing a UI element must never remove an underlying accounting or audit requirement.  
## 5.6 Page states  
Specify:  
* First-use empty state.  
* Normal state.  
* Loading state.  
* Offline state.  
* Permission-denied state.  
* Validation-error state.  
* Partial-data state.  
* Conflict state.  
* Completed state.  
* Archived state.  
Never represent missing information as zero.  
   
⸻  
   
## 6. REQUIRED SHARED PAGE CATALOG  
First inspect the real application.  
Then map the following page categories to actual routes and existing page contracts.  
These are discovery categories, not instructions to create duplicate pages.  
## A. Home and management  
* Dashboard.  
* Daily overview.  
* Notifications.  
* Tasks.  
* Activity.  
* Calendar.  
* Quick actions.  
## B. Customers and CRM  
* Customer list.  
* Customer profile.  
* Customer history.  
* Customer balances.  
* Customer groups.  
* Follow-ups.  
* Loyalty.  
* Complaints.  
* Customer communication.  
## C. Products and services  
* Product list.  
* Product details.  
* Product variants.  
* Service catalog.  
* Packages.  
* Price lists.  
* Barcode.  
* Units of measure.  
* Bundles.  
## D. Inventory  
* Stock overview.  
* Warehouse.  
* Stock movement.  
* Receiving.  
* Issuing.  
* Transfers.  
* Adjustments.  
* Cycle counts.  
* Low-stock alerts.  
* Batch and expiry.  
* Purchase orders.  
## E. Sales and transactions  
* POS.  
* Quick invoice.  
* Sales list.  
* Invoice details.  
* Quotes.  
* Orders.  
* Returns.  
* Refunds.  
* Payments.  
* Deposits.  
* Receivables.  
## F. Suppliers and purchasing  
* Supplier list.  
* Supplier profile.  
* Purchase orders.  
* Goods receipt.  
* Supplier invoices.  
* Supplier payments.  
* Payables.  
## G. Workforce  
* Employee list.  
* Employee profile.  
* Attendance.  
* Timesheets.  
* Shifts.  
* Payroll.  
* Commissions.  
* Performance.  
* Access and permissions.  
## H. Financial operations  
* Cash register.  
* Cash movements.  
* Bank accounts.  
* Expenses.  
* Income.  
* Journal entries.  
* Chart of accounts.  
* Financial statements.  
* Reconciliation.  
* Cheques and PDC.  
* Period close.  
## I. Industry-specific operations  
Examples include:  
* Appointments.  
* Reservations.  
* Service tickets.  
* Student enrollment.  
* Attendance and lesson credits.  
* Production orders.  
* Work orders.  
* Repair diagnosis.  
* Delivery and dispatch.  
* Projects.  
* Contracts.  
* Subscriptions.  
* Asset management.  
* Job cards.  
  
و در اخر مبخواهیم به همچین چیزی حدودا برسیم   
<div dir="rtl">به نظرم بعد از تکمیل V3.0، حسابچه باید وارد مرحله‌ای شود که من اسمش را طراحی و پیاده‌سازی ۶۷ تجربه عملیاتی اختصاصی (67 Industry Operating Experiences) می‌گذارم.</div>  
<div dir="rtl">یک تفاوت اساسی وجود دارد که می‌خواهم روی آن تأکید کنم:</div>  
<div dir="rtl">حسابچه نباید ۶۷ نرم‌افزار متفاوت داشته باشد؛ باید یک موتور مشترک داشته باشد که ۶۷ نوع کسب‌وکار را به شکل طبیعی و متناسب با کار واقعی‌شان مدیریت کند.</div>  
<div dir="rtl">یعنی فروشگاه پوشاک، طلافروشی، آرایشگاه، آموزشگاه زبان، تعمیرگاه و رستوران نباید صرفاً رنگ و عنوان متفاوت داشته باشند. گردش کار، داشبورد، فرم‌ها، عملیات، KPIها و اولویت‌های هرکدام باید متناسب با فعالیتشان باشد.</div>  
**۱. ساختار کلی تجربه هر صنف**  
<div dir="rtl">من برای هر صنف ۷ لایه در نظر می‌گیرم:</div>  
<div dir="rtl">۱. هویت کسب‌وکار</div>  
<div dir="rtl">نوع فعالیت، زیرشاخه، اندازه، شعبه و مدل درآمدی</div>  
<div dir="rtl">۲. تجربه و رابط اختصاصی صنف</div>  
<div dir="rtl">داشبورد، منو، صفحات، تب‌ها و عناوین</div>  
<div dir="rtl">۳. عملیات اختصاصی</div>  
<div dir="rtl">فروش، خدمات، سفارش، نوبت، تولید، تعمیر و تحویل</div>  
<div dir="rtl">۴. مشتری و ارتباطات</div>  
<div dir="rtl">پرونده، سابقه، اعتبار، وفاداری و پیگیری</div>  
<div dir="rtl">۵. منابع و کارکنان</div>  
<div dir="rtl">موجودی، مواد مصرفی، تجهیزات، کارکنان و ظرفیت</div>  
<div dir="rtl">۶. مالی و حسابداری</div>  
<div dir="rtl">دریافت، پرداخت، بدهی، هزینه، درآمد و سود</div>  
<div dir="rtl">۷. تحلیل و مدیریت</div>  
KPI، گزارش، هشدار، عملکرد و تصمیم‌گیری  
<div dir="rtl">این هفت لایه برای همه مشترک‌اند، اما ترکیب و اهمیتشان در هر صنف فرق می‌کند.</div>  
<div dir="rtl">مثلاً در آموزشگاه، ظرفیت کلاس و اعتبار جلسات اهمیت دارد؛ در فروشگاه، موجودی و گردش کالا؛ در آرایشگاه، نوبت، صندلی، متخصص و مواد مصرفی.</div>  
**۲. اول باید ۶۷ صنف را به خانواده‌های عملیاتی تقسیم کنیم**  
<div dir="rtl">به‌جای اینکه ۶۷ بار از صفر طراحی کنیم، آن‌ها را در خانواده‌هایی قرار می‌دهیم که رفتار عملیاتی مشترک دارند.</div>  
<div dir="rtl">این دسته‌بندی پیشنهادی است؛ تعداد نهایی هر خانواده باید با فهرست واقعی ۶۷ صنف ریپو تطبیق داده شود.</div>  

| خانواده | نمونه صنف‌ها | هسته عملیاتی اصلی |
| --------------- | ------------------------------- | -------------------------- |
| خرده‌فروشی | پوشاک، کفش، موبایل، لوازم خانگی | کالا، فروش، موجودی |
| عمده‌فروشی | پخش، بنکداری، واردات | سفارش، انبار، اعتبار |
| خدمات شخصی | آرایشگاه، سالن زیبایی، ناخن | نوبت، متخصص، مواد مصرفی |
| آموزش | آموزشگاه زبان، مدرس خصوصی | ثبت‌نام، کلاس، حضور، اعتبار |
| تعمیرات | موبایل، خودرو، لوازم خانگی | پرونده تعمیر، قطعه، اجرت |
| غذا و پذیرایی | رستوران، کافه، فست‌فود | سفارش، میز، آشپزخانه |
| سلامت و مراقبت | کلینیک‌ها و خدمات مراقبتی | نوبت، خدمت، پرونده مجاز |
| تولید | کارگاه، پوشاک، مواد غذایی | مواد اولیه، تولید، محصول |
| ساخت‌وساز | پیمانکاری، تأسیسات | پروژه، قرارداد، هزینه |
| حمل‌ونقل | باربری، پیک، ناوگان | مأموریت، راننده، تحویل |
| اقامت و گردشگری | هتل، اقامتگاه، آژانس | رزرو، ظرفیت، تسویه |
| حرفه‌ای و اداری | مشاوره، حقوقی، طراحی | پرونده، قرارداد، زمان |
| مالی و بازرگانی | صرافی، طلافروشی و موارد مشابه | دارایی، تسویه، کنترل مالی |
  
نکته مهم: خانواده عملیاتی به معنی یکسان بودن صفحات نیست. دو صنف در یک خانواده می‌توانند صفحات و فرایندهای متفاوت داشته باشند.  
**۳. نمونه واقعی: فروشگاه پوشاک**  
<div dir="rtl">فروشگاه پوشاک را در نظر بگیر که دو کارمند و یک صاحب کسب‌وکار دارد.</div>  
**داشبورد فروشگاه پوشاک**  
<div dir="rtl">وقتی صاحب فروشگاه وارد حسابچه می‌شود، نباید با نمودارهای حسابداری و اطلاعات غیرضروری روبه‌رو شود.</div>  
<div dir="rtl">باید فوراً بفهمد:</div>  
<div dir="rtl">داشبورد فروشگاه پوشاک</div>  
<div dir="rtl">نمونه طراحی</div>  
<div dir="rtl">فروش امروز</div>  
**۱۲٫۵M**  
<div dir="rtl">واحد پول نمونه</div>  
<div dir="rtl">سفارش‌های امروز</div>  
**۳۸**  
<div dir="rtl">فاکتور ثبت‌شده</div>  
<div dir="rtl">کالاهای کم‌موجود</div>  
**۱۲**  
<div dir="rtl">نیازمند بررسی</div>  
<div dir="rtl">مطالبات مشتریان</div>  
**۴٫۲M**  
<div dir="rtl">مانده دریافتنی</div>  
<div dir="rtl">عملیات فوری</div>  
<div dir="rtl">فروش جدید</div>  
<div dir="rtl">ثبت کالای جدید</div>  
<div dir="rtl">اسکن بارکد</div>  
<div dir="rtl">ثبت مشتری</div>  
<div dir="rtl">هشدارهای مهم</div>  
* ۱۲ کالای کم‌موجود  
* ۳ فاکتور تسویه‌نشده  
* ۲ سفارش آماده تحویل  
<div dir="rtl">اعداد صرفاً نمونه نمایشی هستند، نه داده واقعی حسابچه.</div>  
**منوی فروشگاه پوشاک**  

| صفحه    | چه چیزی نمایش دهد؟                     |
| ------- | -------------------------------------- |
| خانه    | فروش امروز، سفارش‌ها، هشدارها           |
| فروش    | POS، فاکتور، مرجوعی، تخفیف             |
| کالاها  | پوشاک، رنگ، سایز، برند، مدل            |
| موجودی  | موجودی هر سایز و رنگ، انبار            |
| مشتریان | سابقه خرید، بدهی، وفاداری              |
| خرید    | تأمین‌کننده، سفارش خرید، دریافت کالا    |
| کارکنان | فروش هر فروشنده، شیفت، عملکرد          |
| مالی    | صندوق، دریافت، پرداخت، سود             |
| گزارش‌ها | پرفروش‌ترین کالا، سایز، رنگ و حاشیه سود |
  
**تفاوت‌های ضروری این صنف**  
<div dir="rtl">صفحه کالا نباید فقط نام و قیمت داشته باشد.</div>  
<div dir="rtl">باید ویژگی‌های واقعی پوشاک را نمایش دهد:</div>  
* مدل  
* برند  
* رنگ  
* سایز  
* جنس  
* فصل  
* کد کالا  
* بارکد هر تنوع  
* قیمت خرید  
* قیمت فروش  
* موجودی هر تنوع  
<div dir="rtl">مثلاً یک پیراهن با سه رنگ و پنج سایز باید ۱۵ ترکیب قابل مدیریت داشته باشد؛ موجودی هر ترکیب جداگانه باشد.</div>  
**گردش کار روزانه**  
* شروع روز صندوق اولیه، سفارش‌های باز و هشدارهای کمبود کالا بررسی شود.   
* ورود کالا فاکتور خرید ثبت و موجودی رنگ و سایز افزایش پیدا کند.   
* فروش اسکن بارکد، انتخاب تعداد، تخفیف مجاز و پرداخت.   
* مرجوعی ثبت علت، کنترل وضعیت کالا و برگشت موجودی در صورت قابل‌فروش بودن.   
* بستن روز تطبیق صندوق، پرداخت‌ها، فروش، مرجوعی و بدهی‌ها.   
**۴. نمونه دوم: سالن زیبایی و آرایشگاه**  
<div dir="rtl">اینجا دیگر نباید داشبورد فروشگاه پوشاک را نشان بدهیم.</div>  
<div dir="rtl">چون صاحب سالن بیشتر از هر چیزی نیاز دارد بداند:</div>  
* امروز چه کسانی نوبت دارند؟  
* کدام متخصص مشغول است؟  
* چه صندلی یا اتاقی آزاد است؟  
* چه خدماتی انجام شده؟  
* کدام مشتری بیعانه داده؟  
* هر متخصص چقدر درآمد ایجاد کرده؟  
* چه مواد مصرفی استفاده شده؟  
**منوی سالن زیبایی**  

| صفحه         | محتوای اصلی                        |
| ------------ | ---------------------------------- |
| خانه         | برنامه امروز و عملکرد سالن         |
| نوبت‌ها       | تقویم، رزرو، لغو و جابه‌جایی        |
| مشتریان      | سابقه خدمات، ترجیحات و پرونده مجاز |
| خدمات        | رنگ، کوتاهی، کراتین، ناخن و قیمت   |
| کارکنان      | متخصص، مهارت، کمیسیون و شیفت       |
| اتاق و صندلی | ظرفیت و تخصیص منابع                |
| مواد مصرفی   | رنگ مو، اکسیدان، مواد و موجودی     |
| مالی         | بیعانه، تسویه و کمیسیون            |
| گزارش‌ها      | درآمد هر خدمت و متخصص              |
  
**نمونه داشبورد**  
<div dir="rtl">برنامه امروز سالن</div>  
<div dir="rtl">نوبت‌های ثبت‌شده</div>  
<div dir="rtl">۱۸ نوبت</div>  
<div dir="rtl">تکمیل‌شده</div>  
<div dir="rtl">۷ نوبت</div>  
<div dir="rtl">در انتظار</div>  
<div dir="rtl">۵ نوبت</div>  
<div dir="rtl">بیعانه‌های دریافت‌شده</div>  
<div dir="rtl">۶ نوبت</div>  
<div dir="rtl">برنامه متخصصان</div>  
<div dir="rtl">متخصص رنگ مو</div>  
<div dir="rtl">۱۰:۰۰ تا ۱۱:۳۰</div>  
<div dir="rtl">در حال خدمت</div>  
<div dir="rtl">متخصص ناخن</div>  
<div dir="rtl">۱۱:۰۰ تا ۱۲:۰۰</div>  
<div dir="rtl">رزرو شده</div>  
<div dir="rtl">آرایشگر</div>  
<div dir="rtl">۱۲:۳۰ تا ۱۳:۰۰</div>  
<div dir="rtl">آزاد</div>  
**گردش کار**  
<div dir="rtl">رزرو ← انتخاب خدمت ← انتخاب متخصص ← کنترل ظرفیت ← دریافت بیعانه ← مراجعه مشتری ← ثبت خدمت ← ثبت مواد مصرفی ← محاسبه کمیسیون ← تسویه.</div>  
<div dir="rtl">اینجا یک نکته حسابداری مهم وجود دارد: بیعانه در زمان دریافت لزوماً درآمد تحقق‌یافته نیست؛ باید به‌عنوان پیش‌دریافت یا بدهی مربوط ثبت شود و هنگام انجام خدمت طبق سیاست حسابداری مناسب تسویه شود.</div>  
<div dir="rtl">همچنین کمیسیون متخصص باید از روی قواعد مشخص محاسبه شود، نه اینکه صرفاً درصدی از کل دریافتی سالن فرض شود.</div>  
**۵. نمونه سوم: آموزشگاه زبان**  
<div dir="rtl">در آموزشگاه زبان، موجودی انبار معمولاً موضوع اصلی نیست.</div>  
<div dir="rtl">هسته اصلی عبارت است از:</div>  
* زبان‌آموز  
* دوره  
* سطح  
* کلاس  
* مدرس  
* جلسه  
* حضور و غیاب  
* اعتبار جلسات  
* شهریه  
* پیشرفت آموزشی  
**منوی آموزشگاه**  

| صفحه           | محتوای اصلی                    |
| -------------- | ------------------------------ |
| خانه           | کلاس‌های امروز و وضعیت آموزشگاه |
| زبان‌آموزان     | پرونده، سطح و سابقه            |
| دوره‌ها         | زبان، سطح، شهریه و مدت         |
| کلاس‌ها         | برنامه، ظرفیت و مدرس           |
| حضور و غیاب    | حضور، غیبت و تأخیر             |
| بسته‌های آموزشی | جلسات خریداری‌شده و مانده       |
| مدرسان         | ساعات تدریس و عملکرد           |
| پرداخت‌ها       | شهریه، بدهی و اقساط            |
| گزارش‌ها        | ظرفیت کلاس، تمدید و پیشرفت     |
  
**گردش کار**  
<div dir="rtl">ثبت‌نام ← تعیین سطح ← انتخاب دوره ← تشکیل کلاس ← تخصیص مدرس ← پرداخت شهریه ← حضور و غیاب ← کسر اعتبار جلسه ← ارزیابی پیشرفت ← تمدید یا پایان دوره.</div>  
<div dir="rtl">نکته مهم: آموزشگاه باید بین این سه مفهوم تفاوت بگذارد:</div>  
* پول دریافت‌شده بابت بسته آموزشی.  
* جلسات باقی‌مانده زبان‌آموز.  
* درآمد تحقق‌یافته طبق سیاست شناسایی درآمد.  
<div dir="rtl">این‌ها نباید در یک KPI ادغام شوند.</div>  
**۶. نمونه چهارم: تعمیرگاه موبایل**  
<div dir="rtl">اینجا مهم‌ترین صفحه، فاکتور فروش نیست؛ پرونده تعمیر (Service Ticket) است.</div>  
**منوی تعمیرگاه**  

| صفحه            | محتوای اصلی                        |
| --------------- | ---------------------------------- |
| خانه            | دستگاه‌های در انتظار، تعمیرات امروز |
| پذیرش           | ثبت دستگاه و مشکل                  |
| پرونده تعمیر    | تشخیص، قطعه، اجرت و وضعیت          |
| مشتریان         | سابقه تعمیرات و گارانتی            |
| قطعات           | موجودی قطعات یدکی                  |
| تکنسین‌ها        | کارهای تخصیص‌یافته                  |
| سفارش قطعه      | خرید و تأمین                       |
| دریافت و پرداخت | پیش‌پرداخت و تسویه                  |
| گزارش‌ها         | زمان تعمیر، سود و برگشتی           |
  
**گردش کار**  
<div dir="rtl">پذیرش دستگاه ← ثبت IMEI یا شناسه ← ثبت وضعیت ظاهری ← ثبت ایراد ← تشخیص ← اعلام هزینه ← تأیید مشتری ← تخصیص تکنسین ← مصرف قطعه ← انجام تعمیر ← کنترل کیفیت ← تحویل ← گارانتی تعمیر.</div>  
<div dir="rtl">برای جلوگیری از اختلاف باید ثبت وضعیت اولیه دستگاه، لوازم همراه، رمز یا اطلاعات حساس (در صورت نیاز و با کنترل امنیتی مناسب)، رضایت مشتری و تأیید هزینه کاملاً مشخص باشد.</div>  
**۷. تفاوت واقعی صفحات بین صنف‌ها**  
<div dir="rtl">این جدول نشان می‌دهد که چگونه یک قابلیت مشترک باید متناسب با صنف تغییر کند:</div>  

| قابلیت | پوشاک | سالن زیبایی | آموزشگاه | تعمیرگاه |
| ------- | ----------- | -------------- | --------------- | ----------------- |
| موجودی | سایز و رنگ | مواد مصرفی | معمولاً غیرمحوری | قطعات یدکی |
| مشتری | سابقه خرید | سابقه خدمات | زبان‌آموز | مالک دستگاه |
| سفارش | فروش کالا | نوبت خدمت | ثبت‌نام دوره | پرونده تعمیر |
| کارکنان | فروشنده | متخصص | مدرس | تکنسین |
| ظرفیت | موجودی کالا | صندلی و اتاق | کلاس و مدرس | میز تعمیر |
| پرداخت | فاکتور | بیعانه و تسویه | شهریه و بسته | پیش‌پرداخت و تسویه |
| KPI | گردش کالا | بهره‌وری متخصص | حضور و اعتبار | زمان تعمیر |
| گزارش | سود کالا | درآمد خدمات | ظرفیت و تمدید | سود تعمیر |
  
این دقیقاً همان چیزی است که باید در معماری حسابچه پیاده شود: یک هسته مشترک با تجربه‌های متفاوت و واقعی.  
**۸. صفحه‌ها فقط نباید متفاوت باشند؛ باید گردش کار هم متفاوت باشد**  
<div dir="rtl">من برای هر صنف پنج نوع گردش کار تعریف می‌کنم:</div>  
* گردش کار اصلی: مهم‌ترین فعالیت درآمدزا.  
* گردش کار مالی: دریافت، پرداخت، بدهی، تسویه و ثبت حسابداری.  
* گردش کار منابع: موجودی، مواد، تجهیزات، ظرفیت یا زمان.  
* گردش کار نیروی انسانی: تخصیص کار، حضور، دستمزد و کمیسیون.  
* گردش کار مدیریتی: گزارش، کنترل، هشدار و تصمیم‌گیری.  
<div dir="rtl">مثلاً در رستوران، گردش کار اصلی باید از سفارش مشتری به آشپزخانه و تحویل غذا متصل باشد؛ نه اینکه کارمند ابتدا فاکتور بسازد و بعد به‌صورت دستی به آشپزخانه اطلاع دهد.</div>  
<div dir="rtl">در یک کارگاه تولیدی، سفارش باید به برنامه تولید، مصرف مواد، تولید محصول و بهای تمام‌شده متصل باشد.</div>  
<div dir="rtl">در یک شرکت خدماتی، قرارداد و پروژه باید به وظایف، ساعات کاری، هزینه و صورت‌حساب وصل شوند.</div>  
**۹. داشبورد هر صنف باید بر اساس تصمیم‌های روزانه طراحی شود**  
<div dir="rtl">من داشبورد را بر اساس این سؤال طراحی می‌کنم:</div>  
<div dir="rtl">صاحب این کسب‌وکار وقتی صبح وارد حسابچه می‌شود، برای اداره بهتر امروز به چه پنج اطلاعاتی نیاز دارد؟</div>  

| صنف | پنج اولویت اصلی داشبورد |
| ----------- | -------------------------------------------------------------------- |
| پوشاک | فروش، موجودی سایزها، کالاهای کم‌موجود، سفارش‌ها، مطالبات |
| سالن زیبایی | نوبت‌ها، ظرفیت متخصصان، خدمات انجام‌شده، مواد مصرفی، تسویه |
| آموزشگاه | کلاس‌های امروز، حضور و غیاب، جلسات باقی‌مانده، ظرفیت، شهریه |
| تعمیرگاه | دستگاه‌های پذیرش‌شده، تعمیرات معوق، قطعات، تکنسین‌ها، تحویل‌ها |
| رستوران | سفارش‌های فعال، وضعیت آشپزخانه، میزها، موجودی مواد، فروش |
| طلافروشی | موجودی بر اساس وزن و عیار، معاملات، بدهی، ارزش دارایی، اختلاف موجودی |
| عمده‌فروشی | سفارش‌های عمده، موجودی انبار، وصول مطالبات، سفارش تأمین، حاشیه سود |
  
البته KPIهای مالی باید با داده واقعی محاسبه شوند. برای مثال فروش با درآمد تحقق‌یافته یا سود خالص یکسان نیست.  
**۱۰. چه چیزهایی باید بر اساس اندازه کسب‌وکار تغییر کند؟**  
<div dir="rtl">این موضوع به‌اندازه خود صنف اهمیت دارد.</div>  
<div dir="rtl">یک سالن زیبایی با یک متخصص نباید همان تجربه سالن زیبایی با ۱۵ متخصص را داشته باشد.</div>  

| اندازه کسب‌وکار | تجربه پیشنهادی |
| ------------------- | ------------------------------------------------------- |
| تک‌نفره | عملیات سریع، حداقل تنظیمات، بدون داشبورد پیچیده کارکنان |
| کوچک، ۲ تا ۵ نفر | تقسیم کار، نوبت، موجودی و گزارش ساده |
| متوسط، ۶ تا ۲۰ نفر | شیفت، کمیسیون، نقش‌ها، عملکرد و کنترل مدیر |
| بزرگ، بیش از ۲۰ نفر | شعبه، سطح دسترسی، گزارش تجمیعی، گردش تأیید و حسابرسی |
  
این اعداد باید قابل تنظیم باشند، نه محدودیت سخت‌افزاری یا قراردادی.  
**نمونه تفاوت در سالن زیبایی**  
* سالن تک‌نفره: متخصص و صاحب کسب‌وکار یک نفر هستند؛ داشبورد باید مستقیم به نوبت و دریافت پول برسد.  
* سالن پنج‌نفره: برنامه متخصصان، ظرفیت صندلی، کمیسیون و تقسیم مشتری اهمیت پیدا می‌کند.  
* سالن پانزده‌نفره: مدیر پذیرش، مدیر سالن، متخصصان، صندوق‌دار، شیفت‌ها، تأیید تخفیف و گزارش عملکرد لازم می‌شود.  
**۱۱. تجربه هر صفحه در موبایل و ویندوز**  
<div dir="rtl">من پیشنهاد می‌کنم منطق و داده در همه پلتفرم‌ها مشترک بماند، اما چیدمان با دستگاه سازگار شود.</div>  
<div dir="rtl">موبایل و Android</div>  
* عملیات سریع  
* دکمه‌های بزرگ  
* جست‌وجوی فوری  
* فرم‌های کوتاه  
* دسترسی آفلاین  
* نوار پایین برای مسیرهای پرتکرار  
Windows و Desktop  
* جدول‌های گسترده  
* چند پنل هم‌زمان  
* میانبرهای صفحه‌کلید  
* گزارش‌های تفصیلی  
* مدیریت چند عملیات  
* کنترل دقیق‌تر  
<div dir="rtl">این تفاوت نباید به دو سیستم مجزا منجر شود.</div>  
<div dir="rtl">همان قرارداد صفحه، همان مجوز، همان داده و همان منطق دامنه؛ فقط presentation متناسب با دستگاه تغییر کند.</div>  
**۱۲. آفلاین باید بخشی از طراحی گردش کار باشد**  
<div dir="rtl">نباید پس از طراحی صفحات، تازه به این فکر کنیم که کدام‌یک آفلاین می‌شود.</div>  
<div dir="rtl">از ابتدا باید مشخص کنیم:</div>  

| عملیات            | رفتار آفلاین مورد انتظار                     |
| ----------------- | -------------------------------------------- |
| ثبت فروش          | ثبت محلی و قرارگیری در outbox                |
| ثبت مشتری         | ثبت محلی                                     |
| مشاهده موجودی     | آخرین داده همگام‌شده با زمان آخرین به‌روزرسانی |
| رزرو نوبت         | ثبت محلی با وضعیت نیازمند تأیید همگام‌سازی    |
| حضور و غیاب       | ثبت محلی با شناسه دستگاه                     |
| ثبت تعمیر         | ذخیره محلی پرونده                            |
| پرداخت نقدی       | ثبت محلی با کنترل تکرار                      |
| پرداخت آنلاین     | نیازمند سرویس آنلاین و تأیید سرور            |
| گزارش‌های تجمیعی   | نمایش داده‌های موجود همراه با برچسب تازگی     |
| تغییرات حساس مالی | سیاست تعارض و تأیید مشخص                     |
  
به‌خصوص برای رزرو، نباید دو دستگاه آفلاین بتوانند یک ظرفیت یا زمان واحد را بدون هشدار به دو مشتری اختصاص دهند.  
**۱۳. کنترل نقش‌ها در هر صنف**  
<div dir="rtl">همه نباید همه چیز را ببینند.</div>  
<div dir="rtl">برای هر صنف باید نقش‌های واقعی تعریف شوند؛ اما دسترسی از سیستم Permission موجود حسابچه گرفته شود.</div>  
<div dir="rtl">نمونه سالن زیبایی:</div>  

| عملیات | مالک | مدیر | پذیرش | متخصص | حسابدار |
| --------------- | ---- | ------ | ------------ | ------------- | ----------------- |
| داشبورد مدیریتی | کامل | محدود | روزانه | شخصی | مالی |
| رزرو | کامل | کامل | کامل | مشاهده برنامه | خیر |
| پرونده مشتری | کامل | کامل | اطلاعات لازم | اطلاعات لازم | اطلاعات مالی مجاز |
| ثبت خدمت | کامل | کامل | محدود | خدمات خودش | خیر |
| کمیسیون | کامل | مشاهده | خیر | فقط سهم خودش | کامل |
| گزارش مالی | کامل | محدود | خیر | خیر | کامل |
| تنظیمات | کامل | مجاز | خیر | خیر | مالی محدود |
  
این فقط نمونه است. نقش نهایی باید از مدل امنیتی واقعی و حداقل دسترسی لازم پیروی کند.  
**۱۴. برای هر صنف چه چیزی باید در پایان طراحی شده باشد؟**  
<div dir="rtl">من برای هر یک از ۶۷ صنف، این خروجی‌ها را ضروری می‌دانم:</div>  
* هویت و مدل کسب‌وکار.  
* گردش کار کامل روزانه.  
* منوی اختصاصی.  
* ترتیب و اولویت صفحات.  
* طراحی محتوای هر صفحه.  
* فیلدهای اختصاصی.  
* عملیات و دکمه‌ها.  
* فرم‌های ثبت و ویرایش.  
* وضعیت‌های هر عملیات.  
* گردش مالی و حسابداری.  
* موجودی و منابع.  
* مشتریان و CRM.  
* کارکنان و نقش‌ها.  
* KPIهای اختصاصی.  
* گزارش‌های اختصاصی.  
* هشدارها و اعلان‌ها.  
* تجربه موبایل.  
* تجربه ویندوز.  
* رفتار آفلاین و همگام‌سازی.  
* معیارهای پذیرش و تست.  
<div dir="rtl">این خروجی‌ها باید در نهایت به یک ماتریس قابل ردیابی متصل شوند؛ یعنی هر صفحه و عملیات به قابلیت، مجوز، منبع داده و تست مربوط خودش وصل باشد.</div>  
**۱۵. مهم‌ترین تصمیم: اولویت پیاده‌سازی ۶۷ صنف**  
<div dir="rtl">من پیشنهاد نمی‌کنم هر ۶۷ صنف را هم‌زمان طراحی و پیاده‌سازی کنیم.</div>  
<div dir="rtl">ابتدا باید تمام ۶۷ صنف از نظر مدل عملیاتی شناسایی شوند؛ سپس نماینده‌های هر خانواده را کامل کنیم.</div>  
<div dir="rtl">ترتیب پیشنهادی:</div>  
* فاز اول: فروش و موجودی فروشگاه پوشاک، سوپرمارکت، موبایل‌فروشی و عمده‌فروشی. هدف: اثبات فروش، تنوع کالا، انبار، سفارش و تسویه.   
* فاز دوم: خدمات و نوبت‌دهی آرایشگاه، سالن زیبایی، خدمات شخصی و کسب‌وکارهای وقت‌محور. هدف: اثبات نوبت، ظرفیت، بیعانه، خدمت، مواد مصرفی و کمیسیون.   
* فاز سوم: آموزش آموزشگاه زبان و مدرس خصوصی. هدف: ثبت‌نام، بسته جلسات، حضور و غیاب، مدرس و شهریه.   
* فاز چهارم: تعمیر و خدمات فنی تعمیرگاه موبایل، خودرو و لوازم خانگی. هدف: پرونده، تشخیص، قطعه، اجرت، تکنسین و تحویل.   
* فاز پنجم: غذا، تولید و عملیات پیچیده رستوران، کافه، کارگاه تولیدی و کسب‌وکارهای پروژه‌ای. هدف: سفارش، ظرفیت، مواد اولیه، تولید، هزینه و کنترل عملیات.   
* فاز ششم: تکمیل ۶۷ صنف صنف‌های باقی‌مانده بر اساس DNA و قابلیت‌های مورد نیاز پوشش داده شوند.   
<div dir="rtl">این ترتیب پیشنهادی است؛ اولویت نهایی باید بر اساس وضعیت واقعی کد، ریسک مالی و قابلیت‌های مشترک تعیین شود.</div>  
**۱۶. معیار قبولی هر صنف**  
<div dir="rtl">یک صنف فقط زمانی آماده استفاده تجاری است که:</div>  
* کاربر بتواند کسب‌وکار را راه‌اندازی کند.  
* داشبورد اطلاعات مرتبط نشان دهد.  
* منوهای نامربوط مزاحم کاربر نباشند.  
* عملیات اصلی از ابتدا تا انتها قابل اجرا باشد.  
* دریافت و پرداخت درست ثبت شود.  
* آثار حسابداری درست باشند.  
* موجودی و منابع درست مدیریت شوند.  
* کارکنان وظایف و دسترسی صحیح داشته باشند.  
* گزارش‌ها از منابع معتبر تغذیه شوند.  
* تجربه موبایل و دسکتاپ درست باشد.  
* حالت آفلاین محدودیت‌ها و تعارض‌هایش را شفاف نشان دهد.  
* هیچ قابلیت نمایشی بدون پیاده‌سازی واقعی به کاربر فروخته نشود.  
**جمع‌بندی پیشنهادی من**  
<div dir="rtl">من حسابچه را به این شکل می‌سازم:</div>  
<div dir="rtl">۶۷ صنف → خانواده‌های عملیاتی → Archetype → Operational DNA → قابلیت‌ها → تجربه اختصاصی → صفحات → گردش کار → گزارش و KPI.</div>  
<div dir="rtl">اما مهم‌ترین اصل این است که طراحی باید از فعالیت واقعی کسب‌وکار شروع شود، نه از منوهای نرم‌افزار.</div>  
<div dir="rtl">برای مثال:</div>  
* فروشگاه‌دار با «فروش و موجودی» زندگی می‌کند.  
* آرایشگر با «نوبت، متخصص و خدمت».  
* مدرس با «کلاس، جلسه و زبان‌آموز».  
* تعمیرکار با «پرونده، قطعه و تحویل».  
* رستوران‌دار با «سفارش، آشپزخانه و میز».  
* تولیدکننده با «مواد، تولید و بهای تمام‌شده».  
<div dir="rtl">وقتی حسابچه این تفاوت‌ها را درست مدیریت کند، دیگر یک نرم‌افزار حسابداری با چند منوی اضافی نیست؛ واقعاً به سیستم‌عامل عملیاتی کسب‌وکار تبدیل می‌شود.</div>  
**۱۷. نظر نهایی من: ترتیب درست ساخت**  
<div dir="rtl">من سه مرحله را از هم جدا می‌کنم:</div>  

| مرحله     | خروجی                                 |
| --------- | ------------------------------------- |
| V3.0      | تکمیل و تثبیت هسته مشترک حسابچه       |
| مرحله دوم | طراحی کامل تجربه و گردش کار هر ۶۷ صنف |
| مرحله سوم | پیاده‌سازی و تست مرحله‌ای تجربه‌ها در کد |
  
یک نکته مهم دیگر: قبل از طراحی ۶۷ صنف، باید فهرست واقعی آن‌ها را از رجیستری ریپو استخراج کنیم. در این پاسخ عمداً ادعا نکردم که این ۶۷ صنف دقیقاً چه نام‌هایی دارند؛ چون هنوز رجیستری فعلی را در این مرحله بررسی نکرده‌ایم.  
<div dir="rtl">پیشنهاد من این است که در مرحله دوم، ابتدا هر ۶۷ صنف روی کاغذ و در ماتریس عملیاتی پوشش داده شوند؛ سپس چهار صنف نماینده، یعنی پوشاک، سالن زیبایی، آموزشگاه زبان و تعمیرگاه، به‌صورت کامل در کد پیاده‌سازی و اعتبارسنجی شوند. بعد از اثبات معماری، باقی صنف‌ها با قابلیت‌های مشترک تکمیل شوند.</div>  
و در اخر میخوام   
<div dir="rtl"></div>  
کد رو برای ویندوز و موبایل بررسی بکن قرار بود فرایند تولید فاکتور و سنگینی بک اند کامل ویندوز و موبایل در این نسخه ها سخت افزار موبایل و ویندوز به دوش بکشند بار رو نه منابع بک اند و فقط در نسخه وب فرایند هارو بک اند هندل بکنه برای این مورد اول کد را ببین و سپس ببینیم چی پیشنهاد میدی تحت عنوان v68 یک پرامپت هم برای این مورد اماده بکنی  
<div dir="rtl">بررسی اولیه‌ی سورس نشان می‌دهد ایده‌ای که قبلاً برای حسابچه تعیین کرده بودیم، در معماری فعلی تا حد قابل‌توجهی پیاده‌سازی شده است؛ اما هنوز یک تفاوت مهم بین «داشتن موتور محلی» و «اینکه تمام عملیات واقعاً روی دستگاه انجام شوند» وجود دارد.</div>  
<div dir="rtl">در تصمیم معماری قبلی، قرار بود:</div>  
* ویندوز و موبایل: محاسبات و عملیات کسب‌وکار در موتور محلی مشترک اجرا شوند؛ اطلاعات در SQLite همان دستگاه ذخیره شود و بعداً از طریق Outbox همگام‌سازی شود.  
* وب: درخواست‌ها به بک‌اند بروند و بک‌اند همان قواعد کسب‌وکار را اجرا کند.  
* قواعد مالی و تجاری: فقط یک پیاده‌سازی مشترک داشته باشند؛ نه یک موتور مستقل برای موبایل، یک موتور دیگر برای ویندوز و یک نسخه سوم برای بک‌اند.  
<div dir="rtl">این تفکیک مهم است: هدف حذف بک‌اند نیست؛ هدف این است که بک‌اند برای هر فاکتورِ ویندوز و موبایل، مجبور به اجرای کل زنجیره‌ی محاسبات و عملیات نباشد. همچنان باید مرجع اعتبارسنجی نهایی، مجوزها، همگام‌سازی و یکپارچگی داده‌های ابری باقی بماند.</div>  
**۱. وضعیت واقعی کد در نسخه فعلی**  
<div dir="rtl">در شاخه main و آخرین نسخه‌ای که بررسی کردم، این اجزا واقعاً وجود دارند:</div>  

| بخش | وضعیت سورس |
| --------------------------------------- | -------------------------------------- |
| موتور محلی کسب‌وکار | پیاده‌سازی شده در packages/local-engine |
| دیتابیس محلی ویندوز | SQLite با better-sqlite3 |
| دیتابیس محلی موبایل | SQLite با expo-sqlite |
| استفاده ویندوز از موتور محلی | متصل و فعال |
| استفاده موبایل از همان موتور | متصل و فعال |
| محاسبات فاکتور در موتور محلی | پیاده‌سازی شده |
| ثبت موجودی و گردش کالا | در مسیر محلی فاکتور پیاده‌سازی شده |
| مصرف لایه‌های بهای تمام‌شده FIFO/AVCO | در موتور محلی پیاده‌سازی شده |
| ثبت سند حسابداری | در موتور محلی پیاده‌سازی شده |
| Outbox و ارسال تغییرات به سرور | پیاده‌سازی شده |
| همگام‌سازی کامل موبایل از سرور به دستگاه | هنوز ناقص |
  
**معماری واقعی ویندوز و موبایل**  
Windows — Electron  
Local Engine in-process  
local-api.ts → createLocalEngine() → SQLite  
Android — Expo  
<div dir="rtl">همان Local Engine</div>  
host/local-api.ts → createLocalEngine() → expo-sqlite  
<div dir="rtl">همگام‌سازی از طریق Outbox</div>  
Backend — Fastify / PostgreSQL  
<div dir="rtl">مرجع نهایی ثبت ابری، کنترل مجوز، بررسی تعارض، اعتبارسنجی و همگام‌سازی</div>  
<div dir="rtl">این قسمت معماری درست طراحی شده است: هر دو دستگاه از یک موتور و یک مجموعه قواعد مشترک استفاده می‌کنند، اما درایور دیتابیس متفاوت دارند.</div>  
<div dir="rtl">منابع مستقیم:</div>  
* ++[Local Engine](https://github.com/hamednourzaei/hisabche/tree/main/packages/local-engine?utm_source=chatgpt.com)++⁠  
* ++[Windows Local API](https://github.com/hamednourzaei/hisabche/blob/main/apps/desktop/electron/main/services/local-api.ts?utm_source=chatgpt.com)++⁠  
* ++[Mobile Local API](https://github.com/hamednourzaei/hisabche/blob/main/apps/mobile/src/host/local-api.ts?utm_source=chatgpt.com)++⁠  
* ++[Local SQLite Schema](https://github.com/hamednourzaei/hisabche/blob/main/packages/app-bridge/src/local-schema.ts?utm_source=chatgpt.com)++⁠  
**۲. مشکل اصلی: ویندوز و موبایل همیشه از موتور محلی استفاده نمی‌کنند**  
<div dir="rtl">شکاف معماری مهم</div>  
<div dir="rtl">مهم‌ترین چیزی که در کد پیدا کردم در این فایل است:</div>  
```
packages/api/src/hooks/invoices.ts

```
<div dir="rtl">تابع submitInvoice() در حال حاضر این رفتار را دارد:</div>  
* اگر دستگاه آفلاین باشد، فاکتور را به موتور محلی می‌دهد.  
* اگر دستگاه آنلاین باشد، ابتدا مستقیماً POST /invoices را به بک‌اند می‌فرستد.  
* اگر درخواست آنلاین با خطای شبکه مواجه شود، به موتور محلی رجوع می‌کند.  
* در حالت وب، چون Local Transport ثبت نشده، مسیر مستقیم بک‌اند حفظ می‌شود.  
<div dir="rtl">بنابراین در نسخه‌های ویندوز و موبایل، حتی وقتی موتور محلی آماده است و دستگاه سخت‌افزار کافی دارد، ثبت فاکتور در حالت آنلاین همچنان از مسیر بک‌اند انجام می‌شود.</div>  
<div dir="rtl">این دقیقاً با هدفی که برای نسخه‌های ویندوز و موبایل تعیین کرده بودیم، یکسان نیست.</div>  
<div dir="rtl">در واقع موتور محلی فعلی بیشتر نقش مسیر آفلاین و مسیر جایگزین هنگام قطع شبکه را دارد؛ نه موتور اصلی عملیات دستگاه در تمام شرایط.</div>  
<div dir="rtl">منبع: ++[Invoice Hooks](https://github.com/hamednourzaei/hisabche/blob/main/packages/api/src/hooks/invoices.ts?utm_source=chatgpt.com)++⁠</div>  
**۳. آیا خود فرآیند تولید فاکتور در موتور محلی کامل است؟**  
<div dir="rtl">در فایل packages/local-engine/src/routes/invoices.ts مسیر ایجاد فاکتور را بررسی کردم.</div>  
<div dir="rtl">موتور محلی فقط یک ردیف فاکتور ذخیره نمی‌کند. این مراحل را اجرا می‌کند:</div>  

| عملیات                           | اجرای محلی |
| -------------------------------- | ---------- |
| اعتبارسنجی اطلاعات فاکتور        | دارد       |
| محاسبه مبلغ هر ردیف              | دارد       |
| محاسبه تخفیف و جمع فاکتور        | دارد       |
| کنترل ارز و نرخ تبدیل            | دارد       |
| تولید شماره موقت دستگاه          | دارد       |
| ثبت سربرگ فاکتور                 | دارد       |
| ثبت ردیف‌های فاکتور               | دارد       |
| کاهش موجودی کالا                 | دارد       |
| محاسبه مقدار پایه با واحد کالا   | دارد       |
| مصرف لایه‌های FIFO/AVCO           | دارد       |
| ثبت گردش انبار                   | دارد       |
| ثبت سند حسابداری                 | دارد       |
| مدیریت برخی پیش‌پرداخت‌ها و بسته‌ها | دارد       |
| ثبت Outbox در همان تراکنش        | دارد       |
  
نکته مثبت مهم این است که Outbox در همان تراکنش SQLite فاکتور ثبت می‌شود. در نتیجه اگر ثبت Outbox شکست بخورد، تراکنش فاکتور هم نباید نیمه‌کاره باقی بماند.  
<div dir="rtl">همچنین برای فاکتور آفلاین شماره موقت از الگوی OFF-<device>-<seq> استفاده می‌شود و شماره رسمی را سرور پس از پذیرش و ثبت ابری تعیین می‌کند.</div>  
<div dir="rtl">منبع: ++[Local Invoice Engine](https://github.com/hamednourzaei/hisabche/blob/main/packages/local-engine/src/routes/invoices.ts?utm_source=chatgpt.com)++⁠</div>  
<div dir="rtl">پس از نظر اجرای محلی، بخش قابل‌توجهی از هسته موردنظر را داریم. مسئله اصلی این است که مسیر آنلاین هنوز آن را به‌عنوان مسیر پیش‌فرض انتخاب نمی‌کند.</div>  
**۴. مشکل دوم: همگام‌سازی موبایل**  
<div dir="rtl">در مستند documents/OFFLINE_SYNC.md و کد apps/mobile/src/features/offline/sync-runner.ts یک تفاوت مهم دیده می‌شود:</div>  
* ویندوز از Pull و Push استفاده می‌کند.  
* موبایل در Sync Runner فعلی Push دارد، اما Pull کامل از سرور ندارد.  
<div dir="rtl">این یعنی اگر فاکتوری از وب ثبت شود، موبایل لزوماً تغییرات جدید را از سرور دریافت نمی‌کند. این محدودیت با هدف اجرای محلی دائمی سازگار نیست؛ چون موتور محلی برای اجرای صحیح فاکتور به اطلاعات به‌روز مشتری، کالا، موجودی، نرخ ارز، انبار و تنظیمات حسابداری نیاز دارد.</div>  
<div dir="rtl">منبع: ++[Mobile Sync Runner](https://github.com/hamednourzaei/hisabche/blob/main/apps/mobile/src/features/offline/sync-runner.ts?utm_source=chatgpt.com)++⁠</div>  
**۵. مشکل سوم: مسیر مشترک است، اما orchestration هنوز کاملاً یکی نیست**  
<div dir="rtl">باید یک تفاوت معماری را هم روشن کنیم.</div>  
<div dir="rtl">در حال حاضر:</div>  
* قواعد و محاسبات مشترک در packages/validation قرار دارند.  
* موتور دستگاه در packages/local-engine عملیات SQLite را اجرا می‌کند.  
* بک‌اند در backend/src/services/invoice.service.ts عملیات PostgreSQL را اجرا می‌کند.  
<div dir="rtl">این لزوماً اشتباه نیست. هر محیط باید تراکنش و ذخیره‌سازی مخصوص خودش را داشته باشد.</div>  
<div dir="rtl">اما نباید منطق تجاری فاکتور، محاسبه مالیات، تخصیص پرداخت، موجودی و بهای تمام‌شده به‌صورت مستقل و متفاوت در دو محیط رشد کند.</div>  
<div dir="rtl">گاردهایی مانند one-financial-engine.test.ts و تست‌های parity موجود در packages/local-engine و بک‌اند، قدم‌های درستی هستند. با این حال، تست parity به‌تنهایی اثبات نمی‌کند که همه مسیرهای کسب‌وکار در دو محیط کاملاً یکسان‌اند.</div>  
**۶. پیشنهاد من برای معماری نهایی**  
<div dir="rtl">من پیشنهاد می‌کنم معماری را به شکل زیر تثبیت کنیم؛ نه اینکه موتور جدید بسازیم یا پروژه را دوباره معماری کنیم.</div>  
Windows و Android — مسیر اصلی عملیات  
Shared UI / Hooks  
<div dir="rtl">یک رابط کاربری مشترک</div>  
Local Engine  
<div dir="rtl">محاسبات، اعتبارسنجی محلی، فاکتور، موجودی، پرداخت، حسابداری و گزارش</div>  
SQLite Transaction  
<div dir="rtl">ثبت اتمیک اطلاعات و Outbox</div>  
Sync Worker  
<div dir="rtl">ارسال تغییرات و دریافت تغییرات سایر دستگاه‌ها</div>  
Web — مسیر اصلی عملیات  
Shared UI / Hooks  
Fastify Backend  
<div dir="rtl">اجرای همان قواعد مشترک و عملیات دیتابیس</div>  
PostgreSQL  
**تغییراتی که پیشنهاد می‌کنم**  
<div dir="rtl">۱. تغییر مسیر ثبت فاکتور در دستگاه‌ها</div>  
<div dir="rtl">در submitInvoice() باید ابتدا مشخص شود آیا Host محلی ثبت شده و موتور محلی آماده است یا خیر.</div>  
* ویندوز و موبایل: اول Local Engine، حتی در حالت آنلاین.  
* وب: مستقیماً Backend.  
* دستگاه بدون دیتابیس محلی آماده: نباید موفقیت محلی جعلی اعلام کند؛ باید مسیر مجاز و امن جایگزین داشته باشد یا خطای مشخص بدهد.  
<div dir="rtl">۲. ثبت محلی و همگام‌سازی غیرهم‌زمان</div>  
<div dir="rtl">در نسخه‌های دستگاهی، عملیات ثبت فاکتور باید در SQLite تمام شود و کاربر منتظر اجرای تمام محاسبات روی سرور نماند.</div>  
<div dir="rtl">بعد از ثبت:</div>  
* فاکتور فوراً در دستگاه قابل مشاهده باشد.  
* موجودی محلی تغییر کند.  
* گزارش محلی به‌روز شود.  
* سند حسابداری محلی ثبت شود.  
* Outbox برای ارسال به سرور آماده باشد.  
۳. Backend فقط نقش ضروری خود را حفظ کند  
<div dir="rtl">سرور باید همچنان:</div>  
* مجوز و هویت کاربر را کنترل کند.  
* تغییرات و نسخه رکوردها را بررسی کند.  
* محدودیت‌های بین دستگاهی و موجودی مشترک را کنترل کند.  
* عملیات را idempotent ثبت کند.  
* تعارض مالی را به شکل امن مدیریت کند.  
* شماره رسمی فاکتور را تخصیص دهد.  
* تغییرات ابری را برای دستگاه‌ها قابل دریافت کند.  
<div dir="rtl">نکته: انتقال بار پردازشی به دستگاه نباید به معنی اعتماد کور به محاسبات دستگاه باشد. سرور باید داده و قواعد را دوباره بررسی کند، ولی لازم نیست برای هر فاکتورِ دستگاهی تمام مسیر محاسبات را دوباره به‌عنوان مسیر اصلی کاربر اجرا کند.</div>  
<div dir="rtl">۴. تکمیل Pull موبایل</div>  
<div dir="rtl">موبایل باید همان پروتکل Sync ویندوز را داشته باشد:</div>  
* cursor  
* snapshot  
* pull صفحه‌ای  
* commit محلی قبل از جلو بردن cursor  
* version checking  
* عدم پاک‌کردن اطلاعات دارای تغییرات ارسال‌نشده  
<div dir="rtl">۵. خواندن اطلاعات در دستگاه‌ها هم باید Local-first شود</div>  
<div dir="rtl">این فقط موضوع ثبت فاکتور نیست. وقتی قرار است دستگاه مسئول اجرای عملیات باشد، خواندن کالاها، مشتریان، موجودی، نرخ‌ها و اطلاعات مالی هم باید از دیتابیس محلی انجام شود؛ نه اینکه فقط هنگام آفلاین بودن به SQLite مراجعه کنیم.</div>  
**۷. اولویت اجرای اصلاحات**  

| اولویت | کار                                                 | اهمیت      |
| ------ | --------------------------------------------------- | ---------- |
| P0     | تغییر مسیر ثبت فاکتور آنلاین دستگاه به Local Engine | بسیار بالا |
| P0     | تکمیل Pull و Hydration موبایل                       | بسیار بالا |
| P1     | Local-first کردن خواندن اطلاعات عملیاتی دستگاه      | بسیار بالا |
| P1     | همسان‌سازی ثبت پرداخت و تخصیص آن با فاکتور محلی      | بسیار بالا |
| P1     | بررسی تعارض موجودی و اعتبار مشتری در Sync           | بسیار بالا |
| P1     | تست parity واقعی Backend و Local Engine             | بسیار بالا |
| P2     | انتقال گزارش‌ها و KPIهای سنگین به پردازش محلی دستگاه | بالا       |
| P2     | اندازه‌گیری مصرف CPU/RAM و زمان ثبت فاکتور در دستگاه | بالا       |
  
**۸. معیار پذیرش نهایی**  
<div dir="rtl">من قبل از اینکه این معماری را کامل‌شده اعلام کنم، این سناریوها را الزامی می‌دانم:</div>  
* فاکتور در ویندوز آنلاین ثبت شود؛ هیچ درخواست ایجاد فاکتوری به Backend نرود و فاکتور در SQLite ثبت شود.  
* همین تست روی Android انجام شود.  
* بعد از ثبت، موجودی، بهای تمام‌شده، پرداخت و دفتر کل محلی با فاکتور هماهنگ باشند.  
* پس از اتصال شبکه، فاکتور فقط یک بار در PostgreSQL ثبت شود.  
* اگر پاسخ سرور گم شد، ارسال مجدد باعث فاکتور تکراری نشود.  
* اگر دو دستگاه هم‌زمان یک موجودی را بفروشند، تعارض بی‌صدا یا LWW رخ ندهد.  
* فاکتور وب به‌وسیله Pull به موبایل و ویندوز برسد.  
* فاکتور دستگاهی بعد از تأیید سرور، شماره رسمی بگیرد و وضعیت محلی آن درست به‌روزرسانی شود.  
* وب همچنان مستقیماً از Backend استفاده کند.  
* خروجی محاسبات مالی و موجودی در Backend و Local Engine با داده ورودی یکسان برابر باشد.  
<div dir="rtl">جمع‌بندی من: حسابچه از نظر ساخت Local Engine به نقطه خوبی رسیده؛ لازم نیست موتور دیگری بسازیم. ولی در نسخه فعلی، هدف «ویندوز و موبایل بار اصلی پردازش فاکتور را به دوش بکشند» هنوز به‌طور کامل محقق نشده است. مهم‌ترین علت، انتخاب Backend به‌عنوان مسیر اولیه ثبت فاکتور در حالت آنلاین است؛ علت مهم بعدی هم ناقص بودن Pull موبایل است.</div>  
<div dir="rtl"></div>  
