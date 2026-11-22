---
name: hisabche-ai-and-integrations
description: Rules for anything that calls an AI provider, sends email, exposes tools to an assistant (MCP), reads a document, or connects to an outside service. Use before adding an AI feature, a campaign or notification channel, an MCP tool, or a connector.
---

# AI, outbound channels and integrations

## One of each — reuse it

| Need                             | The one that exists                                                                            | Do not build                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Call a model                     | `services/ai/provider-client.ts` → `callProvider(config, { system, user, maxTokens, image? })` | a second fetch to a provider |
| Provider config                  | `AiSettingsService.getConfig()` (platform admin sets it; key stored encrypted)                 | a per-feature key or setting |
| Allowance                        | `AiQuotaService.status(ctx)`; one row in `ai_query_log` per paid call                          | a second counter             |
| Send email                       | `email_outbox` (`email-outbox.ts`, `claim_email_outbox`) + Resend                              | a direct send from a service |
| Background work                  | `distributed-work.ts`                                                                          | a queue per feature          |
| Tools for an assistant           | `POST /mcp` → `services/mcp/mcp-tools.ts`                                                      | a tool that reads a table    |
| Third-party credentials / tokens | `api_keys` (OAuth app tokens are rows there)                                                   | a second secrets table       |

## «Not configured» is an answer

No provider, no `RESEND_API_KEY`, no adapter → a named refusal the screen
translates (`AI_NOT_CONFIGURED`, `INGEST_NO_PROVIDER`,
`CAMPAIGN_EMAIL_NOT_CONFIGURED`). Never an empty result that reads as «there
was nothing», and never a silent no-op.

A **page** must say who can fix it («مدیر سامانه باید … تنظیم کند»); a floating
button may simply not appear.

## Calling a model

1. `getConfig()` → null → refuse by name.
2. Check the allowance **before** the call. `AI_QUOTA_EXCEEDED` → 429 with the
   top-up contact.
3. Call once. No retry inside the client.
4. Log one row when — and only when — the provider was actually called. A
   refusal made before the call costs nothing and is not counted.
5. A provider error body is logged where the call is made and never sent to
   the client (`ai-provider-boundary.test.ts` asserts `response.text()` appears
   exactly once).

**What the log may hold:** what kind of call, between which languages / what
file type, how large, the outcome. **Never** the document text, the picture,
a customer's name or a figure. The log is read by the platform owner.

## A model states; it never decides

- **Figures:** the model returns the amount as the text printed on the paper;
  our strict parser turns it into an integer. Text that is not plainly a number
  is «unreadable», never zero. For translation, every figure is replaced by a
  marker before the call and restored from the SOURCE after; a missing marker
  refuses the result.
- **Digits:** every pattern that spots a number handles ASCII, Persian and
  Arabic-Indic digits and both decimal separators.
- **Writes:** nothing a model produced reaches the books without a person.
  - Document reading: `read` writes nothing; `confirm` takes the figures the
    person sent after reviewing, and issues the document through
    `InvoiceService.create`.
  - MCP: a `financial` or `destructive` tool is not executed; it becomes an
    `ai_action_requests` row that a manager approves in the app, executed with
    that person's session and `Idempotency-Key = mcp-<id>`. There is no
    `confirmed: true` anywhere.
- **Data access:** the assistant reads only the four reviewed reporting views,
  as the user. No AI file composes SQL or takes a workspace id.

## MCP

- An adapter over the Public API: each tool maps to one key of
  `API_ROUTE_SCOPES` and is executed with `fastify.inject` using the caller's
  own API key. Opening a capability to an assistant is the same decision as
  opening it to an API key — add the route to the allowlist first.
- `/mcp` authenticates itself, so it is in `exactPublicPaths` in `index.ts`.
  A test on a bare Fastify instance does not see the global hook.
- `services/mcp` reads no table but `ai_action_requests`.

## Outbound messages to customers

- Recipients are resolved on the server from the workspace's own customers;
  the client sends a segment, not a list of addresses.
- Opt-outs are honoured before anything is queued, and every message carries
  an unsubscribe link.
- The whole launch is one Postgres function: recipients and outbox rows land
  together or not at all. A sent campaign is immutable.
- Public links are unguessable tokens under `/api/public/…`; loading the page
  records nothing — only an explicit answer does.
- There is a hard ceiling on recipients per launch.

## Connectors

`services/connectors/connector.domain.ts` defines fifteen connectors and has
**no adapter and no credentials**. Do not build a page that lists them as
unavailable. A connector is built when the owner has registered an app with
that provider and supplied its credentials on the server; until then the
status is `BLOCKED_EXTERNAL_CREDENTIAL`. Zapier / Make / n8n already work
through the existing webhooks and API keys.

## Comparing businesses

Only a figure that means the same for every business and needs no ledger.
The backend reads per-business counts through a backend-only function, pages
through **all** of them, and returns only a median, a percentile and a count —
and nothing below `MIN_PEERS` (10). Never call it «the market».

## Reporting status

Nothing here is `VERIFIED_COMPLETE` until it has run against the real provider
in the session. Without credentials: `BLOCKED_EXTERNAL_CREDENTIAL` or
`IMPLEMENTED_NOT_LIVE_VERIFIED`, with exactly what must be set.
