// scripts/analyze-database-dependencies.js
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const databaseTables = {
    'products': { description: 'محصولات', priority: 'CRITICAL', module: 'core' },
    'invoices': { description: 'فاکتورها', priority: 'CRITICAL', module: 'core' },
    'invoice_items': { description: 'آیتم‌های فاکتور', priority: 'CRITICAL', module: 'core' },
    'customers': { description: 'مشتریان', priority: 'CRITICAL', module: 'core' },
    'transactions': { description: 'تراکنش‌ها', priority: 'CRITICAL', module: 'core' },
    'suppliers': { description: 'تامین‌کنندگان', priority: 'HIGH', module: 'core' },
    'accounts': { description: 'حساب‌های مالی', priority: 'HIGH', module: 'accounting' },
    'ledger_entries': { description: 'دفتر کل', priority: 'HIGH', module: 'accounting' },
    'journal_entries': { description: 'اسناد حسابداری', priority: 'HIGH', module: 'accounting' },
    'journal_lines': { description: 'ردیف‌های اسناد', priority: 'HIGH', module: 'accounting' },
    'stock_movements': { description: 'حرکات انبار', priority: 'HIGH', module: 'inventory' },
    'warehouses': { description: 'انبارها', priority: 'HIGH', module: 'inventory' },
    'purchase_orders': { description: 'سفارشات خرید', priority: 'MEDIUM', module: 'inventory' },
    'purchase_order_items': { description: 'آیتم‌های سفارش خرید', priority: 'MEDIUM', module: 'inventory' },
    'boms': { description: 'لیست مواد اولیه', priority: 'MEDIUM', module: 'manufacturing' },
    'bom_items': { description: 'آیتم‌های لیست مواد', priority: 'MEDIUM', module: 'manufacturing' },
    'work_orders': { description: 'دستورات کاری', priority: 'MEDIUM', module: 'manufacturing' },
    'departments': { description: 'دپارتمان‌ها', priority: 'HIGH', module: 'hr' },
    'employees': { description: 'کارمندان', priority: 'HIGH', module: 'hr' },
    'attendance': { description: 'حضور و غیاب', priority: 'MEDIUM', module: 'hr' },
    'payrolls': { description: 'حقوق و دستمزد', priority: 'MEDIUM', module: 'hr' },
    'leaves': { description: 'مرخصی‌ها', priority: 'MEDIUM', module: 'hr' },
    'projects': { description: 'پروژه‌ها', priority: 'HIGH', module: 'projects' },
    'project_tasks': { description: 'وظایف پروژه', priority: 'HIGH', module: 'projects' },
    'project_members': { description: 'اعضای پروژه', priority: 'HIGH', module: 'projects' },
    'project_time_entries': { description: 'ثبت زمان پروژه', priority: 'MEDIUM', module: 'projects' },
    'workspaces': { description: 'فضاهای کاری', priority: 'CRITICAL', module: 'workspace' },
    'workspace_members': { description: 'اعضای فضاهای کاری', priority: 'CRITICAL', module: 'workspace' },
    'workspace_invites': { description: 'دعوت‌نامه‌های فضاهای کاری', priority: 'HIGH', module: 'workspace' },
    'user_roles': { description: 'نقش‌های کاربران', priority: 'CRITICAL', module: 'auth' },
    'permissions': { description: 'دسترسی‌ها', priority: 'HIGH', module: 'auth' },
    'roles': { description: 'نقش‌ها', priority: 'HIGH', module: 'auth' },
    'role_permissions': { description: 'دسترسی‌های نقش‌ها', priority: 'HIGH', module: 'auth' },
    'audit_logs': { description: 'لاگ‌های حسابرسی', priority: 'HIGH', module: 'system' },
    'event_log': { description: 'لاگ رویدادها', priority: 'MEDIUM', module: 'system' },
    'event_types': { description: 'انواع رویدادها', priority: 'MEDIUM', module: 'system' },
    'sync_queue': { description: 'صف همگام‌سازی', priority: 'HIGH', module: 'system' },
    'sync_logs': { description: 'لاگ همگام‌سازی', priority: 'MEDIUM', module: 'system' },
    'background_jobs': { description: 'کارهای پس‌زمینه', priority: 'MEDIUM', module: 'system' },
    'password_reset_tokens': { description: 'توکن‌های بازنشانی رمز', priority: 'HIGH', module: 'auth' },
    'notifications': { description: 'اعلان‌ها', priority: 'HIGH', module: 'system' },
    'subscriptions': { description: 'اشتراک‌ها', priority: 'HIGH', module: 'billing' },
    'billing_plans': { description: 'پلن‌های اشتراک', priority: 'HIGH', module: 'billing' },
    'checkout_sessions': { description: 'جلسات پرداخت', priority: 'HIGH', module: 'billing' },
    'webhook_events': { description: 'رویدادهای Webhook', priority: 'MEDIUM', module: 'billing' },
    'interactions': { description: 'تعاملات با مشتری', priority: 'MEDIUM', module: 'crm' },
    'opportunities': { description: 'فرصت‌های فروش', priority: 'MEDIUM', module: 'crm' },
    'workflows': { description: 'جریان‌های کاری', priority: 'HIGH', module: 'workflow' },
    'workflow_steps': { description: 'مراحل جریان کاری', priority: 'HIGH', module: 'workflow' },
    'workflow_instances': { description: 'نمونه‌های جریان کاری', priority: 'HIGH', module: 'workflow' },
    'workflow_actions': { description: 'اقدامات جریان کاری', priority: 'HIGH', module: 'workflow' },
    'invoice_pdf_cache': { description: 'کش PDF فاکتور', priority: 'LOW', module: 'cache' },
};

function scanFiles(dir, pattern) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
            results.push(...scanFiles(fullPath, pattern));
        } else if (stat.isFile() && pattern.test(file)) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                results.push({ path: fullPath, content });
            } catch {}
        }
    }
    return results;
}

console.log('🔍 Scanning backend files...');
const usedTables = new Set();
const usedModules = new Set();
const servicesWithTables = {};

const patterns = /\.(ts|tsx|js)$/;
const backendFiles = scanFiles(path.join(projectRoot, 'backend', 'src'), patterns);
const packageFiles = scanFiles(path.join(projectRoot, 'packages'), patterns);

const allFiles = [...backendFiles, ...packageFiles];

for (const file of allFiles) {
    const content = file.content;
    for (const table of Object.keys(databaseTables)) {
        if (content.includes(`from "${table}"`) || 
            content.includes(`from '${table}'`) ||
            content.includes(`.from("${table}")`) ||
            content.includes(`.from('${table}')`) ||
            content.includes(`table: "${table}"`) ||
            content.includes(`table: '${table}'`) ||
            content.includes(`entity_type: "${table}"`) ||
            content.includes(`entity_type: '${table}'`)) {
            
            usedTables.add(table);
            usedModules.add(databaseTables[table].module);
            
            const relPath = file.path.replace(projectRoot, '.').replace(/\\/g, '/');
            if (!servicesWithTables[table]) servicesWithTables[table] = [];
            if (!servicesWithTables[table].includes(relPath)) {
                servicesWithTables[table].push(relPath);
            }
        }
    }
}

console.log('\n📊 Results:');
console.log('===================');
console.log(`Total tables: ${Object.keys(databaseTables).length}`);
console.log(`Used tables: ${usedTables.size}`);
console.log(`Unused tables: ${Object.keys(databaseTables).length - usedTables.size}`);
console.log(`Active modules: ${usedModules.size}`);

console.log('\n🚀 Critical Tables (required):');
for (const table of [...usedTables].filter(t => databaseTables[t].priority === 'CRITICAL').sort()) {
    console.log(`  ✅ ${table} - ${databaseTables[table].description}`);
}

console.log('\n📁 Unused Tables:');
for (const table of Object.keys(databaseTables).filter(t => !usedTables.has(t)).sort()) {
    console.log(`  ⚠️ ${table} - ${databaseTables[table].description}`);
}

// Generate report
let report = '# 🗄️ Hisabche Database Dependency Report\n\n';
report += `**Date:** ${new Date().toISOString()}\n\n`;
report += `## Summary\n\n`;
report += `| Metric | Count |\n`;
report += `|--------|-------|\n`;
report += `| Total Tables | ${Object.keys(databaseTables).length} |\n`;
report += `| Used Tables | ${usedTables.size} |\n`;
report += `| Unused Tables | ${Object.keys(databaseTables).length - usedTables.size} |\n`;
report += `| Active Modules | ${usedModules.size} |\n\n`;

report += `## Used Tables\n\n`;
report += `| Table | Description | Priority | Module |\n`;
report += `|-------|-------------|----------|--------|\n`;
for (const table of [...usedTables].sort()) {
    const info = databaseTables[table];
    report += `| ${table} | ${info.description} | ${info.priority} | ${info.module} |\n`;
}

report += `\n## Unused Tables\n\n`;
report += `| Table | Description | Priority | Module |\n`;
report += `|-------|-------------|----------|--------|\n`;
for (const table of Object.keys(databaseTables).filter(t => !usedTables.has(t)).sort()) {
    const info = databaseTables[table];
    report += `| ${table} | ${info.description} | ${info.priority} | ${info.module} |\n`;
}

const reportPath = path.join(projectRoot, 'database-dependencies-report.md');
fs.writeFileSync(reportPath, report, 'utf8');
console.log(`\n✅ Report saved to: ${reportPath}`);