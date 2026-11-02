# 08 — PACKAGE CREDIT LEDGER & DEFERRED REVENUE SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/08-PACKAGE-CREDIT-LEDGER.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Business Concept: Prepaid Packages & Sessions

A service business (e.g. language tutoring, physiotherapy clinic, fitness coaching, auto maintenance package) frequently sells prepaid bundles:

- Example: _Customer purchases a 10-session English course for 10,000 AFN._
- Financial reality: Cash is collected immediately (10,000 AFN), but revenue is **NOT yet earned**.
- Accounting truth: 10,000 AFN is credited to **Unearned Revenue (Deferred Liability)**.
- Delivery truth: Customer receives an entitlement of **10 service credits**.
- As sessions are delivered: For each session redeemed, 1,000 AFN moves from _Unearned Revenue_ to _Service Revenue_.

---

## 2. Package Credit Ledger Schema

```typescript
export interface PackageCreditAccount {
  readonly id: string
  readonly workspaceId: string
  readonly customerId: string
  readonly packageOfferingId: string
  readonly originalInvoiceId: string
  readonly totalCreditsGranted: number // e.g. 10
  readonly creditsRedeemed: number // e.g. 4
  readonly creditsRemaining: number // total - redeemed = 6
  readonly unitValueMinor: number // Total minor / total credits (e.g. 1,000 AFN)
  readonly currency: string
  readonly expiresAt: string // ISO UTC timestamp
  readonly status: 'active' | 'exhausted' | 'expired' | 'refunded'
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PackageCreditMovement {
  readonly id: string
  readonly workspaceId: string
  readonly packageCreditId: string
  readonly type: 'grant' | 'redemption' | 'expiration_forfeit' | 'refund_revocation'
  readonly creditDelta: number // Positive for grant, negative for redemption
  readonly deliverySessionId?: string | undefined
  readonly revenueRecognizedMinor: number
  readonly timestamp: string
  readonly outboxClientId: string
}
```

---

## 3. Operation Lifecycle & Multi-Ledger Matrix (Updated 2 Nov 2026 per Owner Decisions M5-1, M5-2, M5-4, OD-5)

| Action                             | Operational Effect                                                    | Payment / Cash Effect                     | Credit Ledger Effect                                   | Accounting Journal Entry                                                                                      |
| :--------------------------------- | :-------------------------------------------------------------------- | :---------------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **1. Package Purchase**            | Issues `PackageCreditAccount`                                         | Cash/Receivable debited for invoice total | $+N$ credits added to customer balance (`GRANT`)       | **Debit**: Accounts Receivable (Total)<br>**Credit**: Deferred Revenue (Net)<br>**Credit**: Tax (Tax portion) |
| **2. Session Delivery**            | Records `ServiceDeliverySession`                                      | Zero cash movement                        | $-1$ credit deducted from customer balance (`CONSUME`) | **Debit**: Deferred Revenue (Unit value)<br>**Credit**: Sales Revenue (Unit value)                            |
| **3. Term End / Suspended (OD-5)** | Status $\rightarrow$ `suspended` (cannot consume until renewed)       | Zero cash movement                        | Unused credits KEPT; cannot consume until renewed      | **No accounting entry** (no forfeit, no breakage; liability remains on the books)                             |
| **4. Package Refund (M5-2)**       | **NOT OFFERED** (Owner decision M5-2: «نه هیچ بازپرداختی وجود ندارد») | Zero cash movement                        | No refund entry type exists                            | **No refund entry**                                                                                           |

---

## 4. Offline Redemption & Anti-Overdraw Rules

1. **Local Authoritative Cache**:
   The edge device holds the customer's `creditsRemaining` count in local SQLite.
2. **Atomic Session Write**:
   $$\text{Insert Delivery Session} + \text{Decrement local creditsRemaining} + \text{Queue Outbox} \in \text{Single SQLite Transaction}$$
3. **Multi-Device Concurrent Overdraw Guard**:
   If a customer attends two branches simultaneously and exhausts more credits than owned:
   - Server processes outbox pushes in timestamp order (`effectiveAt`).
   - The redemption that drives remaining credits $< 0$ transitions the excess delivery session to `BILLABLE_OVERAGE`, automatically creating an accounts receivable debit on the customer's account for human review.
   - **No session data is lost or deleted.**
