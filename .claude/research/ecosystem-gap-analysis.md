# Ecosystem gap analysis: integrations, developer platform, automation

Written 27 Sep 2026. Compares Hisabche with Odoo, Business Central, ERPNext, QuickBooks Online, Xero and Zoho Books.
The comparison covers patterns only. No code, text or UI was copied.

## 1. What the competitors do (patterns)

| Capability         | Pattern seen                                                                                     | Where                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| API credential     | A per-user API key that inherits the user's rights, with a description and a lifetime            | Odoo external API                                                                           |
| API credential     | OAuth 2 apps with scopes (accounting.transactions, …)                                            | Xero, QuickBooks, Business Central                                                          |
| Webhook signature  | HMAC-SHA256 of the **body only**. Proves who sent it but not when, so a delivery can be replayed | Xero `x-xero-signature`, QuickBooks `intuit-signature`, Frappe `X-Frappe-Webhook-Signature` |
| Webhook validation | A handshake with a validation token; the subscription expires                                    | Business Central                                                                            |
| Webhook opt-in     | "Intent to receive": the endpoint must answer a test before it goes live                         | Xero                                                                                        |
| Payload            | Thin notifications: the entity plus its id; the receiver fetches the record                      | QuickBooks, Xero, Business Central                                                          |
| Automation         | Workflow rules, webhooks, custom functions                                                       | Zoho Books                                                                                  |

Sources:
[Xero webhooks](https://developer.xero.com/documentation/guides/webhooks/overview/) ·
[Intuit webhooks](https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks) ·
[Odoo external API](https://www.odoo.com/documentation/18.0/developer/reference/external_api.html) ·
[Business Central webhooks](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/dynamics-subscriptions) ·
[Frappe webhooks](https://docs.frappe.io/framework/user/en/guides/integration/webhooks) ·
[Zoho Books automation](https://www.zoho.com/books/help/settings/automation.html)

## 2. What Hisabche had

- **Inbound Stripe webhooks only** (`webhook.service.ts`, billing). Nothing went out.
- **`plugin.domain.ts`** defined scopes, a closed set of forbidden capabilities and `resolveGrant`, but nothing called any of it (CLAUDE.md §7.1).
- **Swagger** was already at `/docs` with `bearerAuth`.
- **Bank reconciliation** had a backend, an import endpoint and a hook (`useImportStatement`). No screen called the hook. The empty state told people to import a statement that nothing could import (§7.1, §7.5).
- **Security finding:** only 22 of 54 route files check a capability; the rest check membership only. So an API key could not be made safe by narrowing capabilities alone. It needed an allowlist of routes.

## 3. What this change adds

| Capability                    | Where                                                                                                  | How it compares                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace API keys**        | `developer.domain/service/repository`, `auth.middleware`, `workspace.middleware`                       | Odoo's model (a key is its creator, never wider), plus: pinned to one workspace, scopes, expiry, and a route allowlist checked **during authentication** so that a key cannot reach routes that only authenticate. The key is stored as SHA-256 and shown once.                                                                                                                                                                                                                  |
| **Signed outbound webhooks**  | `developer.service` → `logBusinessEvent` → the `webhook_deliveries` outbox → a poller                  | The signature covers `t=<ts>,v1=HMAC(t.body)`, so replays can be refused (stronger than Xero, Intuit or Frappe). Payloads are thin. Each delivery is claimed with `FOR UPDATE SKIP LOCKED`, only the holder can finish it, backoff runs from 1 minute to 6 hours over 8 attempts, and an endpoint is switched off after 20 permanent failures. SSRF is checked when the endpoint is created **and at connect time**, which also stops DNS rebinding. Redirects are not followed. |
| **Developer contract / SDK**  | `@hisabche/validation` `developer.schema.ts`                                                           | The scopes, the event catalogue, the envelope type, `signWebhookPayload` and `verifyWebhookSignature` (WebCrypto only, so it runs in Node, browsers, Electron and edge runtimes).                                                                                                                                                                                                                                                                                                |
| **Developer screen**          | `DevelopersContainer` on web `/developers`, desktop and mobile through app-shell, linked from settings | Create, list and revoke keys; add, disable, delete and rotate endpoints; send a test ping; see deliveries; redeliver. 503 ("not set up") and 403 ("not allowed") are their own states, never shown as an empty list.                                                                                                                                                                                                                                                             |
| **Bank statement CSV import** | `lib/bank-statement-csv.ts` + `ImportStatementPanel`                                                   | A column-mapping import (the ERPNext/Odoo approach) that also reads Jalali dates and Persian digits. Money stays integer. If any row is unreadable, nothing is sent.                                                                                                                                                                                                                                                                                                             |

Migration: `docs/developer-platform-migration.sql` + `docs/VERIFY-developer-platform.sql`.
**Post-migration verification query generated — PENDING HUMAN CONFIRMATION.**

## 4. Gaps not closed: genuine blockers

Each of these needs a decision or credentials that only the owner can supply. Building them without that would mean fake integrations (G1).

| Gap                                                                 | Blocker                                                                                                                                                                              | Ready-made hook point                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Payment gateways (HesabPay, Zarinpal, Stripe checkout for invoices) | Merchant account, provider choice and credentials                                                                                                                                    | `payments.service.recordPayment` + the inbound pattern in `webhook.service.ts` |
| Bank feeds (automatic statement pulls)                              | No Afghan or Iranian bank offers a public open-banking API. Needs per-bank agreements.                                                                                               | The CSV import above feeds the same `importStatement`                          |
| SMS / WhatsApp / Telegram notifications                             | Provider account (Twilio / WhatsApp Business / a Telegram bot token) and a policy decision on who gets messaged                                                                      | `notification.service` + a new outbox, like `email_outbox`                     |
| E-commerce sync (WooCommerce, Shopify)                              | Store credentials. **Can now be built by the store side** with an API key (`write:customers`, `write:products`, `write:invoices`) plus webhooks, with no connector code in Hisabche. | Done: API keys + webhooks                                                      |
| OAuth 2 for third-party apps / marketplace                          | Needs an app registry, consent screen and review policy (product decision). The scopes and the grant rule already exist and are shared with API keys.                                | `plugin.domain.resolveGrant` (now called)                                      |
| Tax e-invoicing (Iran's Moadian system)                             | Taxpayer credentials and certificates                                                                                                                                                | `tax` service                                                                  |

## 5. Ten ideas of my own

| #   | Idea                                                                                                                                     | Status                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | A key is its creator narrowed, and **never wider**. Scopes the creator lacks are named in the response, not dropped silently.            | ✅ built                                 |
| 2   | Route allowlist decided in **authentication**, not later, so no route that only authenticates can be reached with a key                  | ✅ built                                 |
| 3   | Replay-proof signatures (`t=`, 5-minute tolerance) with the verifier published as code integrators can import                            | ✅ built                                 |
| 4   | Endpoints that keep failing switch themselves off with a stated reason; turning one back on resets the count                             | ✅ built                                 |
| 5   | "Send test" plus a delivery log with status code, error and a redeliver button                                                           | ✅ built                                 |
| 6   | Bank CSV import that reads Jalali dates and Persian digits and refuses to import while any row is unreadable                             | ✅ built                                 |
| 7   | Per-key rate limit (the global limit is per IP; a busy integration behind one IP shares it)                                              | proposed                                 |
| 8   | An `Idempotency-Key` on `POST /api/invoices` for API-key callers (the header already exists for the web client)                          | proposed; the header is already accepted |
| 9   | `payment.*` and `purchase_order.*` events, once a `read:payments` scope exists; events must stay readable by their receiver              | proposed                                 |
| 10  | A "used by" line under each key (which routes it called in the last 24 hours) from the audit log, so an owner can revoke with confidence | proposed                                 |
