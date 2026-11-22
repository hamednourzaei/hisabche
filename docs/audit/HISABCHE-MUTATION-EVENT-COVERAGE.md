# Hisabche — Mutation → Event Coverage

**Date:** 22 Nov 2026
**Scope:** the mutations touched by the cross-domain mandate, plus the shared event pipeline they
use.
**Companion:** `HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md`.

This document separates four responsibilities that are easy to conflate. They are **not** four names
for the same row.

| Responsibility   | Storage                                                     | Written by                                                 | Question it answers                     |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| **Domain event** | no separate table; the `logBusinessEvent` call is the event | the service that performed the mutation                    | «what happened in the business?»        |
| **Audit**        | `audit_logs`                                                | `AuditService.log` inside `logBusinessEvent`               | «who changed this record, and to what?» |
| **Activity**     | `activities`                                                | `ActivityService.createActivity`                           | «what did the team do lately?»          |
| **Notification** | `notifications`                                             | `NotificationService.create`, only when `notify !== false` | «does this person need a bell?»         |
| **Outbox**       | `webhook_deliveries`                                        | `developerService.emitEvent` inside `logBusinessEvent`     | «which external system must be told?»   |

`logBusinessEvent` (`backend/src/services/event-log.service.ts:163`) fans one call out to the audit
row, the activity row, the optional bell row and (when the action is in the public catalogue) the
webhook outbox. It is fire-and-forget: the business write has already committed, and a logging
failure must never turn a stored invoice into an HTTP error.

---

## 1. Coverage registry (audited domains)

Legend: ✅ written by the service · — not written · `n/a` not applicable to that event.

| #   | Mutation                                  | Route / entry point                                   | Event `action`                                                                                                   | Audit | Activity | Bell               | Outbox           | Evidence                                                      |
| --- | ----------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----- | -------- | ------------------ | ---------------- | ------------------------------------------------------------- |
| 1   | Create invoice                            | `POST /api/invoices`                                  | `created`                                                                                                        | ✅    | ✅       | — (`notify:false`) | ✅ if catalogued | `invoice.service.ts:1539-1550`                                |
| 2   | Override credit limit                     | invoice create path                                   | `credit_limit_overridden`                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | `invoice.service.ts:1557-1562`                                |
| 3   | Update / cancel invoice                   | `PATCH /api/invoices/:id`                             | `updated` / `cancelled`                                                                                          | ✅    | ✅       | —                  | ✅ if catalogued | `invoice.service.ts:2111-2119`                                |
| 4   | Delete invoice (reversal)                 | `DELETE /api/invoices/:id`                            | `deleted`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | `invoice.service.ts:2185-2190`                                |
| 5   | Record invoice cost                       | cost path                                             | `cost_recorded`                                                                                                  | ✅    | ✅       | —                  | ✅ if catalogued | `invoice.service.ts:4408-4413`                                |
| 6   | Post invoice to ledger                    | ledger path                                           | `posted_to_ledger`                                                                                               | ✅    | ✅       | —                  | ✅ if catalogued | `invoice.service.ts:4510-4515`                                |
| 7   | Record payment (+ each allocated invoice) | payment create                                        | `payment_recorded`                                                                                               | ✅    | ✅       | —                  | ✅ if catalogued | `payments.service.ts:438`                                     |
| 8   | Cancel payment                            | payment cancel                                        | `cancelled`                                                                                                      | ✅    | ✅       | —                  | ✅ if catalogued | `payments.service.ts:808`                                     |
| 9   | Create advance / deposit                  | `POST /api/advances`, `POST /api/orders/:id/deposits` | `<kind>_recorded` (`pre_sale_recorded`, `pre_purchase_recorded`, `deposit_recorded`, `service_session_recorded`) | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `order-deposit.service.ts:587-635`                   |
| 10  | Finalize an unposted receipt              | `POST /api/orders/:id/deposits/:depositId/post`       | `receipt_posted`                                                                                                 | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `order-deposit.service.ts:562-580`; only on `posted` |
| 11  | Create customer                           | `POST /api/customers`                                 | `created`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | `customer.service.ts:705-713`                                 |
| 12  | Create product                            | `POST /api/products`                                  | `created`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | `product.service.ts:486-495`                                  |
| 13  | Record contract deposit                   | contract deposit path                                 | `contract_deposit_recorded`                                                                                      | ✅    | ✅       | —                  | ✅ if catalogued | `contracts.service.ts:124-132`                                |
| 14  | SLA breach                                | contract job                                          | `contract_sla_breached`                                                                                          | ✅    | ✅       | ✅ (`notify:true`) | ✅ if catalogued | `contracts.service.ts:314-326`                                |
| 15  | Lease asset returned                      | lease return                                          | `lease_asset_returned`                                                                                           | ✅    | ✅       | —                  | ✅ if catalogued | `contracts.service.ts:368-380`                                |
| 16  | Create service session                    | `POST /api/service-delivery/sessions`                 | `service_session_created`                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `service-delivery.service.ts:249`                    |
| 17  | Move session status                       | session move route                                    | `service_session_status_moved`                                                                                   | ✅    | ✅       | —                  | ✅ if catalogued | `service-delivery.service.ts:424`                             |
| 18  | Deliver session                           | deliver route                                         | `service_session_delivered`                                                                                      | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `service-delivery.service.ts:361`                    |
| 19  | Cancel session                            | cancel route                                          | `service_session_cancelled`                                                                                      | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `service-delivery.service.ts:409`                    |
| 20  | Update customer                           | `PUT /api/customers/:id`                              | `updated`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `customer.service.ts:795`                            |
| 21  | Delete customer                           | `DELETE /api/customers/:id`                           | `deleted`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `customer.service.ts:840`                            |
| 22  | Update product                            | `PUT /api/products/:id`                               | `updated`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `product.service.ts:800`                             |
| 23  | Delete product                            | `DELETE /api/products/:id`                            | `deleted`                                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `product.service.ts:881`                             |
| 24  | Apply deposit/advance                     | `POST .../apply`                                      | `deposit_applied` / `advance_applied`                                                                            | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `order-deposit.service.ts:712,746`                   |
| 25  | Refund deposit/advance                    | `POST .../refund`                                     | `deposit_refunded` / `advance_refunded`                                                                          | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `order-deposit.service.ts:806`                       |
| 26  | Create contract                           | `POST /api/contracts`                                 | `contract_created`                                                                                               | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `contracts.service.ts:124`                           |
| 27  | Bill contract period                      | `POST /api/contracts/:id/bill`                        | `contract_period_billed`                                                                                         | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `contracts.service.ts:251`                           |
| 28  | Terminate contract                        | `POST /api/contracts/:id/terminate`                   | `contract_terminated`                                                                                            | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `contracts.service.ts:280`                           |
| 29  | Create repair ticket                      | `POST /api/repair/tickets`                            | `repair_ticket_created`                                                                                          | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `repair-ticket.service.ts:333`                       |
| 30  | Move repair ticket status                 | `POST /api/repair/tickets/:id/move`                   | `repair_ticket_moved`                                                                                            | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `repair-ticket.service.ts:383`                       |
| 31  | QA check repair ticket                    | `POST /api/repair/tickets/:id/quality-check`          | `repair_ticket_quality_checked`                                                                                  | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `repair-ticket.service.ts:230`                       |
| 32  | Reserve repair part                       | `POST /api/repair/tickets/:id/parts`                  | `repair_part_reserved`                                                                                           | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `repair-ticket.service.ts:510`                       |
| 33  | Bill repair ticket                        | `POST /api/repair/tickets/:id/bill`                   | `repair_ticket_billed`                                                                                           | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `repair-ticket.service.ts:778`                       |
| 34  | Create salon resource                     | `POST /api/salon/resources`                           | `salon_resource_created`                                                                                         | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `salon.service.ts:117`                               |
| 35  | Update salon resource                     | `PATCH /api/salon/resources/:id`                      | `salon_resource_updated`                                                                                         | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `salon.service.ts:153`                               |
| 36  | Set salon commission rate                 | `POST /api/salon/commission-rates`                    | `salon_commission_rate_set`                                                                                      | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `salon.service.ts:287`                               |
| 37  | Book salon resource                       | `POST /api/salon/bookings`                            | `salon_resource_booked`                                                                                          | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `salon.service.ts:497`                               |
| 38  | Release salon resource booking            | `POST /api/salon/bookings/:id/release`                | `salon_resource_released`                                                                                        | ✅    | ✅       | —                  | ✅ if catalogued | **new**: `salon.service.ts:526`                               |

### 1.1 Replay discipline (why these are not double-logged)

| Mutation         | Replay path                                  | Guard                                                        |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Advance create   | `findForReplay` returns the existing deposit | `recorded()` is called only on a fresh write                 |
| Receipt finalize | ledger answers `already_posted`              | `postReceipt` logs only when `status === 'posted'`           |
| Session create   | `findForReplay` / `23505` winner             | logging is after the successful insert only                  |
| Session deliver  | session already `delivered`                  | `if (session.status !== 'delivered')`                        |
| Session cancel   | session was already `cancelled`              | compares the status **before** the RPC with the status after |
| Session move     | one conditional `UPDATE`                     | the existing code logs only when a row matched               |

---

## 2. Gaps resolved in continuation audit & remaining boundaries

The six major domains flagged in the initial pass have now been wired with canonical `logBusinessEvent` emissions:

- **Repair tickets:** Create, Move, QA check, Part reserve, and Final billing are all emitted.
- **Salon resources & bookings:** Resource create/update, Provider commission rate upsert, Resource booking and release are all emitted.
- **Customer lifecycle:** Update and Delete now emit business events with proper audit trails.
- **Product lifecycle:** Update and Delete now emit business events with product name tracking.
- **Contracts:** Contract creation, Periodic invoice billing, and Termination now emit business events.
- **Deposits & Advances:** Apply to invoice (customer & supplier) and Refund (customer & supplier) now emit business events.

Remaining gaps intentionally bounded:

- Direct raw stock inventory movements (handled at SQL trigger / ledger level rather than app-level event bus).
- Granular CRM sub-actions (e.g., outreach batch status notes).

---

## 3. Outbox delivery (webhook) — what is actually guaranteed

`developerService.emitEvent` (`backend/src/services/developer/developer.service.ts:543`) resolves the
action against the public catalogue (`publicEventFor`). An action outside the catalogue returns 0 and
writes nothing — the internal vocabulary and the public API vocabulary are deliberately separate.

When catalogued, the event is enqueued through the database function
`public.enqueue_webhook_event` (`docs/developer-platform-migration.sql`), which inserts one
`webhook_deliveries` row per active endpoint subscribed to the type and relies on the
`webhook_deliveries_once` constraint:

```sql
INSERT INTO public.webhook_deliveries (...)
SELECT ...
  ON CONFLICT ON CONSTRAINT webhook_deliveries_once DO NOTHING;
```

So:

- **Transport idempotency:** the same event id cannot create two rows for the same endpoint.
- **Not business idempotency:** the event id is generated inside `emitEvent` (`randomUUID`). If a
  service emits twice for one business change, two event ids exist and the consumer receives two
  deliveries. The replay guards in §1.1 are the only thing preventing that today.
- **Claims:** `claim_webhook_deliveries` uses `FOR UPDATE SKIP LOCKED` with a worker id and a lease;
  a worker that dies leaves a lease that expires and the row is retried while attempts remain.
- **Retry:** `webhookRetryDelaySeconds(attempts)` backs off; after `max_attempts` the delivery ends
  `failed` and an endpoint that keeps failing is switched off.
- **Replay:** `replay_webhook_deliveries` requeues an endpoint's finished deliveries inside a bounded
  window; it is granted to no client role.
- **Delivery semantics:** at-least-once. A consumer must dedupe on the envelope `id` (and should key
  its own work on the business identity).

---

## 4. What would make this end-to-end verifiable

1. A real Postgres run of the domain mutation, asserting one `audit_logs` row, one `activities` row,
   zero `notifications` rows for `notify:false`, and one `webhook_deliveries` row per subscribed
   endpoint.
2. A second identical request, asserting the row counts do not grow (the replay guards).
3. A delivery drain against a stub endpoint, asserting the claim/lease/retry path and the
   `webhook_deliveries_once` constraint.

None of the three was run here: embedded Postgres cannot start on this machine (shared-memory error
1314), and no live workspace was touched. Status: `IMPLEMENTED_NOT_LIVE_VERIFIED` for the pipeline,
`NOT_IMPLEMENTED` for the untested consumer-side dedupe.

---

## 5. Rules for adding a mutation

1. The service that commits the write emits the event — not the route, not the UI.
2. Choose an action in the existing vocabulary; `created` maps to audit `create`, `deleted` to
   `delete`, everything else to `update`.
3. `notify: false` unless the recipient is a different person who must act.
4. Emit after the write, never before, and never on a replay branch.
5. If the action must reach an integrator, add it to the public catalogue; otherwise it stays
   internal and `emitEvent` ignores it.
6. Fire-and-forget with `.catch(...)`; logging must not fail the business operation.
