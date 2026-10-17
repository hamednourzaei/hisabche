# Slash Command: /create-reel

Automated workflow to generate a new SaaS product reel adhering to all 15 Studio Governance standards without requiring prompt reminders.

## Syntax
```
/create-reel [Topic or Customer Pain Point]
```

## Execution Protocol

When this command is triggered:

1. **Read Master Constitution & Governance:**
   - Load `CLAUDE.md`.
   - Check `docs/studio-governance/hisabche-product-truth.md` for authentic features.
   - Check `docs/studio-governance/customer-pain-points.md` to identify the customer persona and authentic vocabulary.

2. **Audit Recent History in `src/data/reel-ledger.json`:**
   - Read the last 3 reels from `src/data/reel-ledger.json`.
   - Identify their Themes, Hook Formulas, and Layout Topologies.
   - Enforce: The new reel MUST pick a Theme, Hook Formula, and Scene-1 Topology that is DIFFERENT from the previous reel (Anti-Repetition 30% rule).

3. **Enforce Structural Constraints:**
   - Exactly 5 scenes totaling exactly 59 seconds (or specified duration).
   - Enforce **The 20% Card Quota**: at most 1 scene with cards/pills; the other 4 scenes must use live interactive charts, full-bleed kinetic typography, authentic product UI, or spatial 2.5D diagrams.
   - Zero hardcoded currency names ("افغانی", "تومان", "دلار"). Format pure digits with `faNumber()`.
   - Zero specific food commodities. Use generic B2B goods.
   - Voiceover pacing: max 2.5 to 2.8 words/second per scene.
   - HarfBuzz ligature preservation: zero `char-by-char` word breaks. Word-by-word or line-mask only.
   - Deterministic frame math ($f(\text{frame})$): zero `Math.random()`, zero `setTimeout()`, zero `Date.now()`.

4. **Code Generation:**
   - Write the new reel in a modular reel file (or register in the current batch, e.g. `src/reels/reels-26-30.ts`).
   - Register the reel in `src/reels/index.ts`.
   - Add/update verification tests in `src/__tests__/motion-engine.test.ts`.

5. **Log into Ledger:**
   - Append the new reel record into `src/data/reel-ledger.json` with its metadata, theme, hook formula, and layout topologies.

6. **Automated Verification:**
   - Run:
     ```bash
     node ../node_modules/typescript/bin/tsc --noEmit -p .
     node ../backend/node_modules/vitest/vitest.mjs run
     node ../node_modules/eslint/bin/eslint.js src/
     npm run build
     ```
   - Must exit 0 with 0 errors and 0 warnings.
