# Admin console — threat model (V63 · S-7)

Written for the person who has to answer «how is the console protected?» without reading the
code. It is deliberately short and it names what is **not** covered.

Scope: `apps/admin` (browser console) and the `/api/admin/*` surface in `backend/`. Customers'
workspaces are out of scope except where an admin action reaches them.

---

## 1. What we are protecting

| Asset                       | Why it matters                            | Where it lives                                     |
| --------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Customer money movements    | Refunds, ledger adjustments, plan changes | `billing_ledger_entries`, `admin_action_requests`  |
| Payment gateway credentials | A leaked live key moves real money        | Supabase Vault, `platform_secrets` (metadata only) |
| AI provider key             | Bills the owner, usable from anywhere     | Supabase Vault                                     |
| Customer personal data      | Names, phone numbers, balances            | tenant tables, read through admin support routes   |
| Admin sessions              | A stolen cookie is the whole console      | Supabase auth + `admin_sessions`, AAL2             |
| The console's own HTML      | Stored XSS on the marketing site          | `cms_pages`, `cms_globals`, `blog_posts`           |

## 2. Trust boundaries

```
browser (untrusted) ──TLS──> app server (trusted) ──service key──> Postgres (trusted)
                                   │
                                   └──Vault (trusted, never leaves the server)
```

- The browser is never trusted: every field is re-validated on the server, and the server
  derives money amounts from lines.
- The service role key is the only credential that writes admin tables. It lives in the server
  environment and is never sent to a client.
- `workspace_id` is the tenancy boundary; admin routes are not tenant routes and are gated by
  the admin chain instead.

## 3. STRIDE

| Threat                     | Attack                                           | Control                                                                                                                                              |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S**poofing               | Stolen admin session cookie                      | AAL2 (TOTP) required; idle (30 min) and absolute (12 h) timeouts; per-admin session list with revoke; optional IP allow-list                         |
| Spoofing                   | Email allow-list bypass via a look-alike address | `isAllowlistedAdminEmail` compares the lower-cased exact address; the list is an environment value, not a DB row                                     |
| **T**ampering              | A single admin changes where money goes          | Maker-checker: proposer ≠ approver for refunds, price changes, secret rotation, live gateway enable, server scale-up, role grant                     |
| Tampering                  | Editing a CMS page to inject script              | Server-side sanitisation on both write paths (`cms.sanitize.ts`, `blog.sanitize.ts`); CSP with per-response nonce as second layer                    |
| Tampering                  | Replaying an approved request                    | `decideActionRequest` refuses a request that is not `PENDING`                                                                                        |
| **R**epudiation            | «I did not refund that»                          | `audit_logs` + `admin_security_events` with actor, IP, user agent, timestamps                                                                        |
| **I**nformation disclosure | Reading a secret through the console             | No route returns a value; `platform_secrets` holds `last4` only; Vault read functions are `SECURITY DEFINER` and revoked from `anon`/`authenticated` |
| Information disclosure     | Admin HTML leaking through a shared cache        | `Cache-Control: no-store` on admin responses; the console is `noindex` and framed-deny                                                               |
| Information disclosure     | Reading another workspace's support session      | Support routes re-check `workspace_id` and admin role; no cross-tenant read without a logged session                                                 |
| **D**enial of service      | Hammering admin endpoints                        | Global 100/min + admin 60/min per credential, 429 with `Retry-After`; never a 500 from the limiter                                                   |
| DoS                        | A huge CMS payload                               | `z.string().max(50000)` + sanitiser; request body limit at the server                                                                                |
| **E**levation of privilege | A narrow role calling a route it cannot see      | Every admin route must pass `admin-route-chain.test.ts`: permission + platform guard + step-up where required                                        |
| Elevation                  | MFA bypass in a test build                       | `isTestRuntime()` requires `VITEST` **and** `buildServer({testRuntime:true})`; production startup refuses either marker                              |

## 4. Explicitly out of scope / residual risk

1. **No WAF integration in code.** Cloudflare (or the host) may front the API; this repository
   does not configure it.
2. **No hardware key (WebAuthn).** AAL2 means TOTP, which is phishable.
3. **Per-instance state without Redis.** Idle-timeout and the local rate-limit window are
   per-process; with several instances and no shared cache the effective limits are looser.
4. **No SOC 2 / ISO evidence pack.** Posture (`/api/admin/security/posture`) reports measured
   facts, not an audit opinion.
5. **No automatic scanning.** Dependency and container scanning are a CI concern and were
   explicitly excluded from V63.
6. **Break-glass is an email + a path prefix.** It is logged, but a compromised break-glass
   mailbox is a real path in.
7. **Solo-owner deployments cannot complete maker-checker.** The second approver is a person;
   the console reports the pending request rather than auto-approving it.

## 5. The one-line summary (Persian)

مدل تهدید کنسول مدیر: هویت با AAL2 و فهرست مجاز، نوشتن با مجوز + Step-Up، پول و کلید و تغییر
زندهٔ درگاه فقط با تأیید دو نفر، رازها در Vault و هرگز در پاسخ API، ورودی HTML در سرور پاک‌سازی
می‌شود، و هر مسیر مدیر با تست زنجیرهٔ گارد محافظت می‌شود. آنچه پوشش داده نشده در بخش ۴ آمده است.
