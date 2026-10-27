# Hisabche ISO/IEC 27001:2022 Statement of Applicability (SoA)

This document specifies the inclusion/exclusion of the ISO 27001:2022 Annex A security controls.

## Annex A Controls Summary

| Control    | Name                       | Applicable? | Justification & Codebase Implementation                                                   |
| ---------- | -------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| **A.5.15** | Access Control             | Yes         | `requireCapability(...)`, `requireWorkspaceContext`, RBAC permissions matrix              |
| **A.5.24** | Incident Management        | Yes         | Status page, error-first logging, `DEBUG-PLAYBOOK.md`                                     |
| **A.5.29** | Business Continuity        | Yes         | Local-first offline capability, `BackupService`, DR drill runbook                         |
| **A.8.1**  | User Endpoint Devices      | Yes         | SQLite local encryption, secure store key storage                                         |
| **A.8.2**  | Privileged Access          | Yes         | TOTP MFA required for admin accounts and sensitive settings                               |
| **A.8.7**  | Protection Against Malware | Yes         | Defender rules, banned execution paths (§0 AGENTS.md)                                     |
| **A.8.9**  | Configuration Management   | Yes         | CI lint, turbo pipelines, zero-warning ESLint / TypeScript policies                       |
| **A.8.11** | Data Masking               | Yes         | No passwords or secrets in logs, masked phone numbers                                     |
| **A.8.12** | Data Leakage Prevention    | Yes         | Tenancy boundary enforced on all queries; `no-duplicate-concepts`                         |
| **A.8.20** | Network Security           | Yes         | Fastify CORS strict headers, TLS 1.3 in transit                                           |
| **A.8.24** | Use of Cryptography        | Yes         | SHA-256 audit chaining, bcrypt/argon2 hashing, HMAC webhook signing                       |
| **A.8.28** | Secure Coding              | Yes         | Comprehensive guard test suite (`no-hardcoded-currency`, `unknown-is-not-zero`, `one-ux`) |

## Exclusions

- Physical site security (A.7.1–A.7.14) is managed by upstream hosting providers (Supabase / AWS / Hetzner) under shared responsibility models.
