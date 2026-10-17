# Slash Command: /upgrade-reel

Automated workflow to upgrade an existing reel in `./hisabche-promo-reel` to Studio-Grade SaaS standards, eradicating visual repetition and card-quota violations.

## Syntax
```
/upgrade-reel [Reel ID, e.g. 23]
```

## Execution Protocol

1. **Locate Target Reel:**
   - Find reel definition by ID in `src/reels/` (e.g. `customer-films.ts`, `reels-11-20.ts`, etc.).
   - Read its current scene specs and voiceover copy.

2. **Diagnose Repetition & Quota Violations:**
   - **The 20% Card Quota:** Does the reel contain more than 1 card/pill/badge scene?
   - **The 4-Pill-Card Trap:** Does any scene stack 4 rounded cards vertically on a dark grid?
   - **Topology Diversity:** Does the reel lack rotating layout topologies (Split-Screen, Asymmetric Swiss, 2.5D Isometric, Full-Bleed)?
   - **Voiceover Pacing:** Does any scene exceed 2.8 words/second?

3. **Choreograph High-Craft SaaS Replacement:**
   - Replace repetitive card lists with:
     - Live procedural charts (waterfall, ledger balance scale, real-time counters).
     - Full-bleed kinetic typography with word-by-word HarfBuzz-safe highlights.
     - Authentic product UI mockups with interactive cursors and realistic data flows.
     - 2.5D spatial camera moves and depth of field.
   - Strictly ban any hardcoded currency names or specific food commodities.

4. **Update Code & Ledger:**
   - Apply clean, drop-in replacement to the reel's source code.
   - Update `src/data/reel-ledger.json` reflecting the upgraded layout topology and theme.

5. **Automated Verification:**
   - Execute:
     ```bash
     node ../node_modules/typescript/bin/tsc --noEmit -p .
     node ../backend/node_modules/vitest/vitest.mjs run
     node ../node_modules/eslint/bin/eslint.js src/
     npm run build
     ```
   - Must exit 0 with 0 errors and 0 warnings.
