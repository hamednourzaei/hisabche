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

## 6. Platform roadmap (agreed 27 Sep 2026): layers, not 80 features

The 80 ideas proposed in conversation reduce to seven shared layers. Each idea is a consumer of a layer, not a module of its own (G2).

| Step | Layer                                                                                                                  | Status                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Public API surface + events + per-key limits + usage + replay                                                          | ✅ built. `docs/developer-platform-02-migration.sql`: **Post-migration verification query generated — PENDING HUMAN CONFIRMATION** |
| 2    | Publishable key + order lifecycle (state machine first) + Order → server-priced invoice → stock → ledger + Website SDK | ✅ built (03 migration — PENDING HUMAN CONFIRMATION)                                                                               |
| 3    | Invoice widget, QR, customer portal (on the existing `invoice-public` token link)                                      | ✅ built (04 migration — PENDING HUMAN CONFIRMATION)                                                                               |
| 4    | Evidence chain (the basis for Why Changed, Profit Leak and Money Journey)                                              | ✅ built (no migration: reads existing cost layers)                                                                                |
| 5    | OAuth + marketplace                                                                                                    | ✅ built (05 migration — PENDING HUMAN CONFIRMATION). Review policy: private by default, a platform admin publishes                |
| 6    | Sandbox workspace                                                                                                      | ✅ built (06 migration — PENDING HUMAN CONFIRMATION)                                                                               |

What step 1 added:

- **Scopes:** `read:payments` (`payment.read`) and `read:inventory` (`inventory.read`, quantities and sell prices only, no cost).
- **Routes:** `GET /api/payments`, `/api/payments/:id`, `/api/warehouses` and `/api/warehouses/:id/stock`.
- **Events:**
  - `payment.recorded` and `payment.cancelled` come from `logBusinessEvent`.
  - `inventory.low_stock` and `inventory.restocked` come from a trigger on the stock projection, fired on the **crossing** only. The trigger can never fail the sale.
  - `order.*` is deliberately absent until the order lifecycle exists.
- **Rate limiting:** one bucket per key (by hash) at 120 requests per minute, shared across instances.
- **Request log:** records the route pattern, status and duration, never ids or query strings. Refusals are logged too. Usage is shown as exact per-day counts, plus the latest 50 requests labelled as a sample. Retention is 30 days.
- **Replay:** an endpoint's finished deliveries can be replayed for up to 30 days back. Replays keep the original event id and carry a `Hisabche-Replay: true` header.

### Steps 2–3 (built)

- **Step 2, commerce core:** `docs/developer-platform-03-commerce-migration.sql`. Status: **PENDING HUMAN CONFIRMATION**.
  - A publishable key is a _kind_ of `api_keys` row, not a second key table. It is public, bound to an origin list, and can only read the catalogue and place a pending order.
  - The order lifecycle is a database state machine: every transition is one function call and emits exactly one `order.*` event. "Paid" follows the order's invoice through a trigger, in both directions.
  - Invoicing an order goes through `InvoiceService.create`, with the order's idempotency key. Customer resolution never guesses: two customers with the same phone are ambiguous, and a customer is only created by someone allowed to.
  - The public gate is `/api/public/v1`. Request bodies are strict, so a price in the body is rejected with 400. `Idempotency-Key` is required.
  - Browser SDK: `apps/web/public/sdk/v1.js`.
  - Default settings (G4): manual confirmation, availability shown instead of quantities, 48-hour expiry, at most 5 pending orders per contact.
- **Step 3, customer-facing:** `docs/developer-platform-04-portal-migration.sql`. Status: **PENDING HUMAN CONFIRMATION**.
  - BUG-077 fixed: every public token link returned 401 until now.
  - Customer portal link: the link's maker is re-verified on every visit, and the balance comes from `getBalance`, so there is no second formula.
  - SDK token widgets: `renderInvoice` and `renderPortal`. The QR code and the public invoice page already existed.

### Steps 4–5 (built)

- **Step 4, evidence chain:** no migration; it reads the existing cost layers.
  - `GET /api/accounting/evidence/invoices/:id` explains a single invoice's profit. The totals come from `buildProfitReport` and must equal `getInvoiceMargins`, so there is no second profit formula.
  - `GET /api/accounting/evidence/products/:id` gives a product's money journey: `cost_consumptions` → `cost_layers` → source document.
- **Step 5, OAuth and marketplace:** `docs/developer-platform-05-oauth-migration.sql`. Status: **PENDING HUMAN CONFIRMATION**.
  - Flow: authorization code with PKCE (S256 only; plain and implicit are refused). Codes are stored as sha256, live 10 minutes, and are redeemed once by `redeem_oauth_code`, which is race-safe. A failed verifier burns the code.
  - The access token **is** an `api_keys` row with `app_id`, so the route allowlist, scope narrowing, per-key rate limit, request log and revocation apply unchanged. Uninstalling an app means revoking its key. Deleting an app cascades to its tokens.
  - The grant is recomputed at exchange time against what the installer holds **now**. An app never receives more than the person who approved it holds.
  - Review policy (G4 default): a new app is private and installable only on its publisher's workspace. `in_review → published/rejected` is decided by a platform admin (admin panel → OAuth apps). A published app cannot be edited or deleted under its installers.
  - Consent page: `/[lang]/oauth/authorize`, outside (dashboard). A signed-out visitor returns to the same request after login. Nobody is redirected until the server has confirmed the `redirect_uri` is registered.
  - Not built: refresh tokens (a token lives until revoked, like an API key), and app-owned webhooks.

### Step 6 (built)

- **Sandbox:** `docs/developer-platform-06-sandbox-migration.sql`. Status: **PENDING HUMAN CONFIRMATION**.
  - A sandbox **is** a workspace (`is_sandbox`, `sandbox_of`), not a new layer. Because it has its own `workspace_id`, RLS, API keys, webhooks and OAuth installations already isolate it. Nothing else had to learn the word "sandbox".
  - One sandbox per business and person, created by `create_sandbox_workspace`. The workspace and its owner membership are written in one transaction. The function is race-safe and returns the existing sandbox on a second call.
  - The flag is permanent (enforced by a trigger). A sandbox cannot have its own sandbox. If the real business is deleted, the sandbox stays a sandbox.
  - A sandbox starts empty. It is **not** a copy: copying real customers would put real people's data where test keys can reach it.
  - A "sandbox" banner appears on every page, in both shells. Entering and leaving go through `enterWorkspace`, which reloads the app, because the app has no in-place workspace switcher.
  - Not built: a "reset sandbox" action (deleting a workspace's data has no safe single-statement path yet); keeping sandboxes out of platform metrics and billing.

## 7. The app marketplace (28 Sep 2026): the seventeen items, against the incumbents

The comparison set is the app stores of Shopify, Xero, QuickBooks (Intuit), Zoho and Odoo. Only well-known _patterns_ are compared here; no feature was copied.

| Item                          | What the incumbents do (pattern)                                         | Hisabche (migration 07)                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App listing                   | Slug page with icon, tagline, description and links                      | `oauth_apps` gains slug, tagline, category, icon, and privacy / terms / install URLs. `/marketplace` works on web and desktop.                                                                                                                                    |
| Screenshots                   | A gallery                                                                | `app_screenshots`: at most 8, https only                                                                                                                                                                                                                          |
| Categories                    | A fixed taxonomy                                                         | `APP_CATEGORIES`, a closed list of 11 enforced by a CHECK constraint                                                                                                                                                                                              |
| Publisher profile             | A partner or developer page                                              | `app_publishers`, one per publishing workspace                                                                                                                                                                                                                    |
| Verified badge                | Granted after a partner review                                           | Only a platform admin can grant it. A database trigger **removes it** when the name or website changes.                                                                                                                                                           |
| Versioning                    | Reviewed releases                                                        | `app_versions` holds immutable snapshots of the draft. Semver must increase (compared numerically, so 1.10 > 1.9), and only one version can be in review at a time.                                                                                               |
| Changelog                     | Release notes                                                            | Each version carries a changelog, shown on the listing and in the update preview                                                                                                                                                                                  |
| Permissions disclosure        | A scopes list on the listing and on consent                              | `permissionDisclosure()` is used by **both** the listing and the consent screen. It marks each scope read or write and lists the events the app receives.                                                                                                         |
| Install / uninstall lifecycle | Install records and uninstall webhooks                                   | `app_installations` tracks active → uninstalled or replaced. Install and update are Postgres functions. Uninstall means **revoking the key**, from any path, via a trigger.                                                                                       |
| Ratings / reviews             | Stars plus text, often "verified install"                                | Only businesses that installed the app can review it, one review per business, and never the publisher. Reviews are shown without the reviewing business's name. An admin can hide a review; exact averages come from the database.                               |
| Update mechanism              | The merchant approves new scopes                                         | The installer sees the diff (added and removed scopes, refused scopes, new events, changelog) and approves. Scopes are re-narrowed to what that person holds, and the key cache is cleared at once.                                                               |
| Version compatibility         | API version pinning                                                      | `API_VERSIONS` (`v1`). A version targeting an unsupported API version is refused at install and update (`APP_INCOMPATIBLE`).                                                                                                                                      |
| Webhook subscriptions         | Declared by the app, per install                                         | Declared per version. Each installation becomes an ordinary `webhook_endpoints` row signed with the **app's** secret. Events are narrowed to the granted read scopes. The existing worker, retries and replay all apply.                                          |
| Usage analytics               | A partner dashboard                                                      | Exact per-day request, 4xx, 5xx and average-ms counts from `api_request_logs`, plus installs and uninstalls per period                                                                                                                                            |
| App health                    | Status, sometimes an SLA                                                 | `appHealth()` over 24 h of 5xx and failed webhook deliveries, with explicit thresholds. It reports "no data" or "low volume" instead of a false "healthy".                                                                                                        |
| Abuse / security review       | Review before publish, plus report and suspend                           | Admin queue with risk flags (new scopes, write scopes, localhost, webhook host mismatch, unverified publisher, open reports). Localhost **cannot** be published. Reports go to a queue, and an admin can suspend an app and optionally revoke every installation. |
| **Billing / revenue share**   | The platform charges the merchant and pays the developer, taking a share | **Disclosure only.** The price is declared in minor units and shown with "billed by the publisher". Hisabche collects nothing.                                                                                                                                    |

**Why billing and revenue share are not built.** The platform charging a merchant on a developer's behalf needs three things Hisabche does not have:

1. A payment rail that can charge automatically. Platform plans today are manual upgrade requests.
2. Payouts to developers.
3. A policy decision on the share, and on refunds and tax.

Building a "revenue share" number without money moving would be a claim with nothing behind it (G1). The pricing columns and the disclosure are the part that is true today.

## 8. Business wallet (28 Sep 2026) — against the incumbents

|                              | Odoo                                          | ERPNext                    | Shopify (billing)                                                                 | Hisabche wallet-01                                                                                                                                      |
| ---------------------------- | --------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prepaid balance per business | Customer credit / wallet module (per partner) | Advance payments per party | Store credit for the merchant's customers; the merchant pays the platform by card | **One wallet per workspace, one balance per currency**                                                                                                  |
| Top-up                       | Online gateway                                | Payment Entry              | Card only                                                                         | **Manual: card-to-card / foreign currency into a method the platform defines, tracking number + receipt, admin approval** (gateways cannot serve IR/AF) |
| Pay the subscription from it | — (SaaS billed by card)                       | —                          | —                                                                                 | **Debit + upgrade request + activation in one Postgres transaction**                                                                                    |
| Ledger                       | Journal items                                 | GL entries                 | —                                                                                 | Append-only `wallet_transactions` (trigger), `balance_after` per row, balance written only by functions, CHECK ≥ 0                                      |
| Admin correction             | Manual journal                                | Journal Entry              | —                                                                                 | `wallet_adjust` with a required note; never below zero                                                                                                  |

Decisions and why:

- **Per workspace, not per user.** Money belongs to the business; a member leaving must not take the balance with them (rule 1).
- **The price is the server's.** `pay-upgrade` carries no amount; `priceOf` from `plan-pricing.ts` (rule 3).
- **The admin credits what actually arrived**, not what was declared — the declared amount stays on the request for the record.
- **A rejected/withdrawn tracking number can be filed again** (partial unique index on pending/approved only); an approved one never twice.
- **The wallet stays open while the subscription is expired** (`/api/wallet/` in the expiry allowlist, `/wallet` in the read-only routes): it is a way out of the lock, like `/billing`.
- Not built: a payment gateway (none serves both markets), refunds out of the wallet (a policy decision for the owner), paying invoices/orders from the wallet (future `sales_orders`, phase 3 design).

## 9. Product images (28 Sep – 3 Oct 2026) — against the incumbents

|                       | Odoo                             | ERPNext                     | Shopify           | Hisabche                                                                                                        |
| --------------------- | -------------------------------- | --------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Images per product    | 1 main + extra media (eCommerce) | 1 image + website slideshow | up to 250         | **up to 8**, ordered                                                                                            |
| Cover                 | main image field                 | `image` field               | first by position | **position 0, written to `products.image_url` by the database functions** — every existing reader keeps working |
| Alt text              | on website media                 | no                          | yes               | **yes, per image (≤ 200)**                                                                                      |
| File check            | extension / mimetype             | extension                   | server-side       | **type sniffed from the bytes; random path; 2 MB; jpeg/png/webp/avif**                                          |
| Cap under concurrency | n/a                              | n/a                         | n/a               | lock on the product row; a racer gets `PRODUCT_IMAGE_LIMIT`, not a raw duplicate-key                            |

Decisions: 8 is enough for a catalogue and keeps a product page light; the bucket is public because the
storefront and (later) the marketplace show these images; add/remove/reorder are functions because each
touches `product_images` AND the cover (rule 4). Not built: image resizing/thumbnails (the list shows the
original at 32px — fine up to the 2 MB cap, worth revisiting if lists get slow), drag-and-drop ordering.

## 10. Goods marketplace (3 Oct 2026) — infrastructure, OFF by default

|                | Shopify / Shop         | Odoo eCommerce     | Basalam / Digikala (IR)    | Hisabche goods-marketplace-01                                                                                        |
| -------------- | ---------------------- | ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Who lists      | a merchant's own store | one company's site | many sellers, platform-run | **any business on Hisabche, from its own products**                                                                  |
| Price          | product price          | pricelist          | seller's price             | **stated per listing by the seller** (`price_minor` + currency) — never derived from the product's sell or buy price |
| Cost exposure  | n/a                    | n/a                | n/a                        | impossible by construction: no cost column on the table, and the public select names its columns one by one          |
| Launch control | n/a                    | module install     | n/a                        | **platform switch, default false**; off = public API 404, pages 404 + noindex, nothing in the sitemap                |
| Trust          | reviews                | —                  | seller badges              | `verified`, written only by a platform admin; suspension (seller or listing) with a reason the seller reads          |
| Buying         | checkout               | checkout           | checkout                   | **none yet — a showcase.** The page says «contact the seller»                                                        |

Decisions:

- **Showcase first.** No text in fa/af/en claims ordering, payment or delivery (guarded), because none exists.
- **Public = five conditions**, in one place (`MarketService.publicListings`): switch on, seller active, listing active, not hidden/suspended, product active.
- **Three locales, one content.** A listing is written once and served under /fa, /af, /en with hreflang; the chrome is translated, the seller's text is not.
- **`IRT` in structured data** is stated as IRR × 10 (exact, definitional); a code with no ISO equivalent gets no `Offer` rather than a wrong one.

### The order and payment path — DESIGN ONLY, nothing built

The pieces already exist; the marketplace must reuse them, not grow a second order system (G2):

1. **Order = `sales_orders`** (developer-platform-03). `create_sales_order` already takes lines, prices them on the server and
   emits `order.created`. A marketplace order is the same row with `source = 'marketplace'` and the BUYER identified by
   phone/name (as the storefront does), in the SELLER's workspace. No new table.
2. **Price at order time** comes from `marketplace_listings.price_minor` (the seller's stated price), locked into the order
   line — not from `products.sell_price`. This is the one change `create_sales_order` needs: a price source parameter.
3. **Payment**, two honest options, each a decision for the owner:
   - **Off-platform** (cash/transfer to the seller): the order is confirmed by the seller, exactly like a storefront order
     today. Needs nothing new. This is the first step.
   - **Through the platform wallet**: the buyer needs a wallet — today a wallet belongs to a _workspace_, so only
     businesses could pay this way (B2B). A consumer wallet would be a new, per-person ledger: a real scope decision.
     Flow: debit buyer wallet → hold → seller confirms/ships → release to seller wallet minus the platform fee, all in
     one Postgres function per step, on the existing append-only `wallet_transactions`.
4. **Open decisions (the owner's):** platform fee %, who bears refunds, hold period, whether consumers get wallets,
   dispute handling. Until these are set, no «buy» button is drawn anywhere.
5. **Stock:** `transition_sales_order` already moves stock on fulfilment; `availability`/`quantity` on a listing stay the
   seller's statement and are NOT auto-synced to stock (a seller may not want to publish stock levels).

## 11. Developer platform 08 (3 Oct 2026) — against the incumbents

|                        | Shopify                                          | Google / GitHub OAuth | Stripe test mode       | Hisabche 08                                                                                                       |
| ---------------------- | ------------------------------------------------ | --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Access token           | offline tokens do not expire; online tokens ~24h | ~1h                   | n/a                    | **1h** for new installs (old installs keep theirs)                                                                |
| Refresh                | expiring offline tokens (opt-in) rotate          | rotation optional     | n/a                    | **always rotated**; reuse of a spent token revokes the family and the access token (RFC 6819 §5.2.2.3)            |
| Revocation             | uninstall                                        | RFC 7009 endpoint     | n/a                    | `POST /api/oauth/revoke`; unknown token still answers 200                                                         |
| Test environment reset | new dev store                                    | n/a                   | «delete all test data» | **retire and replace** — nothing deleted; only for `is_sandbox`                                                   |
| Listing images         | uploaded to the platform                         | n/a                   | n/a                    | uploaded (bytes sniffed, random name) — a reviewed listing's images can no longer change on someone else's server |

Decisions: the access token stays the same `api_keys` row (rotated in place) so an installation, its scopes and its webhook
endpoint survive a refresh; the grant is recomputed against the installer's CURRENT access on every refresh; a sandbox is
left out of platform metrics and of the plan's business quota.

**Not built — the owner's decision:** app billing / revenue share. Needs: the platform's percentage, who bears a refund,
payout schedule and currency. The wallet ledger (wallet-01) is the natural place for it once those are set.
