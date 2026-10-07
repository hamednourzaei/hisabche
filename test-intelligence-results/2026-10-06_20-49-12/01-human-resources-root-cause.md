# Diagnosis of human_resources Error

## 1. Evidence Chain
- **Reference**: User reported: `Error: Failed to run sql query: ERROR: 42P01: relation "human_resources" does not exist`.
- **Expected Table vs Schema Reality**: In the Hisabche repository, there is **NO table named human_resources**.
- **Canonical HR Tables**:
  - `departments` (defined in `docs/base-schema-migration.sql:210`, `docs/SETUP-COMPLETE.sql:300`)
  - `employees` (defined in `docs/base-schema-migration.sql:224`, `docs/SETUP-COMPLETE.sql:314`)
  - `attendance` (defined in `docs/SETUP-COMPLETE.sql`, migrated in `docs/attendance-01-migration.sql`)
  - `payrolls` (defined in `docs/SETUP-COMPLETE.sql`, migrated in `docs/phase-j-04-payroll-ledger-migration.sql`)
  - `leaves` (defined in `docs/SETUP-COMPLETE.sql`)
  - `employee_branch_assignments` (referenced in `backend/src/services/human-resources.service.ts:38-42`)
- **Service Layer Evidence**:
  `backend/src/services/human-resources.service.ts` queries:
  `supabase.from('departments')`, `supabase.from('employees')`, `supabase.from('attendance')`, `supabase.from('payrolls')`.
  It never queries `supabase.from('human_resources')`.
- **Root Cause Conclusion**:
  The failure is an external/manual query mismatch. A client or developer attempted a query using the feature name (`human_resources`) rather than the underlying relational tables (`departments` or `employees`). The repository's migration files and schema are consistent and do not define a `human_resources` table.
- **Resolution**:
  No schema alteration is needed for `human_resources` because the schema intentionally models HR via `departments`, `employees`, `attendance`, and `payrolls`.
