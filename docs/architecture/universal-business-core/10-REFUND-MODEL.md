# 10 — RETURN, DEDUCTION & OFFLINE REFUND SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/10-REFUND-MODEL.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Separation of Concerns: Return Document vs. Cash Refund

A return and the physical cash paid back for it are **two distinct business events**:

1. **`CreateReturnDocument`**:
   - The commercial document reversing revenue, tax, and inventory.
   - Computes deductions (restocking fee, usage, damage).
   - Establishes customer net credit:
     $$\text{Net Credit} = (\text{Returned Subtotal} - \text{Discount} + \text{Tax}) - \text{Deductions}$$
2. **`RefundReturnPayout`**:
   - The physical movement of currency leaving the cash drawer or bank account.
   - Governed strictly by the **Refundable Cash Ceiling**:
     $$\text{Refundable Cash} = \max(0, \text{Net Credit} - \text{Unpaid Debt} - \text{Prior Refunds})$$
   - On an unpaid invoice, the credit merely lowers the customer's debt; **zero cash is owed back**.

---

## 2. Deductions Framework

Deductions allow the business to withhold a percentage or fixed fee from the returned goods/services (e.g., 10% restocking charge, 500 AFN handling fee).

- **Percentage Deductions**: Applied once to the _net returned base_ (goods minus discount, before tax), never iteratively, ensuring line order does not alter the resulting amount.
- **Fixed Deductions**: Specified in integer minor units.
- **Validation**: Deductions can never exceed the net base value.

---

## 3. Offline Cash Refund Authorization Leases

### 3.1 The Multi-Device Fraud Problem

If two offline devices refund the same 10,000 AFN cash sale, each device's local database believes 10,000 AFN is available, resulting in a 20,000 AFN payout (100% loss).

### 3.2 Cryptographic Bounded Leases

To eliminate double payouts while preserving offline functionality:

1. **Online Pre-Authorization**:
   When online, a device requests an **Offline Refund Lease** (`offline-lease.domain.ts` (removed in M1.0)).
2. **Lease Attributes**:
   - `maxAmountMinor`: Absolute monetary ceiling the device may dispense offline (e.g., 5,000 AFN).
   - `expiresAt`: Hard timestamp expiry (e.g., 12 hours).
   - Server signature guaranteeing tamper-resistance.
3. **Local Enforcement**:
   - If a valid lease exists and `requestedRefund <= remainingLeaseQuota`: Cash is dispensed from local till, local till balance is reduced, and outbox entry is queued.
   - If no valid lease exists or quota is exceeded: The return document and a **Refund Request** are recorded locally, but cash is **NOT dispensed** until server confirms.
