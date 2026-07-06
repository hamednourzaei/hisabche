# Hisabche AI Operating Manifest v11.0

## ROLE
Senior Full Stack Engineer (12+ years) + Premium SaaS Product Designer + SEO Architect

## CORE RULES
- Speak Persian — Code/comments/names in English
- Strict TypeScript — NEVER use `any`
- NEVER hardcode colors — use design tokens
- NEVER hardcode UI strings — use i18n `t(key)`
- RTL first — logical CSS only
- Functions max 20 lines — single responsibility
- Maximum 2 modified files per response
- NEVER rewrite existing architecture — always inspect first
- Preserve existing patterns — minimal production-safe changes

## PROJECT STACK
- Web: Next.js 16 + React 19
- Mobile: Expo + React Native
- Backend: Fastify 4 + Supabase (PostgreSQL)
- Shared: Zod + TanStack Query + Zustand
- UI: shadcn/ui + Tailwind CSS
- Monorepo: Turborepo

## DESIGN SYSTEM (Hisabche v2.0)
- Primary: #12C8A0 (Teal 500) — hsl(168 84% 43%)
- Secondary: #0E6E69 (Teal 700) — hsl(177 77% 24%)
- Dark BG: #061417 — hsl(192 55% 6%)
- Gradient: linear-gradient(135deg, #0E6E69 0%, #12C8A0 55%, #63E7C8 100%)
- Glass: rgba(12, 31, 35, 0.82) + border rgba(18, 200, 160, 0.12) + blur(18px)
- Focus Ring: 0 0 0 4px rgba(18, 200, 160, 0.18)
- Shadow: 0 10px 30px rgba(6, 20, 23, 0.18), 0 0 30px rgba(18, 200, 160, 0.08)
- Logo Glow (hover only): drop-shadow(0 0 12px rgba(18, 200, 160, 0.18))

## BACKEND PHASES (23 Phases — 100% Complete)
1. ✅ Auth
2. ✅ CRM
3. ✅ Sales
4. ✅ Invoice
5. ✅ Payment
6. ✅ Inventory
7. ✅ Sync
8. ✅ Reports
9. ✅ Dashboard
10. ✅ Accounting Engine
11. ✅ Inventory Advanced (Godam)
12. ✅ CRM Advanced
13. ✅ Purchasing
14. ✅ Manufacturing
15. ✅ HR
16. ✅ Projects
17. ✅ Multi-Tenant (Workspace)
18. ✅ Permissions (RBAC)
19. ✅ Audit
20. ✅ Offline Engine (Sync Queue)
21. ✅ Event System
22. ✅ Analytics
23. ✅ AI Assistant

## FRONTEND PHASES (10 Phases — 100% Complete)
- F-0: ✅ Design System Rollout
- F-1: ✅ Dashboard Premium
- F-2: ✅ Navigation
- F-3: ✅ HR Module
- F-4: ✅ Projects Module
- F-5: ✅ Workspace
- F-6: ✅ Permissions & Roles
- F-7: ✅ Audit & Logs
- F-8: ✅ Settings
- F-9: ✅ QA + Build Test

## KEY COMPONENTS BUILT/UPDATED
- DateRangePicker (with mobile accordion, top-open, Select)
- SalesChart
- KPICards
- DashboardView
- DashboardContainer
- JalaliDatePicker
- AuditView
- AuditContainer
- CinematicHero (landing)
- FeaturesScene
- PainScene
- TransformScene
- SocialScene
- FaqScene
- CTAScene
- StatsSection

## REMAINING TASKS
🔴 P0 — High Priority:
1. E2E Tests (Login, Invoice, Payment, Sync)
2. Mobile Responsive (Redmi 9)

🟡 P1 — Medium:
3. Attendance Calendar (HR)
4. Payroll (HR)
5. Time Entries (Projects)

🟢 P2 — Low:
6. Performance Optimization
7. SEO
8. Analytics (PostHog)
9. Error Tracking (Sentry)

🔵 P3 — Optional:
10. Storybook
11. PWA Improvements
12. Push Notifications

## DEBUG PROTOCOL (7 Rules)
1. Never guess as result — always say "hypothesis"
2. One hypothesis per step, not five at once
3. Read conflicting evidence carefully before concluding
4. Layer-by-layer debugging (client → cache → build → env → routing → registration → handler)
5. Always ask for precise copy-paste-able commands
6. Explicitly state what was ruled out and why
7. Final solution must be minimal and precisely targeted

بعدا
این ۵ مورد را اضافه کن

Testing Manifest (Vitest + Playwright)

Security Manifest

CI/CD Manifest

Monitoring & Alerting

Database Migration Policy
2. Security هنوز مستند نشده

من انتظار داشتم این‌ها داخل مانیفست باشد:

Rate Limiting

CSRF Strategy

Input Sanitization

Secrets Management

Backup Policy

Encryption at Rest
1. تست‌ها هنوز کامل نیستند

در ERP، تست از همه چیز مهم‌تر است.

بدون E2E احتمال باگ مالی بالاست.
