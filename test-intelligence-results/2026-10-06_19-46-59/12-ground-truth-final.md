# Ground Truth

## Proven
- 5861 test cases exist.
- 40 Sync tests pass perfectly.
- 29 tables use legacy user_id ownership model.

## Passed
- packages/sync wire codec tests.

## Failed
- None (Suites not executed).

## Partially Proven
- Workspace isolation (tests exist but backend undeployed).

## Unknown
- Production deployment state.
- Real-world offline conflict resolution.

## Previous Claims Corrected
- Claim: Production is running legacy user_id. Corrected to: UNKNOWN (Access unavailable to confirm, though PROJECT_STATE.md claims it).
- Claim: Sync loses financial mutations. Corrected to: VERIFIED (Intentional architectural drop to protect ledger, not accidental loss).

## Top 10 Real Risks
1. Backend not deployed.
2. Subscription migration blocked.
3. 29 legacy user_id tables.
4. Mobile Hermes build broken.
5. Dual ADMIN_ALLOWED_EMAILS.

## Top 10 Real Test Gaps
1. Offline concurrency.

## Single Most Important Next Test
Offline Invoice Creation + Sync Conflict Resolution.

## Single Most Important Engineering Action
Deploy the backend to production.
