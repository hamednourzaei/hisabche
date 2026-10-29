# Hisabche Creative Intelligence & Quality Operating System

Authoritative creative intelligence layer, quality scoring rubric, repetition analysis, and improvement backlog for all 107 promotional reels in Hisabche Promo Reel Studio.

## Core Deliverables

- [`SCORING-RUBRIC.md`](SCORING-RUBRIC.md): 9-dimension weighted quality rubric with explicit anchors.
- [`HOOK-STORY-ANALYSIS.md`](HOOK-STORY-ANALYSIS.md): Comprehensive taxonomy and narrative stage audit of all 107 reels.
- [`REPETITION-ANALYSIS.md`](REPETITION-ANALYSIS.md): Pairwise similarity and topology clustering across the catalogue.
- [`PRIORITIZED-IMPROVEMENTS.md`](PRIORITIZED-IMPROVEMENTS.md): P0–P3 prioritized creative & technical backlog.
- [`PLATFORM-READINESS.md`](PLATFORM-READINESS.md): Short-form platform matrix (Reels, TikTok, Shorts).
- [`RENDER-REVIEW.md`](RENDER-REVIEW.md): Headless visual QA and render verification status.
- [`AUDIENCE-TESTING-PLAN.md`](AUDIENCE-TESTING-PLAN.md): Empirical hypothesis-driven testing protocol.
- [`creative-catalogue.json`](creative-catalogue.json): Normalized machine-readable catalog.
- [`FINAL-REPORT.md`](FINAL-REPORT.md): Executive verification summary.
- [`reels/`](reels/): 107 individual creative briefs (`reel-01.md` to `reel-107.md`).

## Regeneration & Validation

```bash
node scripts/export-creative-intelligence.mjs
node scripts/validate-creative-intelligence.mjs
```
