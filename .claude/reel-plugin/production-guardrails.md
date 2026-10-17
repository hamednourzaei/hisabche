# Hisabche Promo Reel — Production Guardrails & Quality Standards
> **Path:** `.claude/reel-plugin/production-guardrails.md`  
> **Status:** Hard-locked repository rules for 10/10 SaaS Production standard

These rules are permanent and non-negotiable. Any pull request or generated reel that violates these guardrails will be rejected.

---

## 1. Clean On-Screen Subtitles & Zero Debug Header Leak

- **The Live Karaoke Subtitle:** Every reel MUST feature the sleek, live word-by-word highlighted Persian subtitle bar anchored at the bottom of the 9:16 canvas.
- **STRICTLY BANNED inside the 9:16 video frame:**
  - `ریتم هجاهای فارسی (تخمینی)`
  - `PROVISIONAL`
  - `DEBUG`
  - `confidence:null`
  - `ASR_GENERATED`
  - `FORCED_ALIGNMENT_GENERATED`
  - Internal scene metadata pills
  - Strategy labels (e.g. `● هوک اضطراری / زنگ خطر بازار`, `● تشدید تضاد`)
  - Developer diagnostics or audio engine notes
- **Where Strategy Belongs:** All strategy labels, persona intents, and director's cues live exclusively in `docs/prompts/reel-XX-prompt.md` and the external player sidebar.
- **Subtitle Styling:** A clean, centered, glassmorphic caption bar:
  - Full border radius pill (`border-radius: 999px`)
  - Typography: 18px–20px, bold, `text-wrap: balance`
  - Background: `rgba(8, 7, 18, 0.85)` with `backdrop-filter: blur(24px)`
  - Active words pop with subtle kinetic scale (`scale(1.15)`) and cyan glow.

---

## 2. Climax Visibility & Strictly Positive Timing Math

- **Climax Hold Time:** Every scene turning point (e.g. `برگشت خورد ❌` stamp, chart fracturing, bank balance drop, cheque cleared banner) MUST trigger **at least 1.2s to 1.8s BEFORE the scene ends**.
- **100% Full Opacity:** During that entire 1.2s–1.8s hold time, the climax elements MUST remain at `opacity: 1.0` and full brightness so the human viewer can read and process the consequence.
- **Late Fade-Out:** Scene exit transitions must be confined strictly to the **final 0.18s** of the scene (`t >= scene.duration - 0.18`). Never start dimming 1 second early.
- **Strictly Non-Negative Countdown Math:**
  - Countdown timers must never output negative numbers (e.g. `-۱۸:۱۱:۵۸` at `t=0`).
  - Always clamp math with `Math.max(0, ...)` and `Math.min(...)`.
  - For a 12:00:00 deadline, count cleanly: `۱۱:۵۹:۵۷` -> `۱۱:۵۹:۵۸` -> `۱۱:۵۹:۵۹` -> `۱۲:۰۰:۰۰`.

---

## 3. 9:16 Vertical Canvas Balance & Persian UX

- **Never Leave the Top 30–35% Empty:**
  - In problem scenes, anchor a bold top headline (`.scene-top-headline`) in the upper zone (e.g. `فروش بالا روی کاغذ؛ اما حساب بانکی خالی!`).
  - In solution scenes, anchor the Hisabche brand emblem and slogan at the top from `t = 0`.
- **Full-Width Stacked Cards (No Narrow Columns):**
  - Never cram > 18 characters of Persian text into narrow 2-column side-by-side boxes.
  - Use stacked full-width horizontal cards with generous inner padding (`>= 22px`).
  - Always use `text-wrap: balance` on headlines and subtitle lines.
- **Micro-Interactions & Tactile Physics:**
  - Stamp impacts must have a horizontal micro-shake (`translateX(${shakeX}px)`) and red border pulse.
  - Cleared/settled banners must pulse with emerald green neon glow (`emeraldGlowPulse`).
  - Card entrances must use organic spring physics (`spring(t - enterAt)`).

---

## 4. Acoustic Audio Design

- **Whoosh (< 450Hz):** Never inject raw white noise. Filter noise with a 1-pole low-pass filter at ~380Hz to create smooth, organic air displacement.
- **Impact (55Hz Punch + Wood Slap):** Rubber-stamp slams must combine a deep 55Hz sub-bass punch with a fast-decay tactile wood slap transient.
- **Tactile Chimes:** Avoid piercing high-frequency electronic pings. Use warm muted acoustic triads (E4, G4, B4 ~ 329.6Hz to 493.8Hz).

---

## 5. Persian Merchant Realism & Math Coherence

- **Bazaar Vocabulary:** Use authentic terms natural to Iranian and Afghan business owners:
  - `چک صیادی بنفش` (Sayadi purple cheque)
  - `نسیه` (Consignment / trade credit)
  - `راس‌گیری` (Maturity weighting & invoice settlement)
  - `کاردکس` (Warehouse inventory bin card)
  - `بهای تمام‌شده` (Cost of Goods Sold - COGS)
  - `مغایرت حساب` (Ledger discrepancy)
  - `خواب سرمایه` (Stagnant capital)
- **Mathematical Consistency:** The numbers must add up across all scenes:
  - If Scene 1 establishes a 600M cheque with 598.6M deficit, and Scene 2 establishes 430M trapped receivables...
  - Scene 3 must show debtor cards that sum to 430M (e.g. 185M + 145M + 100M = 430M).
  - Scene 4 must show 430M collected, allowing the 600M cheque to clear cleanly.
  - Never invent contradictory numbers between scene beats.

---

## 6. HARD RULE 1 — NUMBERS MUST NEVER BLINK (Numeric Continuity)

- **Continuous Readability:** Once a meaningful number is introduced (`۷۵ میلیون`, `۳۰ میلیون`, `۱۰۰٬۰۰۰`, `۵۰٪`), it must remain continuously readable and steady on screen.
- **Banned Pattern:** Never do `opacity: 0 -> 1 -> 0 -> 1` or binary mask toggling on numerical information.
- **No Strobe or Modulo Wrapping:** Odometer and slot rollers must slide monotonically without wrapping modulo (e.g. jumping between 9.9 and 0 during spring bounce).
- **Transformation Lifecycle:**
  ```text
  INTRODUCE -> HOLD -> TRANSFORM / UPDATE if necessary -> HOLD -> EXIT only when narratively justified
  ```
- **Deliberate Transformation:** When changing values (e.g. 75M to 30M), use a directional transition, sliding transform, or clear strike-through. Never crossfade both to zero opacity simultaneously.

---

## 7. HARD RULE 2 — EVERY MAJOR ELEMENT NEEDS REAL MOTION

- **Beyond Opacity:** Major scene elements (cards, charts, tables, alerts, UI panels) must NOT merely fade in/out.
- **Physical Motion Channels:** Use `translateY`, `translateX`, `scale`, `clip/reveal`, `mask/reveal`, and organic springs (`studioSpring`).
- **Charts:** Use `strokeDraw`, `grow`, `expand`, `counter`.
- **Tables:** Use row stagger, highlight sweep, focus movement.
- **Alerts:** Use slide, scale, pulse, shake, impact.
- **Purposeful:** Motion must communicate visual hierarchy or state transition, never gratuitous noise.

---

## 8. HARD RULE 3 — MOTION CONTINUITY BETWEEN STATES

- When Scene A transitions into Scene B, prefer continuous morphing or directional handoffs over raw cut-and-fade.
- Visual elements should carry narrative momentum: an invoice card transforms into an audit diff card; a sum figure splits into branch sub-totals.

---

## 9. HARD RULE 4 — 9:16 SAFE COMPOSITION & CENTER OF GRAVITY

For 1080×1920 (or 540×960 base coordinate space):
- **Title Zone:** Top 10%–22% (Y: ~100px–210px in 960p)
- **Primary Visual Zone:** 25%–65% (Y: ~240px–620px in 960p) — The optical center of gravity MUST live here.
- **Secondary / Support Zone:** 55%–75%
- **Subtitle / Caption Zone:** Bottom 80%–94% — PURE OVERLAY.
- **Center of Gravity Rule:** The main visual content must NEVER drift into the lower third. Never push cards down to avoid subtitles; move the main UI up and center it.
- **No Empty Upper Half:** Eliminate huge dead spaces in the top/middle of the frame.

---

## 10. HARD RULE 5 — FINAL CTA TIMING & MINIMUM 3-SECOND HOLD

- **Timing Budget:** For a 20–30s reel, the final CTA must start at least 4–5 seconds before the video ends.
- **Minimum Hold:** The primary CTA card and branding MUST have at least **3.0 seconds of readable, full-opacity hold time**.
- **Early Entrance:** The CTA card must enter within the first 0.3s–0.5s of the CTA scene. Word cues like `cta-button-pulse` trigger a subtle accent glow, NOT the first appearance of the card.
- **Intentional Final Frame:** The final frame must look like a polished advertising end card:
  - CTA fully visible and at 100% opacity.
  - Brand identity and URL (`hisabche.com`) razor-sharp and centered.
  - Zero elements mid-transition, zero clipped cards, zero debug headers.

---

## 11. HARD RULE 6 — SCENE TIMING BUDGET

Every scene must obey an explicit pacing budget:
```text
ENTRY (0.2s - 0.5s) -> BUILD -> CLIMAX -> HOLD (>= 1.2s - 1.8s) -> EXIT (final 0.18s max)
```
Never rush the climax or hold phase.

---

## 12. HARD RULE 7 — NO MICRO-FLASHES

- Ban repeated React key re-mounting on unchanged elements.
- Ban independent unsynchronized opacity timelines that cause elements to wink out and back in.
- Ban binary CSS mask switching (`maskImage: isLocked ? 'none' : 'gradient'`).
- Ensure all animation math is clamped and continuous.

---

## 13. HARD RULE 8 — ONE MASTER TIMELINE

- Major visual elements within a scene must derive strictly from the deterministic scene clock `t`.
- Same input time always produces the exact same frame. Scrub-safe, deterministic, zero layout shift.

---

## 14. HARD RULE 9 — SUBTITLE DOES NOT CONTROL LAYOUT

- The live karaoke subtitle is strictly a **floating overlay** (`position: absolute; pointer-events: none`).
- It must NEVER participate in flex calculations or squeeze the main content upward/downward into awkward postures.

---

## 15. HARD RULE 10 — MOTION PRESETS

Use standardized, deterministic studio motion presets (`src/engine/motion-presets.ts`):
- `enterUp`, `enterDown`, `enterScale`, `clipReveal`, `highlightSweep`, `staggerEnter`, `stableHold`.

---

## 16. HARD RULE 11 — CONTEXT POSITION AUDIT

- Maintain diagnostic bounding-box auditing (`src/engine/composition-audit.ts`) to ensure the visual center of gravity (`contentCenterY`) remains in the safe 42%–58% zone of the 9:16 frame.

---

## 17. HARD RULE 12 — FINAL SLIDE VALIDATION

Before export approval:
- Verify final CTA is visible, fully opaque, with hold >= 3.0 seconds.
- Verify no important number is hidden or blinking.
- Verify no debug metadata or provisional warnings appear inside the canvas.

## 18. HARD RULE 13 — AV SYNC LAW (owner, 17 Oct 2026)

«صدا با تصویر هماهنگ نیست» is no longer a review note; it is a number, and the export refuses the file.
Code: `scripts/sync-law.mjs` (pure, one definition — mixer, gate and browser preview all import it) ·
`scripts/sound-design.mjs` (`cuePlacements`) · `scripts/check-av-sync.mjs` (the gate).
Tests: `scripts/__tests__/av-sync-law.test.mjs` (library) · `src/__tests__/av-sync-law.test.ts` (scripts, reel ≥ 60).

**Script (reel ≥ 60)**
1. A word with a `sound` has an `action`, and the actor reads that action's time with `cueAt(plan, '<action>', fallback)`. The action string must appear in the actor file.
2. A `sentenceEnding` carries **no sound** — a hold is not an event.
3. Two cues closer than 120 ms share one sound (`placedCues`).

**Library (every file in `assets/sfx/manifest.json`)**
4. The hit point is the first onset (5 ms RMS above 300 Hz, 2.2× the previous 40 ms) that reaches half the file's loudest frame within 30 ms. That frame lands on the cue.
5. At most 20 ms is kept before the hit (faded in) — a shimmer ahead of the hit is heard as «early».
6. Every event file is a transient whose FIRST hit leads (no later hit > 1.25× the first). Swells, rustle textures and «riffle then slap» files are not allowed for event kinds.
7. Files normalised (after the trim) to a 0.5 peak; raw peak below −45 dB refused.

**Mix**
8. Choke: each sound fades out (60 ms) and is silent 40 ms before the next hit.
9. Music bed by average level (RMS 0.008), never peak — a dense track at the events' level buried them.
10. Master make-up gain stops where the loudest hit is 80% of the ceiling; loudness never flattens the hits.
11. The scene-cut thump is 0.25 s, under the scene's first event.

**Gate** — every export measures the finished file: each transient must start within ±45 ms of its cue, or the export fails (`blockedBy: 'AV_SYNC'`).
Fast check while writing: `node scripts/check-av-sync.mjs <id> --mix` (seconds). On a file: `node scripts/check-av-sync.mjs <id>`.

What it found on reel 60 (before): clockTick +585 ms, alert +600 ms, impact/markerScribble not heard at all, sparkle 145 ms early — causes: lead silence in files, music too loud after peak-normalising, master loudness raising the bed back up, swell files used for hits.

---

## 19. HARD RULE 14 — ONE FOCAL STAGE & ON-STAGE TEXT BUDGET (owner, 17 Oct 2026)

- **One Single Focal Area:** The 9:16 vertical canvas must have exactly ONE dominant visual focal area and one stable subtitle bar.
- **Strictly Dedicated Safe Zones:**
  - **Subtitle Zone:** Anchored exclusively at the bottom safe area (`bottom: 80px`). It is a pure floating overlay.
  - **Primary Visual Zone:** Kept strictly centered in the central frame ($Y \in [42\%, 58\%]$).
  - **Subordinate Branding:** Minimal metadata, badges, or emblems must remain subordinate to the primary visual.
- **Banned Visual Clutter Behaviors:**
  - **Zero Duplicated Narration:** Never render the spoken voiceover sentence as a headline or card title above the subtitle bar. The subtitle system is the sole place for the spoken dialogue.
  - **No Floating Commentary:** Never introduce independent textual commentary (e.g., «راه دیگری هم هست…», «حالا چی کار کنیم؟») that competes with the narrator's voice.
  - **No Multiple Vertical Text Streams:** Banned to have simultaneous text running at top, middle, and lower-middle.
- **Hard On-Stage Text Budget:**
  - Default to **ZERO decorative text**.
  - Only functional labels communicating essential visual information are permitted (e.g., shelf code `B-04`, product name, quantity).
  - Prefer **one or two words per label**.
  - **Hard ceiling:** At most **6 words** of total non-subtitle on-stage text visible at any single point in time.
  - Numbers and essential labels must be large and instantly legible on mobile screens (zero walls of tiny microcopy).

---

## 20. HARD RULE 15 — NATURAL PERSIAN COPY & ZERO BROKEN FRAGMENTS (owner, 17 Oct 2026)

- **Natural Bazaar Idioms:** All on-screen copy and voiceover dialogue must use authentic, natural Persian phrasing suited for Iranian merchants.
- **Strictly Banned Copy Fragments:**
  - Reject unnatural, clipped, or stilted fragments such as `«بار گم»`, `«آدرس بار»`, `«بار رو بی‌تلفن پیدا کن»`.
- **Communicate Through Visual State:**
  - When communicating a consequence (e.g., lost stock, unknown location, missing worker), use **visual state and motion** (e.g., carton fading into a gray silhouette, note detaching and dissolving, animated question mark emerging) rather than slapping an awkward text tag onto the frame.

---

## 21. HARD RULE 16 — ELIMINATION OF HORIZONTAL DIVIDERS & LINE ARTIFACTS (owner, 17 Oct 2026)

- **No Accidental Dividers:** The background and stage must NEVER contain accidental horizontal divider lines, neon boundary bars, or split-screen borders (such as the green line produced by `.r61-horizon`).
- **Unified Spatial Canvas:** A scene must not be arbitrarily split into "top" and "bottom" sub-canvases that jump or resize between scenes. Every scene must occupy a cohesive, unified 9:16 coordinate plane.

---

## 22. HARD RULE 17 — EVIDENCE-BASED AUDIO & SUBTITLE SYNCHRONIZATION (owner, 17 Oct 2026)

- **No Unsupported Synchronization Claims:**
  - Never claim millisecond-accurate word-level synchronization based merely on silence detection, proportional pacing, or file duration.
  - Silence detection identifies acoustic phrase/sentence boundaries; it does NOT establish individual word boundaries.
- **Honest Alignment Lifecycle States:**
  - `WORD_SYNC_VERIFIED`: Assigned ONLY when verified forced-alignment (or verified ASR word timestamps) with matching audio checksum exists.
  - `PHRASE_SYNC_VERIFIED`: Assigned when voiceover phrases are anchored to measured acoustic speech intervals, and word positions are anchored estimates.
  - `PROVISIONAL_CADENCE_MODEL_ACTIVE`: Assigned when voiceover audio is pending or estimated via cadence math (`isProvisional: true`, `confidence: null`).
- **Timing Alignment to Actual Speech:**
  - Words must appear when spoken; never stretch words uniformly across trailing silence.
  - Visual actions may anticipate a spoken keyword by at most 0.1s–0.2s only when motivated by natural motion design.

