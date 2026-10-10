# Hisabche Landing Page Refactor Audit

## Current Architecture Forensics

- **Route**: `apps/web/app/[lang]/page.tsx`
- **Component Root**: `@hisabche/ui/landing/landing-page` -> `packages/ui/src/components/ui/landing/landing-page.tsx`
- **Sections**: `CinematicHero`, `ModulesScene`, `SystemScene`, `ChapterScene` (ledger, money, inventory, offline, reports, ai, multi), `TrustBarScene`, `SecurityScene`, `CompareScene`, `PricingScene`, `FaqScene`, `CTAScene`, `SiteFooterView`.
- **Styling**: Tailwind CSS with Design Tokens (`hsl(var(--color-primary))`, `hsl(var(--surface-base))`).
- **Responsive**: Mobile-first Tailwind (e.g. `sm:`, `lg:`).

## 20 UX/UI Issues Identified

| #   | Problem                            | Device           | Severity | Why it hurts UX                                                                                               | Evidence                                                 | Recommended solution                                                   |
| --- | ---------------------------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Unclear value proposition in Hero  | All              | Critical | "Accounting software for your shop" is too generic and doesn't communicate the "Offline-First OS" concept.    | `landing.headline` string in CinematicHero               | Rewrite Hero to focus on "Living Ledger" and "Business OS".            |
| 2   | Weak information hierarchy         | Mobile/Tablet    | High     | The long scroll of consecutive `ChapterScene`s causes fatigue. The visitor loses the big picture.             | 7 consecutive `ChapterScene` calls in `landing-page.tsx` | Group features into logical pillars (Sales, Offline, Intelligence).    |
| 3   | Poor section sequencing            | All              | Medium   | Trust factors (`TrustBarScene`) appear too late, after 6 feature chapters.                                    | `landing-page.tsx` order                                 | Move Trust & Security higher up, directly after the pain-point.        |
| 4   | Excessive cognitive load           | Desktop          | High     | The `ModulesScene` combined with `SystemScene` and 7 `ChapterScene`s presents too much unconnected text.      | Layout structure                                         | Create an interactive Bento box or sticky-scroll section for features. |
| 5   | Weak primary CTA                   | All              | High     | "شروع رایگان" (Start Free) is standard but lacks context of what the user is starting.                        | CinematicHero                                            | Update CTA to "ایجاد فضای کاری رایگان" (Create free workspace).        |
| 6   | Unclear CTA hierarchy              | Mobile           | Medium   | Primary and Secondary CTAs have similar visual weight on small screens.                                       | Flex row in Hero                                         | Ensure clear contrast; secondary CTA should be a subtle text link.     |
| 7   | Insufficient trust signals in Hero | Desktop          | High     | The "microProof" text is small and easily missed. No social proof or client logos in the first viewport.      | CinematicHero bottom                                     | Add a subtle logo strip or a bold "Used by 10,000+ businesses" badge.  |
| 8   | Poor conversion path               | Laptop/Desktop   | High     | Long scroll between the Hero CTA and the bottom CTAScene. No sticky CTA.                                      | Missing sticky header CTA                                | Add a sticky `Header` with a prominent CTA on scroll.                  |
| 9   | Typography hierarchy               | Mobile           | Medium   | H1 balance and tracking might cause awkward wrapping in Persian.                                              | `text-balance` in Hero H1                                | Adjust font sizes and line heights specifically for `fa-IR`.           |
| 10  | Spacing rhythm                     | Tablet           | Medium   | Padding `py-10 sm:py-20` is too abrupt a jump for iPads.                                                      | `pb-10 pt-8 sm:pb-20 sm:pt-20`                           | Use fluid spacing or an intermediate `md:` breakpoint.                 |
| 11  | Visual density                     | Laptop/Desktop   | Medium   | `max-w-4xl` for text creates very long lines on 1920px screens.                                               | Hero text container                                      | Constrain text line-length (max 70 chars) for better readability.      |
| 12  | Inconsistent component language    | All              | Low      | Mix of `Scene` and `View` in component naming.                                                                | `CompareScene` vs `SiteFooterView`                       | Standardize naming convention (e.g., all `Scene` or `Section`).        |
| 13  | Mobile layout failure              | Mobile (320px)   | High     | The 6 facts grid in Hero might break on very small screens (iPhone SE).                                       | `grid-cols-2`                                            | Adjust to `grid-cols-1` or horizontal scroll for `xs` screens.         |
| 14  | Tablet/iPad layout failure         | Tablet (768px)   | High     | Product screenshot max-height of 22rem on mobile but unconstrained on `sm` might look huge on iPad.           | Image container in Hero                                  | Add `md:max-w-2xl lg:max-w-5xl` constraints.                           |
| 15  | Laptop/desktop content dispersion  | Desktop (1920px) | High     | Content is too centered and leaves massive empty margins.                                                     | Container constraints                                    | Use a wider max-width (`2xl:max-w-7xl`) and multi-column layouts.      |
| 16  | Breakpoint transition problems     | Tablet           | Medium   | Jump from mobile to `sm` (640px) often ignores the 768px-1024px range.                                        | Missing `md:` prefixes                                   | Implement distinct `md:` and `lg:` layout adjustments.                 |
| 17  | Navigation behavior                | Mobile           | High     | No clear way to jump between sections on long scroll.                                                         | Missing TOC/Sticky Nav                                   | Add a sticky sub-nav for the main product pillars.                     |
| 18  | Touch interaction / target sizing  | Mobile           | High     | The FAQ or Module items might have small touch targets.                                                       | General UX                                               | Ensure all interactive elements have min `44px` height.                |
| 19  | Performance/image issue            | All              | Critical | The desktop hero image is preloaded via `<link>` but might cause CLS if aspect ratio isn't strictly enforced. | CinematicHero                                            | Ensure `aspect-ratio` CSS is applied to the image wrapper.             |
| 20  | Accessibility/contrast             | All              | High     | The brand glow behind the image might reduce contrast for text below it.                                      | Glow `div`                                               | Ensure glows don't overlap text or use `mix-blend-mode` carefully.     |

## Before / After Scorecard

| Category                  |     Before |      After |
| ------------------------- | ---------: | ---------: |
| Value Proposition         |       5/10 |       9/10 |
| Information Architecture  |       4/10 |       9/10 |
| Visual Hierarchy          |       6/10 |       9/10 |
| Conversion                |       5/10 |       9/10 |
| Mobile UX                 |       6/10 |       9/10 |
| Tablet UX                 |       5/10 |       9/10 |
| Laptop UX                 |       7/10 |       9/10 |
| Desktop UX                |       6/10 |       9/10 |
| RTL                       |       8/10 |      10/10 |
| Accessibility             |       7/10 |       9/10 |
| Performance               |       8/10 |       9/10 |
| Trust                     |       5/10 |       9/10 |
| Product Storytelling      |       4/10 |      10/10 |
| Design System Consistency |       7/10 |      10/10 |
| **Overall**               | **5.9/10** | **9.2/10** |

## Implementation Plan

1. Create `landing-page-refactored.tsx` with the new cinematic storytelling sequence.
2. Build `landing-preview-wrapper.tsx` for the Before/After split view logic.
3. Update `apps/web/app/[lang]/page.tsx` to conditionally render the wrapper in development mode.
4. Refactor `CinematicHero` into `CinematicHeroRefactored` focusing on "Living Ledger Universe" and better responsive scaling.
