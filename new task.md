hamed@MSI MINGW64 ~/Desktop/hisabche (main)
$ git add .

hamed@MSI MINGW64 ~/Desktop/hisabche (main)
$ git commit -m "fixed completed"
⋯ Backing up original state…
✔ Done backing up original state (6fd53ed)!
⋯ Running tasks for staged files…
.lintstagedrc.js — 237 files
**/_.{ts,tsx,js,jsx,mjs,cjs} — 205 files
⋯ eslint --fix "add-all-695-keys.mjs" "add-all-missing-keys.mjs" "add-missing-keys.mjs" "apps\desktop\src\app\app.tsx" "apps\desktop\src\features\finance\assets-page.tsx" "apps\desktop\src\features\finance\bank-page.tsx" "apps\desktop\src\features\finance\budgets-page.tsx" "apps\desktop\src\features\finance\till-page.tsx" "apps\desktop\src\features\operations\expiry-page.tsx" "apps\desktop\src\features\operations\timesheets-page.tsx" "apps\mobile\app\assets.tsx" "apps\mobile\app\bank.tsx" "apps\mobile\app\budgets.tsx" "apps\mobile\app\expiry.tsx" "apps\mobile\app\till.tsx" "apps\mobile\app\timesheets.tsx" "apps\mobile\src\features\accounting\screens\accounting-screen.tsx" "apps\mobile\src\features\assets\screens\assets-screen.tsx" "apps\mobile\src\features\bank\screens\bank-screen.tsx" "apps\mobile\src\features\budgets\screens\budgets-screen.tsx" "apps\mobile\src\features\capability\capability-kit.tsx" "apps\mobile\src\features\expiry\screens\expiry-screen.tsx" "apps\mobile\src\features\till\screens\till-screen.tsx" "apps\mobile\src\features\timesheets\screens\timesheets-screen.tsx" "apps\mobile\src\shared\navigation\nav.ts" "apps\web\app\[lang]\(dashboard)\assets\page.tsx" "apps\web\app\[lang]\(dashboard)\bank\page.tsx" "apps\web\app\[lang]\(dashboard)\budgets\page.tsx" "apps\web\app\[lang]\(dashboard)\expiry\page.tsx" "apps\web\app\[lang]\(dashboard)\till\page.tsx" "apps\web\app\[lang]\(dashboard)\timesheets\page.tsx" "apps\web\next-env.d.ts" "backend\src\_*tests*_\accounting-ledger-rules.test.ts" "backend\src\_*tests*_\authorization-rules.test.ts" "backend\src\_*tests*_\branch-rules.test.ts" "backend\src\_*tests*_\constitution-guards.test.ts" "backend\src\_*tests*_\finance-gaps-rules.test.ts" "backend\src\_*tests*_\financial-flows-e2e.test.ts" "backend\src\_*tests*_\insights-rules.test.ts" "backend\src\_*tests*_\inventory-costing-rules.test.ts" "backend\src\_*tests*_\mdm-rules.test.ts" "backend\src\_*tests*_\offline-conflict-rules.test.ts" "backend\src\_*tests*_\payments-ar-ap-rules.test.ts" "backend\src\_*tests*_\personalization-rules.test.ts" "backend\src\_*tests*_\plugin-rules.test.ts" "backend\src\_*tests*_\pos-rules.test.ts" "backend\src\_*tests*_\rls-coverage.test.ts" "backend\src\_*tests*_\rules-engine-rules.test.ts" "backend\src\_*tests*_\sod-rules.test.ts" "backend\src\_*tests*_\tax-engine-rules.test.ts" "backend\src\_*tests*_\tenancy-static-guard.test.ts" "backend\src\_*tests*_\tier2-gaps-rules.test.ts" "backend\src\_*tests*_\traceability-rules.test.ts" "backend\src\_*tests*_\vertical-slice-integration.test.ts" "backend\src\index.ts" "backend\src\middleware\authorize.middleware.ts" "backend\src\middleware\branch.middleware.ts" "backend\src\routes\accounting.routes.ts" "backend\src\routes\audit.routes.ts" "backend\src\routes\billing.routes.ts" "backend\src\routes\branch.routes.ts" "backend\src\routes\conflict.routes.ts" "backend\src\routes\crm.routes.ts" "backend\src\routes\finance-ops.routes.ts" "backend\src\routes\governance.routes.ts" "backend\src\routes\human-resources.routes.ts" "backend\src\routes\intelligence.routes.ts" "backend\src\routes\inventory-costing.routes.ts" "backend\src\routes\invoice.routes.ts" "backend\src\routes\manufacturing.routes.ts" "backend\src\routes\operations.routes.ts" "backend\src\routes\payments.routes.ts" "backend\src\routes\personalization.routes.ts" "backend\src\routes\pos.routes.ts" "backend\src\routes\project.routes.ts" "backend\src\routes\purchasing.routes.ts" "backend\src\routes\rules.routes.ts" "backend\src\routes\supplier.routes.ts" "backend\src\routes\tax.routes.ts" "backend\src\routes\warehouse.routes.ts" "backend\src\services\accounting.service.ts" "backend\src\services\accounting\accounting.domain.ts" "backend\src\services\accounting\accounting.reports.ts" "backend\src\services\accounting\accounting.repository.ts" "backend\src\services\accounting\accounting.service.ts" "backend\src\services\accounting\index.ts" "backend\src\services\accounting\ledger.port.ts" "backend\src\services\accounting\operational-reports.ts" "backend\src\services\ai.service.ts" "backend\src\services\assets\assets.service.ts" "backend\src\services\assets\depreciation.domain.ts" "backend\src\services\assets\index.ts" "backend\src\services\audit.service.ts" "backend\src\services\authorization\authorization.domain.ts" "backend\src\services\authorization\index.ts" "backend\src\services\authorization\sod.domain.ts" "backend\src\services\authorization\sod.service.ts" "backend\src\services\banking\banking.service.ts" "backend\src\services\banking\index.ts" "backend\src\services\banking\reconciliation.domain.ts" "backend\src\services\billing.service.ts" "backend\src\services\branch\branch.domain.ts" "backend\src\services\branch\branch.service.ts" "backend\src\services\branch\index.ts" "backend\src\services\budgeting\budget.domain.ts" "backend\src\services\budgeting\budget.service.ts" "backend\src\services\budgeting\index.ts" "backend\src\services\conflict\conflict.domain.ts" "backend\src\services\conflict\conflict.service.ts" "backend\src\services\conflict\index.ts" "backend\src\services\crm.service.ts" "backend\src\services\currency\currency.service.ts" "backend\src\services\currency\index.ts" "backend\src\services\currency\revaluation.domain.ts" "backend\src\services\customer.service.ts" "backend\src\services\dimensions\dimension.domain.ts" "backend\src\services\dimensions\dimensions.service.ts" "backend\src\services\dimensions\index.ts" "backend\src\services\human-resources.service.ts" "backend\src\services\insights\index.ts" "backend\src\services\insights\insights.domain.ts" "backend\src\services\insights\insights.service.ts" "backend\src\services\inventory-costing\costing.domain.ts" "backend\src\services\inventory-costing\costing.port.ts" "backend\src\services\inventory-costing\costing.repository.ts" "backend\src\services\inventory-costing\costing.service.ts" "backend\src\services\inventory-costing\index.ts"
⋯ eslint --fix "backend\src\services\inventory-costing\repost.domain.ts" "backend\src\services\invoice.service.ts" "backend\src\services\manufacturing.service.ts" "backend\src\services\mdm\index.ts" "backend\src\services\mdm\mdm.domain.ts" "backend\src\services\mdm\mdm.service.ts" "backend\src\services\payments\index.ts" "backend\src\services\payments\payments.domain.ts" "backend\src\services\payments\payments.repository.ts" "backend\src\services\payments\payments.service.ts" "backend\src\services\personalization\index.ts" "backend\src\services\personalization\visibility.domain.ts" "backend\src\services\personalization\visibility.service.ts" "backend\src\services\plugins\plugin.domain.ts" "backend\src\services\pos\index.ts" "backend\src\services\pos\pos.domain.ts" "backend\src\services\pos\pos.service.ts" "backend\src\services\project.service.ts" "backend\src\services\purchasing.service.ts" "backend\src\services\rules\index.ts" "backend\src\services\rules\rules.domain.ts" "backend\src\services\rules\rules.service.ts" "backend\src\services\supplier\index.ts" "backend\src\services\supplier\supplier.service.ts" "backend\src\services\sync.service.ts" "backend\src\services\tax\index.ts" "backend\src\services\tax\tax.domain.ts" "backend\src\services\tax\tax.service.ts" "backend\src\services\tax\tax.snapshot.ts" "backend\src\services\timesheets\billing.domain.ts" "backend\src\services\timesheets\index.ts" "backend\src\services\timesheets\timesheets.service.ts" "backend\src\services\traceability\index.ts" "backend\src\services\traceability\lot.domain.ts" "backend\src\services\traceability\traceability.service.ts" "backend\src\services\warehouse.service.ts" "find-missing-keys.mjs" "find_missing_keys.js" "packages\api\src\hooks\accounting.ts" "packages\api\src\hooks\assets.ts" "packages\api\src\hooks\bank.ts" "packages\api\src\hooks\budgets.ts" "packages\api\src\hooks\expiry.ts" "packages\api\src\hooks\index.ts" "packages\api\src\hooks\till.ts" "packages\api\src\hooks\timesheets.ts" "packages\api\src\index.ts" "packages\ui-contract\src\_*tests*_\nav-destinations.test.ts" "packages\ui-contract\src\_*tests*_\nav-visibility.test.ts" "packages\ui-contract\src\_*tests*_\runtime-policy.test.ts" "packages\ui-contract\src\index.ts" "packages\ui-contract\src\navigation.ts" "packages\ui-contract\src\runtime-policy.ts" "packages\ui\src\components\ui\accounting\tabs\BalanceSheetTab.tsx" "packages\ui\src\components\ui\accounting\tabs\IncomeStatementTab.tsx" "packages\ui\src\components\ui\accounting\tabs\TrialBalanceTab.tsx" "packages\ui\src\components\ui\assets\assets-view.tsx" "packages\ui\src\components\ui\assets\containers\assets-container.tsx" "packages\ui\src\components\ui\bank\bank-view.tsx" "packages\ui\src\components\ui\bank\containers\bank-container.tsx" "packages\ui\src\components\ui\budgets\budgets-view.tsx" "packages\ui\src\components\ui\budgets\containers\budgets-container.tsx" "packages\ui\src\components\ui\capability\capability-kit.tsx" "packages\ui\src\components\ui\expiry\containers\expiry-container.tsx" "packages\ui\src\components\ui\expiry\expiry-view.tsx" "packages\ui\src\components\ui\till\containers\till-container.tsx" "packages\ui\src\components\ui\till\till-view.tsx" "packages\ui\src\components\ui\timesheets\containers\timesheets-container.tsx" "packages\ui\src\components\ui\timesheets\timesheets-view.tsx" "packages\ui\src\index.ts" "packages\ui\src\lib\menu\nav-items.ts" "packages\ui\src\screens.ts" "packages\validation\src\index.ts" "packages\validation\src\schemas\accounting.schema.ts" "scripts\check-schema-drift.mjs" "scripts\run-migrations.mjs" "scripts\verify-rls.mjs" "scripts\verify-slice.mjs"
⋯ prettier --write "add-all-695-keys.mjs" "add-all-missing-keys.mjs" "add-missing-keys.mjs" "apps\desktop\src\app\app.tsx" "apps\desktop\src\features\finance\assets-page.tsx" "apps\desktop\src\features\finance\bank-page.tsx" "apps\desktop\src\features\finance\budgets-page.tsx" "apps\desktop\src\features\finance\till-page.tsx" "apps\desktop\src\features\operations\expiry-page.tsx" "apps\desktop\src\features\operations\timesheets-page.tsx" "apps\mobile\app\assets.tsx" "apps\mobile\app\bank.tsx" "apps\mobile\app\budgets.tsx" "apps\mobile\app\expiry.tsx" "apps\mobile\app\till.tsx" "apps\mobile\app\timesheets.tsx" "apps\mobile\src\features\accounting\screens\accounting-screen.tsx" "apps\mobile\src\features\assets\screens\assets-screen.tsx" "apps\mobile\src\features\bank\screens\bank-screen.tsx" "apps\mobile\src\features\budgets\screens\budgets-screen.tsx" "apps\mobile\src\features\capability\capability-kit.tsx" "apps\mobile\src\features\expiry\screens\expiry-screen.tsx" "apps\mobile\src\features\till\screens\till-screen.tsx" "apps\mobile\src\features\timesheets\screens\timesheets-screen.tsx" "apps\mobile\src\shared\navigation\nav.ts" "apps\web\app\[lang]\(dashboard)\assets\page.tsx" "apps\web\app\[lang]\(dashboard)\bank\page.tsx" "apps\web\app\[lang]\(dashboard)\budgets\page.tsx" "apps\web\app\[lang]\(dashboard)\expiry\page.tsx" "apps\web\app\[lang]\(dashboard)\till\page.tsx" "apps\web\app\[lang]\(dashboard)\timesheets\page.tsx" "apps\web\next-env.d.ts" "backend\src\_*tests*_\accounting-ledger-rules.test.ts" "backend\src\_*tests*_\authorization-rules.test.ts" "backend\src\_*tests*_\branch-rules.test.ts" "backend\src\_*tests*_\constitution-guards.test.ts" "backend\src\_*tests*_\finance-gaps-rules.test.ts" "backend\src\_*tests*_\financial-flows-e2e.test.ts" "backend\src\_*tests*_\insights-rules.test.ts" "backend\src\_*tests*_\inventory-costing-rules.test.ts" "backend\src\_*tests*_\mdm-rules.test.ts" "backend\src\_*tests*_\offline-conflict-rules.test.ts" "backend\src\_*tests*_\payments-ar-ap-rules.test.ts" "backend\src\_*tests*_\personalization-rules.test.ts" "backend\src\_*tests*_\plugin-rules.test.ts" "backend\src\_*tests*_\pos-rules.test.ts" "backend\src\_*tests*_\rls-coverage.test.ts" "backend\src\_*tests*_\rules-engine-rules.test.ts" "backend\src\_*tests*_\sod-rules.test.ts" "backend\src\_*tests*_\tax-engine-rules.test.ts" "backend\src\_*tests*_\tenancy-static-guard.test.ts" "backend\src\_*tests*_\tier2-gaps-rules.test.ts" "backend\src\_*tests*_\traceability-rules.test.ts" "backend\src\_*tests*_\vertical-slice-integration.test.ts" "backend\src\index.ts" "backend\src\middleware\authorize.middleware.ts" "backend\src\middleware\branch.middleware.ts" "backend\src\routes\accounting.routes.ts" "backend\src\routes\audit.routes.ts" "backend\src\routes\billing.routes.ts" "backend\src\routes\branch.routes.ts" "backend\src\routes\conflict.routes.ts" "backend\src\routes\crm.routes.ts" "backend\src\routes\finance-ops.routes.ts" "backend\src\routes\governance.routes.ts" "backend\src\routes\human-resources.routes.ts" "backend\src\routes\intelligence.routes.ts" "backend\src\routes\inventory-costing.routes.ts" "backend\src\routes\invoice.routes.ts" "backend\src\routes\manufacturing.routes.ts" "backend\src\routes\operations.routes.ts" "backend\src\routes\payments.routes.ts" "backend\src\routes\personalization.routes.ts" "backend\src\routes\pos.routes.ts" "backend\src\routes\project.routes.ts" "backend\src\routes\purchasing.routes.ts" "backend\src\routes\rules.routes.ts" "backend\src\routes\supplier.routes.ts" "backend\src\routes\tax.routes.ts" "backend\src\routes\warehouse.routes.ts" "backend\src\services\accounting.service.ts" "backend\src\services\accounting\accounting.domain.ts" "backend\src\services\accounting\accounting.reports.ts" "backend\src\services\accounting\accounting.repository.ts" "backend\src\services\accounting\accounting.service.ts" "backend\src\services\accounting\index.ts" "backend\src\services\accounting\ledger.port.ts" "backend\src\services\accounting\operational-reports.ts" "backend\src\services\ai.service.ts" "backend\src\services\assets\assets.service.ts" "backend\src\services\assets\depreciation.domain.ts" "backend\src\services\assets\index.ts" "backend\src\services\audit.service.ts" "backend\src\services\authorization\authorization.domain.ts" "backend\src\services\authorization\index.ts" "backend\src\services\authorization\sod.domain.ts" "backend\src\services\authorization\sod.service.ts" "backend\src\services\banking\banking.service.ts" "backend\src\services\banking\index.ts" "backend\src\services\banking\reconciliation.domain.ts" "backend\src\services\billing.service.ts" "backend\src\services\branch\branch.domain.ts" "backend\src\services\branch\branch.service.ts" "backend\src\services\branch\index.ts" "backend\src\services\budgeting\budget.domain.ts" "backend\src\services\budgeting\budget.service.ts" "backend\src\services\budgeting\index.ts" "backend\src\services\conflict\conflict.domain.ts" "backend\src\services\conflict\conflict.service.ts" "backend\src\services\conflict\index.ts" "backend\src\services\crm.service.ts" "backend\src\services\currency\currency.service.ts" "backend\src\services\currency\index.ts" "backend\src\services\currency\revaluation.domain.ts" "backend\src\services\customer.service.ts" "backend\src\services\dimensions\dimension.domain.ts" "backend\src\services\dimensions\dimensions.service.ts" "backend\src\services\dimensions\index.ts" "backend\src\services\human-resources.service.ts" "backend\src\services\insights\index.ts" "backend\src\services\insights\insights.domain.ts" "backend\src\services\insights\insights.service.ts" "backend\src\services\inventory-costing\costing.domain.ts" "backend\src\services\inventory-costing\costing.port.ts" "backend\src\services\inventory-costing\costing.repository.ts" "backend\src\services\inventory-costing\costing.service.ts" "backend\src\services\inventory-costing\index.ts"
⋯ prettier --write "backend\src\services\inventory-costing\repost.domain.ts" "backend\src\services\invoice.service.ts" "backend\src\services\manufacturing.service.ts" "backend\src\services\mdm\index.ts" "backend\src\services\mdm\mdm.domain.ts" "backend\src\services\mdm\mdm.service.ts" "backend\src\services\payments\index.ts" "backend\src\services\payments\payments.domain.ts" "backend\src\services\payments\payments.repository.ts" "backend\src\services\payments\payments.service.ts" "backend\src\services\personalization\index.ts" "backend\src\services\personalization\visibility.domain.ts" "backend\src\services\personalization\visibility.service.ts" "backend\src\services\plugins\plugin.domain.ts" "backend\src\services\pos\index.ts" "backend\src\services\pos\pos.domain.ts" "backend\src\services\pos\pos.service.ts" "backend\src\services\project.service.ts" "backend\src\services\purchasing.service.ts" "backend\src\services\rules\index.ts" "backend\src\services\rules\rules.domain.ts" "backend\src\services\rules\rules.service.ts" "backend\src\services\supplier\index.ts" "backend\src\services\supplier\supplier.service.ts" "backend\src\services\sync.service.ts" "backend\src\services\tax\index.ts" "backend\src\services\tax\tax.domain.ts" "backend\src\services\tax\tax.service.ts" "backend\src\services\tax\tax.snapshot.ts" "backend\src\services\timesheets\billing.domain.ts" "backend\src\services\timesheets\index.ts" "backend\src\services\timesheets\timesheets.service.ts" "backend\src\services\traceability\index.ts" "backend\src\services\traceability\lot.domain.ts" "backend\src\services\traceability\traceability.service.ts" "backend\src\services\warehouse.service.ts" "find-missing-keys.mjs" "find_missing_keys.js" "packages\api\src\hooks\accounting.ts" "packages\api\src\hooks\assets.ts" "packages\api\src\hooks\bank.ts" "packages\api\src\hooks\budgets.ts" "packages\api\src\hooks\expiry.ts" "packages\api\src\hooks\index.ts" "packages\api\src\hooks\till.ts" "packages\api\src\hooks\timesheets.ts" "packages\api\src\index.ts" "packages\ui-contract\src\_*tests*_\nav-destinations.test.ts" "packages\ui-contract\src\_*tests*_\nav-visibility.test.ts" "packages\ui-contract\src\_*tests*_\runtime-policy.test.ts" "packages\ui-contract\src\index.ts" "packages\ui-contract\src\navigation.ts" "packages\ui-contract\src\runtime-policy.ts" "packages\ui\src\components\ui\accounting\tabs\BalanceSheetTab.tsx" "packages\ui\src\components\ui\accounting\tabs\IncomeStatementTab.tsx" "packages\ui\src\components\ui\accounting\tabs\TrialBalanceTab.tsx" "packages\ui\src\components\ui\assets\assets-view.tsx" "packages\ui\src\components\ui\assets\containers\assets-container.tsx" "packages\ui\src\components\ui\bank\bank-view.tsx" "packages\ui\src\components\ui\bank\containers\bank-container.tsx" "packages\ui\src\components\ui\budgets\budgets-view.tsx" "packages\ui\src\components\ui\budgets\containers\budgets-container.tsx" "packages\ui\src\components\ui\capability\capability-kit.tsx" "packages\ui\src\components\ui\expiry\containers\expiry-container.tsx" "packages\ui\src\components\ui\expiry\expiry-view.tsx" "packages\ui\src\components\ui\till\containers\till-container.tsx" "packages\ui\src\components\ui\till\till-view.tsx" "packages\ui\src\components\ui\timesheets\containers\timesheets-container.tsx" "packages\ui\src\components\ui\timesheets\timesheets-view.tsx" "packages\ui\src\index.ts" "packages\ui\src\lib\menu\nav-items.ts" "packages\ui\src\screens.ts" "packages\validation\src\index.ts" "packages\validation\src\schemas\accounting.schema.ts" "scripts\check-schema-drift.mjs" "scripts\run-migrations.mjs" "scripts\verify-rls.mjs" "scripts\verify-slice.mjs"
\**/_.{json,css,md} — 15 files
⋯ prettier --write ".claude\STATE.md" ".claude\architecture\core-modules.md" ".claude\architecture\performance-policy.md" ".claude\detail.md" ".claude\lessons-learned.md" ".claude\research\accounting-gap-analysis.md" ".claude\research\inventory-costing-gap-analysis.md" ".claude\research\payments-ar-ap-gap-analysis.md" ".claude\research\tier2-gap-analysis.md" "packages\i18n\messages\af\common.json" "packages\i18n\messages\en\common.json" "packages\i18n\messages\fa\common.json" "packages\i18n\src\locales\en.json" "packages\i18n\src\locales\fa-AF.json" "packages\i18n\src\locales\fa-IR.json"

✔ prettier --write ".claude\STATE.md" ".claude\architecture\core-modules.md" ".claude\architecture\performance-policy.md" ".claude\detail.md" ".claude\lessons-learned.md" ".claude\research\accounting-gap-analysis.md" ".claude\research\inventory-costing-gap-analysis.md" ".claude\research\payments-ar-ap-gap-analysis.md" ".claude\research\tier2-gap-analysis.md" "packages\i18n\messages\af\common.json" "packages\i18n\messages\en\common.json" "packages\i18n\messages\fa\common.json" "packages\i18n\src\locales\en.json" "packages\i18n\src\locales\fa-AF.json" "packages\i18n\src\locales\fa-IR.json"
✖ eslint --fix "add-all-695-keys.mjs" "add-all-missing-keys.mjs" "add-missing-keys.mjs" "apps\desktop\src\app\app.tsx" "apps\desktop\src\features\finance\assets-page.tsx" "apps\desktop\src\features\finance\bank-page.tsx" "apps\desktop\src\features\finance\budgets-page.tsx" "apps\desktop\src\features\finance\till-page.tsx" "apps\desktop\src\features\operations\expiry-page.tsx" "apps\desktop\src\features\operations\timesheets-page.tsx" "apps\mobile\app\assets.tsx" "apps\mobile\app\bank.tsx" "apps\mobile\app\budgets.tsx" "apps\mobile\app\expiry.tsx" "apps\mobile\app\till.tsx" "apps\mobile\app\timesheets.tsx" "apps\mobile\src\features\accounting\screens\accounting-screen.tsx" "apps\mobile\src\features\assets\screens\assets-screen.tsx" "apps\mobile\src\features\bank\screens\bank-screen.tsx" "apps\mobile\src\features\budgets\screens\budgets-screen.tsx" "apps\mobile\src\features\capability\capability-kit.tsx" "apps\mobile\src\features\expiry\screens\expiry-screen.tsx" "apps\mobile\src\features\till\screens\till-screen.tsx" "apps\mobile\src\features\timesheets\screens\timesheets-screen.tsx" "apps\mobile\src\shared\navigation\nav.ts" "apps\web\app\[lang]\(dashboard)\assets\page.tsx" "apps\web\app\[lang]\(dashboard)\bank\page.tsx" "apps\web\app\[lang]\(dashboard)\budgets\page.tsx" "apps\web\app\[lang]\(dashboard)\expiry\page.tsx" "apps\web\app\[lang]\(dashboard)\till\page.tsx" "apps\web\app\[lang]\(dashboard)\timesheets\page.tsx" "apps\web\next-env.d.ts" "backend\src\__tests__\accounting-ledger-rules.test.ts" "backend\src\__tests__\authorization-rules.test.ts" "backend\src\__tests__\branch-rules.test.ts" "backend\src\__tests__\constitution-guards.test.ts" "backend\src\__tests__\finance-gaps-rules.test.ts" "backend\src\__tests__\financial-flows-e2e.test.ts" "backend\src\__tests__\insights-rules.test.ts" "backend\src\__tests__\inventory-costing-rules.test.ts" "backend\src\__tests__\mdm-rules.test.ts" "backend\src\__tests__\offline-conflict-rules.test.ts" "backend\src\__tests__\payments-ar-ap-rules.test.ts" "backend\src\__tests__\personalization-rules.test.ts" "backend\src\__tests__\plugin-rules.test.ts" "backend\src\__tests__\pos-rules.test.ts" "backend\src\__tests__\rls-coverage.test.ts" "backend\src\__tests__\rules-engine-rules.test.ts" "backend\src\__tests__\sod-rules.test.ts" "backend\src\__tests__\tax-engine-rules.test.ts" "backend\src\__tests__\tenancy-static-guard.test.ts" "backend\src\__tests__\tier2-gaps-rules.test.ts" "backend\src\__tests__\traceability-rules.test.ts" "backend\src\__tests__\vertical-slice-integration.test.ts" "backend\src\index.ts" "backend\src\middleware\authorize.middleware.ts" "backend\src\middleware\branch.middleware.ts" "backend\src\routes\accounting.routes.ts" "backend\src\routes\audit.routes.ts" "backend\src\routes\billing.routes.ts" "backend\src\routes\branch.routes.ts" "backend\src\routes\conflict.routes.ts" "backend\src\routes\crm.routes.ts" "backend\src\routes\finance-ops.routes.ts" "backend\src\routes\governance.routes.ts" "backend\src\routes\human-resources.routes.ts" "backend\src\routes\intelligence.routes.ts" "backend\src\routes\inventory-costing.routes.ts" "backend\src\routes\invoice.routes.ts" "backend\src\routes\manufacturing.routes.ts" "backend\src\routes\operations.routes.ts" "backend\src\routes\payments.routes.ts" "backend\src\routes\personalization.routes.ts" "backend\src\routes\pos.routes.ts" "backend\src\routes\project.routes.ts" "backend\src\routes\purchasing.routes.ts" "backend\src\routes\rules.routes.ts" "backend\src\routes\supplier.routes.ts" "backend\src\routes\tax.routes.ts" "backend\src\routes\warehouse.routes.ts" "backend\src\services\accounting.service.ts" "backend\src\services\accounting\accounting.domain.ts" "backend\src\services\accounting\accounting.reports.ts" "backend\src\services\accounting\accounting.repository.ts" "backend\src\services\accounting\accounting.service.ts" "backend\src\services\accounting\index.ts" "backend\src\services\accounting\ledger.port.ts" "backend\src\services\accounting\operational-reports.ts" "backend\src\services\ai.service.ts" "backend\src\services\assets\assets.service.ts" "backend\src\services\assets\depreciation.domain.ts" "backend\src\services\assets\index.ts" "backend\src\services\audit.service.ts" "backend\src\services\authorization\authorization.domain.ts" "backend\src\services\authorization\index.ts" "backend\src\services\authorization\sod.domain.ts" "backend\src\services\authorization\sod.service.ts" "backend\src\services\banking\banking.service.ts" "backend\src\services\banking\index.ts" "backend\src\services\banking\reconciliation.domain.ts" "backend\src\services\billing.service.ts" "backend\src\services\branch\branch.domain.ts" "backend\src\services\branch\branch.service.ts" "backend\src\services\branch\index.ts" "backend\src\services\budgeting\budget.domain.ts" "backend\src\services\budgeting\budget.service.ts" "backend\src\services\budgeting\index.ts" "backend\src\services\conflict\conflict.domain.ts" "backend\src\services\conflict\conflict.service.ts" "backend\src\services\conflict\index.ts" "backend\src\services\crm.service.ts" "backend\src\services\currency\currency.service.ts" "backend\src\services\currency\index.ts" "backend\src\services\currency\revaluation.domain.ts" "backend\src\services\customer.service.ts" "backend\src\services\dimensions\dimension.domain.ts" "backend\src\services\dimensions\dimensions.service.ts" "backend\src\services\dimensions\index.ts" "backend\src\services\human-resources.service.ts" "backend\src\services\insights\index.ts" "backend\src\services\insights\insights.domain.ts" "backend\src\services\insights\insights.service.ts" "backend\src\services\inventory-costing\costing.domain.ts" "backend\src\services\inventory-costing\costing.port.ts" "backend\src\services\inventory-costing\costing.repository.ts" "backend\src\services\inventory-costing\costing.service.ts" "backend\src\services\inventory-costing\index.ts"
↓ eslint --fix "backend\src\services\inventory-costing\repost.domain.ts" "backend\src\services\invoice.service.ts" "backend\src\services\manufacturing.service.ts" "backend\src\services\mdm\index.ts" "backend\src\services\mdm\mdm.domain.ts" "backend\src\services\mdm\mdm.service.ts" "backend\src\services\payments\index.ts" "backend\src\services\payments\payments.domain.ts" "backend\src\services\payments\payments.repository.ts" "backend\src\services\payments\payments.service.ts" "backend\src\services\personalization\index.ts" "backend\src\services\personalization\visibility.domain.ts" "backend\src\services\personalization\visibility.service.ts" "backend\src\services\plugins\plugin.domain.ts" "backend\src\services\pos\index.ts" "backend\src\services\pos\pos.domain.ts" "backend\src\services\pos\pos.service.ts" "backend\src\services\project.service.ts" "backend\src\services\purchasing.service.ts" "backend\src\services\rules\index.ts" "backend\src\services\rules\rules.domain.ts" "backend\src\services\rules\rules.service.ts" "backend\src\services\supplier\index.ts" "backend\src\services\supplier\supplier.service.ts" "backend\src\services\sync.service.ts" "backend\src\services\tax\index.ts" "backend\src\services\tax\tax.domain.ts" "backend\src\services\tax\tax.service.ts" "backend\src\services\tax\tax.snapshot.ts" "backend\src\services\timesheets\billing.domain.ts" "backend\src\services\timesheets\index.ts" "backend\src\services\timesheets\timesheets.service.ts" "backend\src\services\traceability\index.ts" "backend\src\services\traceability\lot.domain.ts" "backend\src\services\traceability\traceability.service.ts" "backend\src\services\warehouse.service.ts" "find-missing-keys.mjs" "find_missing_keys.js" "packages\api\src\hooks\accounting.ts" "packages\api\src\hooks\assets.ts" "packages\api\src\hooks\bank.ts" "packages\api\src\hooks\budgets.ts" "packages\api\src\hooks\expiry.ts" "packages\api\src\hooks\index.ts" "packages\api\src\hooks\till.ts" "packages\api\src\hooks\timesheets.ts" "packages\api\src\index.ts" "packages\ui-contract\src\__tests__\nav-destinations.test.ts" "packages\ui-contract\src\__tests__\nav-visibility.test.ts" "packages\ui-contract\src\__tests__\runtime-policy.test.ts" "packages\ui-contract\src\index.ts" "packages\ui-contract\src\navigation.ts" "packages\ui-contract\src\runtime-policy.ts" "packages\ui\src\components\ui\accounting\tabs\BalanceSheetTab.tsx" "packages\ui\src\components\ui\accounting\tabs\IncomeStatementTab.tsx" "packages\ui\src\components\ui\accounting\tabs\TrialBalanceTab.tsx" "packages\ui\src\components\ui\assets\assets-view.tsx" "packages\ui\src\components\ui\assets\containers\assets-container.tsx" "packages\ui\src\components\ui\bank\bank-view.tsx" "packages\ui\src\components\ui\bank\containers\bank-container.tsx" "packages\ui\src\components\ui\budgets\budgets-view.tsx" "packages\ui\src\components\ui\budgets\containers\budgets-container.tsx" "packages\ui\src\components\ui\capability\capability-kit.tsx" "packages\ui\src\components\ui\expiry\containers\expiry-container.tsx" "packages\ui\src\components\ui\expiry\expiry-view.tsx" "packages\ui\src\components\ui\till\containers\till-container.tsx" "packages\ui\src\components\ui\till\till-view.tsx" "packages\ui\src\components\ui\timesheets\containers\timesheets-container.tsx" "packages\ui\src\components\ui\timesheets\timesheets-view.tsx" "packages\ui\src\index.ts" "packages\ui\src\lib\menu\nav-items.ts" "packages\ui\src\screens.ts" "packages\validation\src\index.ts" "packages\validation\src\schemas\accounting.schema.ts" "scripts\check-schema-drift.mjs" "scripts\run-migrations.mjs" "scripts\verify-rls.mjs" "scripts\verify-slice.mjs"
↓ prettier --write "add-all-695-keys.mjs" "add-all-missing-keys.mjs" "add-missing-keys.mjs" "apps\desktop\src\app\app.tsx" "apps\desktop\src\features\finance\assets-page.tsx" "apps\desktop\src\features\finance\bank-page.tsx" "apps\desktop\src\features\finance\budgets-page.tsx" "apps\desktop\src\features\finance\till-page.tsx" "apps\desktop\src\features\operations\expiry-page.tsx" "apps\desktop\src\features\operations\timesheets-page.tsx" "apps\mobile\app\assets.tsx" "apps\mobile\app\bank.tsx" "apps\mobile\app\budgets.tsx" "apps\mobile\app\expiry.tsx" "apps\mobile\app\till.tsx" "apps\mobile\app\timesheets.tsx" "apps\mobile\src\features\accounting\screens\accounting-screen.tsx" "apps\mobile\src\features\assets\screens\assets-screen.tsx" "apps\mobile\src\features\bank\screens\bank-screen.tsx" "apps\mobile\src\features\budgets\screens\budgets-screen.tsx" "apps\mobile\src\features\capability\capability-kit.tsx" "apps\mobile\src\features\expiry\screens\expiry-screen.tsx" "apps\mobile\src\features\till\screens\till-screen.tsx" "apps\mobile\src\features\timesheets\screens\timesheets-screen.tsx" "apps\mobile\src\shared\navigation\nav.ts" "apps\web\app\[lang]\(dashboard)\assets\page.tsx" "apps\web\app\[lang]\(dashboard)\bank\page.tsx" "apps\web\app\[lang]\(dashboard)\budgets\page.tsx" "apps\web\app\[lang]\(dashboard)\expiry\page.tsx" "apps\web\app\[lang]\(dashboard)\till\page.tsx" "apps\web\app\[lang]\(dashboard)\timesheets\page.tsx" "apps\web\next-env.d.ts" "backend\src\__tests__\accounting-ledger-rules.test.ts" "backend\src\__tests__\authorization-rules.test.ts" "backend\src\__tests__\branch-rules.test.ts" "backend\src\__tests__\constitution-guards.test.ts" "backend\src\__tests__\finance-gaps-rules.test.ts" "backend\src\__tests__\financial-flows-e2e.test.ts" "backend\src\__tests__\insights-rules.test.ts" "backend\src\__tests__\inventory-costing-rules.test.ts" "backend\src\__tests__\mdm-rules.test.ts" "backend\src\__tests__\offline-conflict-rules.test.ts" "backend\src\__tests__\payments-ar-ap-rules.test.ts" "backend\src\__tests__\personalization-rules.test.ts" "backend\src\__tests__\plugin-rules.test.ts" "backend\src\__tests__\pos-rules.test.ts" "backend\src\__tests__\rls-coverage.test.ts" "backend\src\__tests__\rules-engine-rules.test.ts" "backend\src\__tests__\sod-rules.test.ts" "backend\src\__tests__\tax-engine-rules.test.ts" "backend\src\__tests__\tenancy-static-guard.test.ts" "backend\src\__tests__\tier2-gaps-rules.test.ts" "backend\src\__tests__\traceability-rules.test.ts" "backend\src\__tests__\vertical-slice-integration.test.ts" "backend\src\index.ts" "backend\src\middleware\authorize.middleware.ts" "backend\src\middleware\branch.middleware.ts" "backend\src\routes\accounting.routes.ts" "backend\src\routes\audit.routes.ts" "backend\src\routes\billing.routes.ts" "backend\src\routes\branch.routes.ts" "backend\src\routes\conflict.routes.ts" "backend\src\routes\crm.routes.ts" "backend\src\routes\finance-ops.routes.ts" "backend\src\routes\governance.routes.ts" "backend\src\routes\human-resources.routes.ts" "backend\src\routes\intelligence.routes.ts" "backend\src\routes\inventory-costing.routes.ts" "backend\src\routes\invoice.routes.ts" "backend\src\routes\manufacturing.routes.ts" "backend\src\routes\operations.routes.ts" "backend\src\routes\payments.routes.ts" "backend\src\routes\personalization.routes.ts" "backend\src\routes\pos.routes.ts" "backend\src\routes\project.routes.ts" "backend\src\routes\purchasing.routes.ts" "backend\src\routes\rules.routes.ts" "backend\src\routes\supplier.routes.ts" "backend\src\routes\tax.routes.ts" "backend\src\routes\warehouse.routes.ts" "backend\src\services\accounting.service.ts" "backend\src\services\accounting\accounting.domain.ts" "backend\src\services\accounting\accounting.reports.ts" "backend\src\services\accounting\accounting.repository.ts" "backend\src\services\accounting\accounting.service.ts" "backend\src\services\accounting\index.ts" "backend\src\services\accounting\ledger.port.ts" "backend\src\services\accounting\operational-reports.ts" "backend\src\services\ai.service.ts" "backend\src\services\assets\assets.service.ts" "backend\src\services\assets\depreciation.domain.ts" "backend\src\services\assets\index.ts" "backend\src\services\audit.service.ts" "backend\src\services\authorization\authorization.domain.ts" "backend\src\services\authorization\index.ts" "backend\src\services\authorization\sod.domain.ts" "backend\src\services\authorization\sod.service.ts" "backend\src\services\banking\banking.service.ts" "backend\src\services\banking\index.ts" "backend\src\services\banking\reconciliation.domain.ts" "backend\src\services\billing.service.ts" "backend\src\services\branch\branch.domain.ts" "backend\src\services\branch\branch.service.ts" "backend\src\services\branch\index.ts" "backend\src\services\budgeting\budget.domain.ts" "backend\src\services\budgeting\budget.service.ts" "backend\src\services\budgeting\index.ts" "backend\src\services\conflict\conflict.domain.ts" "backend\src\services\conflict\conflict.service.ts" "backend\src\services\conflict\index.ts" "backend\src\services\crm.service.ts" "backend\src\services\currency\currency.service.ts" "backend\src\services\currency\index.ts" "backend\src\services\currency\revaluation.domain.ts" "backend\src\services\customer.service.ts" "backend\src\services\dimensions\dimension.domain.ts" "backend\src\services\dimensions\dimensions.service.ts" "backend\src\services\dimensions\index.ts" "backend\src\services\human-resources.service.ts" "backend\src\services\insights\index.ts" "backend\src\services\insights\insights.domain.ts" "backend\src\services\insights\insights.service.ts" "backend\src\services\inventory-costing\costing.domain.ts" "backend\src\services\inventory-costing\costing.port.ts" "backend\src\services\inventory-costing\costing.repository.ts" "backend\src\services\inventory-costing\costing.service.ts" "backend\src\services\inventory-costing\index.ts"
↓ prettier --write "backend\src\services\inventory-costing\repost.domain.ts" "backend\src\services\invoice.service.ts" "backend\src\services\manufacturing.service.ts" "backend\src\services\mdm\index.ts" "backend\src\services\mdm\mdm.domain.ts" "backend\src\services\mdm\mdm.service.ts" "backend\src\services\payments\index.ts" "backend\src\services\payments\payments.domain.ts" "backend\src\services\payments\payments.repository.ts" "backend\src\services\payments\payments.service.ts" "backend\src\services\personalization\index.ts" "backend\src\services\personalization\visibility.domain.ts" "backend\src\services\personalization\visibility.service.ts" "backend\src\services\plugins\plugin.domain.ts" "backend\src\services\pos\index.ts" "backend\src\services\pos\pos.domain.ts" "backend\src\services\pos\pos.service.ts" "backend\src\services\project.service.ts" "backend\src\services\purchasing.service.ts" "backend\src\services\rules\index.ts" "backend\src\services\rules\rules.domain.ts" "backend\src\services\rules\rules.service.ts" "backend\src\services\supplier\index.ts" "backend\src\services\supplier\supplier.service.ts" "backend\src\services\sync.service.ts" "backend\src\services\tax\index.ts" "backend\src\services\tax\tax.domain.ts" "backend\src\services\tax\tax.service.ts" "backend\src\services\tax\tax.snapshot.ts" "backend\src\services\timesheets\billing.domain.ts" "backend\src\services\timesheets\index.ts" "backend\src\services\timesheets\timesheets.service.ts" "backend\src\services\traceability\index.ts" "backend\src\services\traceability\lot.domain.ts" "backend\src\services\traceability\traceability.service.ts" "backend\src\services\warehouse.service.ts" "find-missing-keys.mjs" "find_missing_keys.js" "packages\api\src\hooks\accounting.ts" "packages\api\src\hooks\assets.ts" "packages\api\src\hooks\bank.ts" "packages\api\src\hooks\budgets.ts" "packages\api\src\hooks\expiry.ts" "packages\api\src\hooks\index.ts" "packages\api\src\hooks\till.ts" "packages\api\src\hooks\timesheets.ts" "packages\api\src\index.ts" "packages\ui-contract\src\__tests__\nav-destinations.test.ts" "packages\ui-contract\src\__tests__\nav-visibility.test.ts" "packages\ui-contract\src\__tests__\runtime-policy.test.ts" "packages\ui-contract\src\index.ts" "packages\ui-contract\src\navigation.ts" "packages\ui-contract\src\runtime-policy.ts" "packages\ui\src\components\ui\accounting\tabs\BalanceSheetTab.tsx" "packages\ui\src\components\ui\accounting\tabs\IncomeStatementTab.tsx" "packages\ui\src\components\ui\accounting\tabs\TrialBalanceTab.tsx" "packages\ui\src\components\ui\assets\assets-view.tsx" "packages\ui\src\components\ui\assets\containers\assets-container.tsx" "packages\ui\src\components\ui\bank\bank-view.tsx" "packages\ui\src\components\ui\bank\containers\bank-container.tsx" "packages\ui\src\components\ui\budgets\budgets-view.tsx" "packages\ui\src\components\ui\budgets\containers\budgets-container.tsx" "packages\ui\src\components\ui\capability\capability-kit.tsx" "packages\ui\src\components\ui\expiry\containers\expiry-container.tsx" "packages\ui\src\components\ui\expiry\expiry-view.tsx" "packages\ui\src\components\ui\till\containers\till-container.tsx" "packages\ui\src\components\ui\till\till-view.tsx" "packages\ui\src\components\ui\timesheets\containers\timesheets-container.tsx" "packages\ui\src\components\ui\timesheets\timesheets-view.tsx" "packages\ui\src\index.ts" "packages\ui\src\lib\menu\nav-items.ts" "packages\ui\src\screens.ts" "packages\validation\src\index.ts" "packages\validation\src\schemas\accounting.schema.ts" "scripts\check-schema-drift.mjs" "scripts\run-migrations.mjs" "scripts\verify-rls.mjs" "scripts\verify-slice.mjs"

✖ Failed to run tasks for staged files!
↓ Skipped staging changes from tasks…
⋯ Reverting to original state because of errors…
✔ Done reverting to original state!
⋯ Cleaning up temporary files…
✔ Done cleaning up temporary files!

✖ eslint --fix "add-all-695-keys.mjs" "add-all-missing-keys.mjs" "add-missing-keys.mjs" "apps\desktop\src\app\app.tsx" "apps\desktop\src\features\finance\assets-page.tsx" "apps\desktop\src\features\finance\bank-page.tsx" "apps\desktop\src\features\finance\budgets-page.tsx" "apps\desktop\src\features\finance\till-page.tsx" "apps\desktop\src\features\operations\expiry-page.tsx" "apps\desktop\src\features\operations\timesheets-page.tsx" "apps\mobile\app\assets.tsx" "apps\mobile\app\bank.tsx" "apps\mobile\app\budgets.tsx" "apps\mobile\app\expiry.tsx" "apps\mobile\app\till.tsx" "apps\mobile\app\timesheets.tsx" "apps\mobile\src\features\accounting\screens\accounting-screen.tsx" "apps\mobile\src\features\assets\screens\assets-screen.tsx" "apps\mobile\src\features\bank\screens\bank-screen.tsx" "apps\mobile\src\features\budgets\screens\budgets-screen.tsx" "apps\mobile\src\features\capability\capability-kit.tsx" "apps\mobile\src\features\expiry\screens\expiry-screen.tsx" "apps\mobile\src\features\till\screens\till-screen.tsx" "apps\mobile\src\features\timesheets\screens\timesheets-screen.tsx" "apps\mobile\src\shared\navigation\nav.ts" "apps\web\app\[lang]\(dashboard)\assets\page.tsx" "apps\web\app\[lang]\(dashboard)\bank\page.tsx" "apps\web\app\[lang]\(dashboard)\budgets\page.tsx" "apps\web\app\[lang]\(dashboard)\expiry\page.tsx" "apps\web\app\[lang]\(dashboard)\till\page.tsx" "apps\web\app\[lang]\(dashboard)\timesheets\page.tsx" "apps\web\next-env.d.ts" "backend\src\__tests__\accounting-ledger-rules.test.ts" "backend\src\__tests__\authorization-rules.test.ts" "backend\src\__tests__\branch-rules.test.ts" "backend\src\__tests__\constitution-guards.test.ts" "backend\src\__tests__\finance-gaps-rules.test.ts" "backend\src\__tests__\financial-flows-e2e.test.ts" "backend\src\__tests__\insights-rules.test.ts" "backend\src\__tests__\inventory-costing-rules.test.ts" "backend\src\__tests__\mdm-rules.test.ts" "backend\src\__tests__\offline-conflict-rules.test.ts" "backend\src\__tests__\payments-ar-ap-rules.test.ts" "backend\src\__tests__\personalization-rules.test.ts" "backend\src\__tests__\plugin-rules.test.ts" "backend\src\__tests__\pos-rules.test.ts" "backend\src\__tests__\rls-coverage.test.ts" "backend\src\__tests__\rules-engine-rules.test.ts" "backend\src\__tests__\sod-rules.test.ts" "backend\src\__tests__\tax-engine-rules.test.ts" "backend\src\__tests__\tenancy-static-guard.test.ts" "backend\src\__tests__\tier2-gaps-rules.test.ts" "backend\src\__tests__\traceability-rules.test.ts" "backend\src\__tests__\vertical-slice-integration.test.ts" "backend\src\index.ts" "backend\src\middleware\authorize.middleware.ts" "backend\src\middleware\branch.middleware.ts" "backend\src\routes\accounting.routes.ts" "backend\src\routes\audit.routes.ts" "backend\src\routes\billing.routes.ts" "backend\src\routes\branch.routes.ts" "backend\src\routes\conflict.routes.ts" "backend\src\routes\crm.routes.ts" "backend\src\routes\finance-ops.routes.ts" "backend\src\routes\governance.routes.ts" "backend\src\routes\human-resources.routes.ts" "backend\src\routes\intelligence.routes.ts" "backend\src\routes\inventory-costing.routes.ts" "backend\src\routes\invoice.routes.ts" "backend\src\routes\manufacturing.routes.ts" "backend\src\routes\operations.routes.ts" "backend\src\routes\payments.routes.ts" "backend\src\routes\personalization.routes.ts" "backend\src\routes\pos.routes.ts" "backend\src\routes\project.routes.ts" "backend\src\routes\purchasing.routes.ts" "backend\src\routes\rules.routes.ts" "backend\src\routes\supplier.routes.ts" "backend\src\routes\tax.routes.ts" "backend\src\routes\warehouse.routes.ts" "backend\src\services\accounting.service.ts" "backend\src\services\accounting\accounting.domain.ts" "backend\src\services\accounting\accounting.reports.ts" "backend\src\services\accounting\accounting.repository.ts" "backend\src\services\accounting\accounting.service.ts" "backend\src\services\accounting\index.ts" "backend\src\services\accounting\ledger.port.ts" "backend\src\services\accounting\operational-reports.ts" "backend\src\services\ai.service.ts" "backend\src\services\assets\assets.service.ts" "backend\src\services\assets\depreciation.domain.ts" "backend\src\services\assets\index.ts" "backend\src\services\audit.service.ts" "backend\src\services\authorization\authorization.domain.ts" "backend\src\services\authorization\index.ts" "backend\src\services\authorization\sod.domain.ts" "backend\src\services\authorization\sod.service.ts" "backend\src\services\banking\banking.service.ts" "backend\src\services\banking\index.ts" "backend\src\services\banking\reconciliation.domain.ts" "backend\src\services\billing.service.ts" "backend\src\services\branch\branch.domain.ts" "backend\src\services\branch\branch.service.ts" "backend\src\services\branch\index.ts" "backend\src\services\budgeting\budget.domain.ts" "backend\src\services\budgeting\budget.service.ts" "backend\src\services\budgeting\index.ts" "backend\src\services\conflict\conflict.domain.ts" "backend\src\services\conflict\conflict.service.ts" "backend\src\services\conflict\index.ts" "backend\src\services\crm.service.ts" "backend\src\services\currency\currency.service.ts" "backend\src\services\currency\index.ts" "backend\src\services\currency\revaluation.domain.ts" "backend\src\services\customer.service.ts" "backend\src\services\dimensions\dimension.domain.ts" "backend\src\services\dimensions\dimensions.service.ts" "backend\src\services\dimensions\index.ts" "backend\src\services\human-resources.service.ts" "backend\src\services\insights\index.ts" "backend\src\services\insights\insights.domain.ts" "backend\src\services\insights\insights.service.ts" "backend\src\services\inventory-costing\costing.domain.ts" "backend\src\services\inventory-costing\costing.port.ts" "backend\src\services\inventory-costing\costing.repository.ts" "backend\src\services\inventory-costing\costing.service.ts" "backend\src\services\inventory-costing\index.ts":

C:\Users\hamed\Desktop\hisabche\add-all-missing-keys.mjs
63:9 error 'segment' is assigned a value but never used @typescript-eslint/no-unused-vars

C:\Users\hamed\Desktop\hisabche\add-missing-keys.mjs
31:66 error Duplicate key 'fa' no-dupe-keys

C:\Users\hamed\Desktop\hisabche\apps\mobile\src\features\accounting\screens\accounting-screen.tsx
37:11 warning 't' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
111:3 warning 'sign' is defined but never used. Allowed unused args must match /^_|^event$/u
   @typescript-eslint/no-unused-vars
  112:3   warning  'currency' is defined but never used. Allowed unused args must match /^_|^event$/u @typescript-eslint/no-unused-vars
143:30 warning 'loading' is defined but never used. Allowed unused args must match /^_|^event$/u
   @typescript-eslint/no-unused-vars
  172:3   warning  'loading' is defined but never used. Allowed unused args must match /^_|^event$/u
@typescript-eslint/no-unused-vars
174:3 warning 'currency' is defined but never used. Allowed unused args must match /^_|^event$/u  @typescript-eslint/no-unused-vars
  209:3   warning  'loading' is defined but never used. Allowed unused args must match /^_|^event$/u
@typescript-eslint/no-unused-vars
248:3 warning 'loading' is defined but never used. Allowed unused args must match /^_|^event$/u
@typescript-eslint/no-unused-vars

C:\Users\hamed\Desktop\hisabche\apps\mobile\src\features\bank\screens\bank-screen.tsx
59:7 warning Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:

- Update external systems with the latest state from React.
- Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

C:\Users\hamed\Desktop\hisabche\apps\mobile\src\features\bank\screens\bank-screen.tsx:59:7
57 | useEffect(() => {
58 | if (selectedId == null && statements.data && statements.data.length > 0) {

> 59 | setSelectedId(statements.data[0]!.id)
> | ^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
> 60 | }
> 61 | }, [selectedId, statements.data])
> 62 | react-hooks/set-state-in-effect

C:\Users\hamed\Desktop\hisabche\backend\src\__tests__\plugin-rules.test.ts
134:13 warning 'dataEgress' is assigned a value but never used. Allowed unused vars must match /^_/u @typescript-eslint/no-unused-vars

C:\Users\hamed\Desktop\hisabche\backend\src\index.ts
137:16 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
148:43 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
155:26 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
164:27 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
165:32 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
172:46 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
294:24 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
418:34 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\accounting.routes.ts
36:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\audit.routes.ts
38:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\billing.routes.ts
15:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\branch.routes.ts
21:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\conflict.routes.ts
24:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\crm.routes.ts
21:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\finance-ops.routes.ts
32:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\governance.routes.ts
23:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\human-resources.routes.ts
25:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\intelligence.routes.ts
25:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\inventory-costing.routes.ts
24:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\invoice.routes.ts
49:78 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
51:21 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
73:21 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
90:38 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
91:30 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
119:36 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
131:44 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
169:21 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
187:38 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
202:36 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
223:21 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
255:36 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
270:21 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\manufacturing.routes.ts
19:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\operations.routes.ts
23:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\payments.routes.ts
24:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\personalization.routes.ts
23:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\pos.routes.ts
29:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\project.routes.ts
22:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\purchasing.routes.ts
14:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\rules.routes.ts
23:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\supplier.routes.ts
22:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\tax.routes.ts
26:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\routes\warehouse.routes.ts
19:31 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\accounting\accounting.repository.ts
60:41 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
74:39 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
87:56 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
407:50 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\accounting\accounting.service.ts
478:34 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\ai.service.ts
10:10 warning 'DatabaseError' is defined but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
20:24 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
116:60 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
118:19 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
119:30 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
120:60 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
121:68 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
164:42 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
165:44 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
166:58 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
172:38 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
176:40 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
234:16 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
239:19 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
240:17 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
240:25 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
249:18 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
404:30 warning 'userId' is defined but never used. Allowed unused args must match /^_|^event$/u
   @typescript-eslint/no-unused-vars
  404:46  warning  'question' is defined but never used. Allowed unused args must match /^_|^event$/u @typescript-eslint/no-unused-vars
462:44 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
477:15 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
493:24 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
510:26 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
514:28 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
531:46 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
535:20 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
550:26 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
568:47 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\assets\assets.service.ts
43:39 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
207:29 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
268:71 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
301:71 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\audit.service.ts
13:7 warning 'AUDIT_LOG_COLUMNS' is assigned a value but never used. Allowed unused vars must match /^_/u @typescript-eslint/no-unused-vars

C:\Users\hamed\Desktop\hisabche\backend\src\services\banking\banking.service.ts
22:38 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
67:50 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\billing.service.ts
557:11 warning 'cacheKey' is assigned a value but never used. Allowed unused vars must match /^_/u @typescript-eslint/no-unused-vars
629:32 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\branch\branch.service.ts
24:40 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\budgeting\budget.service.ts
29:40 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
141:20 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\conflict\conflict.service.ts
45:42 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\crm.service.ts
35:45 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
72:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
82:21 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
138:53 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
199:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
317:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
388:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
397:22 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any
566:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
580:75 warning Unexpected any. Specify a different type
@typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\customer.service.ts
58:42 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\dimensions\dimensions.service.ts
239:39 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\human-resources.service.ts
79:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
122:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
147:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
169:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
241:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
270:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
318:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
351:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
407:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
430:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars
451:26 warning 'userId' is assigned a value but never used. Allowed unused vars must match /^_/u
@typescript-eslint/no-unused-vars

C:\Users\hamed\Desktop\hisabche\backend\src\services\insights\insights.service.ts
175:28 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
177:61 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
178:40 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
243:66 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

C:\Users\hamed\Desktop\hisabche\backend\src\services\inventory-costing\costing.repository.ts
43:39 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
196:50 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

✖ 130 problems (2 errors, 128 warnings)

husky - pre-commit script failed (code 1)

hamed@MSI MINGW64 ~/Desktop/hisabche (main)
$ git push
Everything up-to-date

hamed@MSI MINGW64 ~/Desktop/hisabche (main)
$
