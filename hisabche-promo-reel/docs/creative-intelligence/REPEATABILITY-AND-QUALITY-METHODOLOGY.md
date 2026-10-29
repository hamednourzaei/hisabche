# Repeatability and Quality Methodology

## Scientific Principles

The Hisabche Creative Intelligence system operates on three foundational principles:

1. **Zero Hallucination:** Every claim regarding text, timing, colors, audio cues, and layout is verified directly against the TypeScript source code.
2. **Deterministic Reproducibility:** Running `node scripts/export-creative-intelligence.mjs` regenerates the entire library from scratch with 100% bitwise parity.
3. **Evidence Classification Hygiene:** Statements are explicitly classified as `SOURCE_VERIFIED`, `RENDER_VERIFIED`, `INFERRED`, `NOT_ESTABLISHED`, or `REQUIRES_AUDIENCE_TEST`.

## Maintenance and Lifecycle

Whenever a reel is created, refactored, or tuned:

1. Edit the reel source in `src/reels/`.
2. Run `node scripts/export-creative-intelligence.mjs` to update the Creative Bible.
3. Run `node scripts/validate-creative-intelligence.mjs` to verify schema integrity.
