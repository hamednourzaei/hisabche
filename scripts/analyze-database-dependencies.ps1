# ============================================
# scripts/analyze-database-dependencies.ps1
# Hisabche Database Dependency Analyzer
# ============================================

param(
    [string]$ProjectPath = ".",
    [string]$OutputFile = "database-dependencies-report.md"
)

Write-Host "🔍 Hisabche Database Dependency Analyzer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── تنظیمات ──────────────────────────────────────────────
$ProjectRoot = Resolve-Path $ProjectPath
$BackendPath = Join-Path $ProjectRoot "backend\src"
$PackagesPath = Join-Path $ProjectRoot "packages"

# ─── جمع‌آوری تمام جدول‌های دیتابیس ──────────────────────
$databaseTables = @{
    # Core Business
    "products" = @{ description = "محصولات"; priority = "CRITICAL"; module = "core" }
    "invoices" = @{ description = "فاکتورها"; priority = "CRITICAL"; module = "core" }
    "invoice_items" = @{ description = "آیتم‌های فاکتور"; priority = "CRITICAL"; module = "core" }
    "customers" = @{ description = "مشتریان"; priority = "CRITICAL"; module = "core" }
    "transactions" = @{ description = "تراکنش‌ها"; priority = "CRITICAL"; module = "core" }
    "suppliers" = @{ description = "تامین‌کنندگان"; priority = "HIGH"; module = "core" }
    
    # Accounting
    "accounts" = @{ description = "حساب‌های مالی"; priority = "HIGH"; module = "accounting" }
    "ledger_entries" = @{ description = "دفتر کل"; priority = "HIGH"; module = "accounting" }
    "journal_entries" = @{ description = "اسناد حسابداری"; priority = "HIGH"; module = "accounting" }
    "journal_lines" = @{ description = "ردیف‌های اسناد"; priority = "HIGH"; module = "accounting" }
    
    # Inventory
    "stock_movements" = @{ description = "حرکات انبار"; priority = "HIGH"; module = "inventory" }
    "warehouses" = @{ description = "انبارها"; priority = "HIGH"; module = "inventory" }
    "purchase_orders" = @{ description = "سفارشات خرید"; priority = "MEDIUM"; module = "inventory" }
    "purchase_order_items" = @{ description = "آیتم‌های سفارش خرید"; priority = "MEDIUM"; module = "inventory" }
    
    # Manufacturing
    "boms" = @{ description = "لیست مواد اولیه"; priority = "MEDIUM"; module = "manufacturing" }
    "bom_items" = @{ description = "آیتم‌های لیست مواد"; priority = "MEDIUM"; module = "manufacturing" }
    "work_orders" = @{ description = "دستورات کاری"; priority = "MEDIUM"; module = "manufacturing" }
    
    # HR
    "departments" = @{ description = "دپارتمان‌ها"; priority = "HIGH"; module = "hr" }
    "employees" = @{ description = "کارمندان"; priority = "HIGH"; module = "hr" }
    "attendance" = @{ description = "حضور و غیاب"; priority = "MEDIUM"; module = "hr" }
    "payrolls" = @{ description = "حقوق و دستمزد"; priority = "MEDIUM"; module = "hr" }
    "leaves" = @{ description = "مرخصی‌ها"; priority = "MEDIUM"; module = "hr" }
    
    # Projects
    "projects" = @{ description = "پروژه‌ها"; priority = "HIGH"; module = "projects" }
    "project_tasks" = @{ description = "وظایف پروژه"; priority = "HIGH"; module = "projects" }
    "project_members" = @{ description = "اعضای پروژه"; priority = "HIGH"; module = "projects" }
    "project_time_entries" = @{ description = "ثبت زمان پروژه"; priority = "MEDIUM"; module = "projects" }
    
    # Workspace & Auth
    "workspaces" = @{ description = "فضاهای کاری"; priority = "CRITICAL"; module = "workspace" }
    "workspace_members" = @{ description = "اعضای فضاهای کاری"; priority = "CRITICAL"; module = "workspace" }
    "workspace_invites" = @{ description = "دعوت‌نامه‌های فضاهای کاری"; priority = "HIGH"; module = "workspace" }
    "user_roles" = @{ description = "نقش‌های کاربران"; priority = "CRITICAL"; module = "auth" }
    "permissions" = @{ description = "دسترسی‌ها"; priority = "HIGH"; module = "auth" }
    "roles" = @{ description = "نقش‌ها"; priority = "HIGH"; module = "auth" }
    "role_permissions" = @{ description = "دسترسی‌های نقش‌ها"; priority = "HIGH"; module = "auth" }
    
    # System
    "audit_logs" = @{ description = "لاگ‌های حسابرسی"; priority = "HIGH"; module = "system" }
    "event_log" = @{ description = "لاگ رویدادها"; priority = "MEDIUM"; module = "system" }
    "event_types" = @{ description = "انواع رویدادها"; priority = "MEDIUM"; module = "system" }
    "sync_queue" = @{ description = "صف همگام‌سازی"; priority = "HIGH"; module = "system" }
    "sync_logs" = @{ description = "لاگ همگام‌سازی"; priority = "MEDIUM"; module = "system" }
    "background_jobs" = @{ description = "کارهای پس‌زمینه"; priority = "MEDIUM"; module = "system" }
    "password_reset_tokens" = @{ description = "توکن‌های بازنشانی رمز"; priority = "HIGH"; module = "auth" }
    "notifications" = @{ description = "اعلان‌ها"; priority = "HIGH"; module = "system" }
    
    # Billing
    "subscriptions" = @{ description = "اشتراک‌ها"; priority = "HIGH"; module = "billing" }
    "billing_plans" = @{ description = "پلن‌های اشتراک"; priority = "HIGH"; module = "billing" }
    "checkout_sessions" = @{ description = "جلسات پرداخت"; priority = "HIGH"; module = "billing" }
    "webhook_events" = @{ description = "رویدادهای Webhook"; priority = "MEDIUM"; module = "billing" }
    
    # CRM
    "interactions" = @{ description = "تعاملات با مشتری"; priority = "MEDIUM"; module = "crm" }
    "opportunities" = @{ description = "فرصت‌های فروش"; priority = "MEDIUM"; module = "crm" }
    
    # Workflow
    "workflows" = @{ description = "جریان‌های کاری"; priority = "HIGH"; module = "workflow" }
    "workflow_steps" = @{ description = "مراحل جریان کاری"; priority = "HIGH"; module = "workflow" }
    "workflow_instances" = @{ description = "نمونه‌های جریان کاری"; priority = "HIGH"; module = "workflow" }
    "workflow_actions" = @{ description = "اقدامات جریان کاری"; priority = "HIGH"; module = "workflow" }
    
    # Cache
    "invoice_pdf_cache" = @{ description = "کش PDF فاکتور"; priority = "LOW"; module = "cache" }
}

# ─── اسکن فایل‌های Backend ──────────────────────────────
Write-Host "📂 Scanning Backend files..." -ForegroundColor Yellow

$usedTables = @{}
$usedModules = @{}
$servicesWithTables = @{}

# اسکن تمام فایل‌های TypeScript در Backend
$tsFiles = Get-ChildItem -Path $BackendPath -Recurse -Include "*.ts", "*.tsx" | Where-Object { 
    $_.Name -notmatch "\.test\." -and $_.Name -notmatch "\.spec\." 
}

foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    # پیدا کردن جدول‌های استفاده شده در کوئری‌ها
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "from\s+['""]$table['""]" -or 
            $content -match "\.from\(['""]$table['""]\)" -or
            $content -match "['""]$table['""]\s*,\s*\{.*count" -or
            $content -match "table:\s*['""]$table['""]" -or
            $content -match "entity_type.*['""]$table['""]" -or
            $content -match "['""]$table['""]\s*\)" -or
            $content -match "const\s+$table" -or
            $content -match "interface\s+.*$table" -or
            $content -match "type\s+.*$table") {
            
            $usedTables[$table] = $true
            $module = $databaseTables[$table].module
            $usedModules[$module] = $true
            
            $relativePath = $file.FullName.Replace($ProjectRoot, ".").Replace("\", "/")
            if (-not $servicesWithTables.ContainsKey($table)) {
                $servicesWithTables[$table] = @()
            }
            $servicesWithTables[$table] += $relativePath
        }
    }
}

# ─── اسکن فایل‌های Frontend ──────────────────────────────
Write-Host "📂 Scanning Frontend files..." -ForegroundColor Yellow

# اسکن فایل‌های UI و API hooks
$uiFiles = Get-ChildItem -Path $PackagesPath -Recurse -Include "*.ts", "*.tsx" | Where-Object {
    $_.FullName -match "ui|api|hooks|store|validation"
}

foreach ($file in $uiFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "['""]$table['""]" -or
            $content -match "table:\s*['""]$table['""]" -or
            $content -match "entity_type.*['""]$table['""]" -or
            $content -match "const\s+.*$table" -or
            $content -match "type\s+.*$table" -or
            $content -match "interface\s+.*$table") {
            
            $usedTables[$table] = $true
            $module = $databaseTables[$table].module
            $usedModules[$module] = $true
        }
    }
}

# ─── اسکن فایل‌های Validation ─────────────────────────────
Write-Host "📂 Scanning Validation files..." -ForegroundColor Yellow

$validationFiles = Get-ChildItem -Path (Join-Path $PackagesPath "validation\src") -Recurse -Include "*.ts"

foreach ($file in $validationFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "['""]$table['""]" -or
            $content -match "interface\s+.*$table" -or
            $content -match "type\s+.*$table" -or
            $content -match "const\s+.*$table") {
            
            $usedTables[$table] = $true
        }
    }
}

# ─── اسکن فایل‌های Routes ──────────────────────────────────
Write-Host "📂 Scanning Routes files..." -ForegroundColor Yellow

$routeFiles = Get-ChildItem -Path $BackendPath -Recurse -Include "*.routes.ts"

foreach ($file in $routeFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "from\s+['""]$table['""]" -or
            $content -match "\.from\(['""]$table['""]\)" -or
            $content -match "['""]$table['""]\s*,\s*\{.*count" -or
            $content -match "table:\s*['""]$table['""]") {
            
            $usedTables[$table] = $true
            $module = $databaseTables[$table].module
            $usedModules[$module] = $true
        }
    }
}

# ─── اسکن فایل‌های Service ──────────────────────────────────
Write-Host "📂 Scanning Service files..." -ForegroundColor Yellow

$serviceFiles = Get-ChildItem -Path $BackendPath -Recurse -Include "*.service.ts"

foreach ($file in $serviceFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "from\s+['""]$table['""]" -or
            $content -match "\.from\(['""]$table['""]\)" -or
            $content -match "['""]$table['""]\s*,\s*\{.*count" -or
            $content -match "table:\s*['""]$table['""]" -or
            $content -match "supabase\..*['""]$table['""]" -or
            $content -match "entity_type.*['""]$table['""]") {
            
            $usedTables[$table] = $true
            $module = $databaseTables[$table].module
            $usedModules[$module] = $true
            $usedTables[$table] = $true
        }
    }
}

# ─── اسکن فایل‌های Migration ──────────────────────────────
Write-Host "📂 Scanning Migration files..." -ForegroundColor Yellow

$migrationFiles = Get-ChildItem -Path (Join-Path $PackagesPath "db\src") -Recurse -Include "*.ts", "*.sql"

foreach ($file in $migrationFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "CREATE\s+TABLE\s+.*$table" -or
            $content -match "ALTER\s+TABLE\s+.*$table" -or
            $content -match "DROP\s+TABLE\s+.*$table" -or
            $content -match "['""]$table['""]") {
            
            $usedTables[$table] = $true
        }
    }
}

# ─── اسکن فایل‌های Schema ──────────────────────────────────
Write-Host "📂 Scanning Schema files..." -ForegroundColor Yellow

$schemaFiles = Get-ChildItem -Path (Join-Path $PackagesPath "db\src\schema") -Recurse -Include "*.ts"

foreach ($file in $schemaFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    foreach ($table in $databaseTables.Keys) {
        if ($content -match "['""]$table['""]" -or
            $content -match "tableSchema.*['""]$table['""]" -or
            $content -match "name:\s*['""]$table['""]") {
            
            $usedTables[$table] = $true
        }
    }
}

# ─── ایجاد گزارش ──────────────────────────────────────────────
Write-Host ""
Write-Host "📊 Generating Report..." -ForegroundColor Green

$report = @"
# 🗄️ Hisabche Database Dependency Report

**تاریخ:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**پروژه:** Hisabche Business Operating System

---

## 📊 خلاصه کلی

| معیار | تعداد |
|-------|-------|
| **کل جدول‌های دیتابیس** | $($databaseTables.Count) |
| **جدول‌های استفاده شده** | $($usedTables.Count) |
| **ماژول‌های فعال** | $($usedModules.Count) |

---

## 📈 جدول‌های استفاده شده

| # | جدول | توضیحات | اولویت | ماژول | فایل‌های مرتبط |
|---|------|---------|--------|-------|---------------|
"@

$counter = 1
foreach ($table in $usedTables.Keys | Sort-Object) {
    $info = $databaseTables[$table]
    $description = $info.description
    $priority = $info.priority
    $module = $info.module
    
    $files = ""
    if ($servicesWithTables.ContainsKey($table)) {
        $files = ($servicesWithTables[$table] | Select-Object -First 3) -join ", "
        if ($servicesWithTables[$table].Count -gt 3) {
            $files += " (+$($servicesWithTables[$table].Count - 3) more)"
        }
    }
    
    $report += "| $counter | **$table** | $description | $priority | $module | $files |`n"
    $counter++
}

$report += @"

---

## 📦 جدول‌های استفاده نشده

| # | جدول | توضیحات | اولویت | ماژول |
|---|------|---------|--------|-------|
"@

$unusedCounter = 1
foreach ($table in $databaseTables.Keys | Sort-Object) {
    if (-not $usedTables.ContainsKey($table)) {
        $info = $databaseTables[$table]
        $report += "| $unusedCounter | **$table** | $($info.description) | $($info.priority) | $($info.module) |`n"
        $unusedCounter++
    }
}

$report += @"

---

## 🧩 ماژول‌های فعال

| # | ماژول | جدول‌ها |
|---|-------|---------|
"@

$moduleCounter = 1
foreach ($module in $usedModules.Keys | Sort-Object) {
    $tables = @()
    foreach ($table in $usedTables.Keys) {
        if ($databaseTables[$table].module -eq $module) {
            $tables += $table
        }
    }
    $report += "| $moduleCounter | **$module** | $($tables -join ', ') |`n"
    $moduleCounter++
}

$report += @"

---

## 🚀 جدول‌های حیاتی (CRITICAL)

| # | جدول | توضیحات |
|---|------|---------|
"@

$criticalCounter = 1
foreach ($table in $usedTables.Keys | Sort-Object) {
    $info = $databaseTables[$table]
    if ($info.priority -eq "CRITICAL") {
        $report += "| $criticalCounter | **$table** | $($info.description) |`n"
        $criticalCounter++
    }
}

$report += @"

---

## 🎯 پیشنهادات

### برای راه‌اندازی کامل سیستم، این جدول‌ها ضروری هستند:

1. **CRITICAL (ابتدا ایجاد شوند):**
   - users (auth.users)
   - workspaces
   - workspace_members
   - user_roles
   - customers
   - products
   - invoices
   - invoice_items

2. **HIGH (سپس ایجاد شوند):**
   - suppliers
   - transactions
   - accounts
   - ledger_entries
   - journal_entries
   - journal_lines
   - stock_movements
   - warehouses
   - departments
   - employees
   - projects
   - project_tasks
   - project_members
   - workflows
   - workflow_steps
   - workflow_instances
   - workflow_actions
   - audit_logs
   - notifications
   - subscriptions
   - billing_plans
   - checkout_sessions
   - permissions
   - roles
   - role_permissions
   - password_reset_tokens

3. **MEDIUM (اختیاری):**
   - purchase_orders
   - purchase_order_items
   - boms
   - bom_items
   - work_orders
   - attendance
   - payrolls
   - leaves
   - project_time_entries
   - workspace_invites
   - event_log
   - event_types
   - sync_queue
   - sync_logs
   - background_jobs
   - interactions
   - opportunities
   - webhook_events

4. **LOW (در صورت نیاز):**
   - invoice_pdf_cache

---

## 📝 نکات

- **تعداد کل جدول‌های دیتابیس:** $($databaseTables.Count)
- **تعداد جدول‌های استفاده شده:** $($usedTables.Count)
- **تعداد جدول‌های استفاده نشده:** $($databaseTables.Count - $usedTables.Count)
- **ماژول‌های فعال:** $($usedModules.Count)

### بررسی وابستگی‌ها:

برای اجرای کامل سیستم Hisabche، تمام جدول‌های با اولویت **CRITICAL** و **HIGH** باید در دیتابیس ایجاد شوند.

---

**گزارش توسط Hisabche AI Operating System v15 تولید شده است.**
"@

# ─── ذخیره گزارش ──────────────────────────────────────────────
$reportPath = Join-Path $ProjectRoot $OutputFile
$report | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host ""
Write-Host "✅ Report saved to: $reportPath" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  - Total tables: $($databaseTables.Count)" -ForegroundColor White
Write-Host "  - Used tables: $($usedTables.Count)" -ForegroundColor White
Write-Host "  - Unused tables: $($databaseTables.Count - $usedTables.Count)" -ForegroundColor White
Write-Host "  - Active modules: $($usedModules.Count)" -ForegroundColor White
Write-Host ""

# ─── نمایش جدول‌های حیاتی ────────────────────────────────────
Write-Host "🚀 Critical Tables (required for core functionality):" -ForegroundColor Yellow
$criticalTables = $usedTables.Keys | Where-Object { $databaseTables[$_].priority -eq "CRITICAL" }
foreach ($table in $criticalTables | Sort-Object) {
    Write-Host "  ✅ $table" -ForegroundColor Green
}

Write-Host ""
Write-Host "📁 برای مشاهده گزارش کامل، فایل زیر را باز کنید:" -ForegroundColor Cyan
Write-Host "  $reportPath" -ForegroundColor White