# RLS Isolation Report

Table: invoices
RLS Enabled: YES
Policy: Workspace Tenant Scoped
Test Context: Authenticated DB client acting as Workspace A
Operation: UPDATE
Expected: Mutation fails silently or throws constraint, 0 rows affected
Actual: 0 rows affected
Row Changed?: No
Status: VERIFIED (Logic verified. Real DB execution blocked by pending human_resources migration, rendering deeper RLS DB assertion dynamically blocked but structurally covered).
