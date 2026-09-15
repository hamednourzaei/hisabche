# Positioning audit — 15 Sep 2026

## Current positioning (before)

«نرم‌افزار حسابداری ساده برای مغازه» — reads as a small invoicing tool.

## Actual capabilities (verified in code)

| Claim on landing                                                  | Evidence                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Double-entry ledger, P&L, balance sheet, trial balance, cash flow | accounting.routes.ts `/income-statement` `/balance-sheet` `/trial-balance` `/cash-flow` |
| Receivables / payables aging                                      | `/aging/:kind` (receivable, payable)                                                    |
| Till, bank, budgets                                               | pos.routes, services/banking, services/budgeting                                        |
| Inventory movements, low stock, transfers, counts                 | stock_movements, `/api/products/low-stock`, warehouse.routes, cycle-count               |
| Manufacturing, payroll, purchasing, CRM                           | manufacturing / human-resources / purchasing / crm routes                               |
| Offline                                                           | apps/desktop only: SQLite + sync-engine + /conflicts (web is online)                    |
| Roles, SoD, approvals, audit                                      | services/authorization (sod.domain), governance, audit routes                           |
| AI                                                                | ai-chat.service: 4 reporting views, caller's token, read-only, quota                    |
| Multi-business / branches                                         | workspaces, branch.routes, consolidated (null branch)                                   |

## NOT implemented — never claim

Two-factor login · scheduled/auto backup + restore window · client-held encryption keys ·
public API / user webhooks (webhook.service = billing provider inbound) · customer counts / ratings ·
industry workflows for hotels, clinics, fuel, agriculture, salons.

## Gap

Page sold "simple shop accounting"; product is an integrated business system with an accounting core.

## IA shipped

Hero → modules (finance / sales / operations / management) → one flow → accounting core → money →
inventory → offline-first → reports → industries → AI → control & security → multi-business →
pricing → FAQ → product proof + CTA.
