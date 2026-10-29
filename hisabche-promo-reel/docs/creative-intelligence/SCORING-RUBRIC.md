# Hisabche Promo Reel Studio — Creative Quality Scoring Rubric

## Overview

This document defines the authoritative 9-dimension scoring rubric used to evaluate the creative and technical quality of all 107 reels in the Hisabche Promo Reel catalogue.

## Mathematical Formulation

Each reel is evaluated across 9 weighted dimensions on a 0–10 scale:

$$\text{Weighted Score} = \sum_{i=1}^{9} \left( \frac{\text{Dimension Score}_i}{10} \times \text{Weight}_i \right) \times 10$$

The maximum attainable score is **100 points**.

## Dimension Weights and Anchor Definitions

| Dimension                             | Weight  | Anchor 0 (Failing)                                                            | Anchor 5 (Acceptable)                                                           | Anchor 10 (Masterclass)                                                                               |
| ------------------------------------- | :-----: | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **1. Hook clarity and specificity**   | **15%** | Logo fade, greeting, or vague abstract slogan. Zero visceral hook.            | Understandable generic business question; lacks immediate quantifiable tension. | Specific commercial metric, binary dilemma, or acute risk stated in <1.5s with frame-0 visual arrest. |
| **2. Audience/problem relevance**     | **15%** | Irrelevant software jargon without connection to real merchant anxiety.       | Plausible operational feature; moderate emotional engagement.                   | Direct bullseye on visceral merchant pain (deadstock, credit leak, tax panic, stock mismatch).        |
| **3. Story progression**              | **15%** | Static slides or disconnected feature dump with no narrative thread.          | Basic Problem -> Solution structure without dramatic consequence or proof.      | Complete narrative arc: Hook -> Friction -> Consequence -> Intervention -> Proof -> Resolution.       |
| **4. Product message clarity**        | **15%** | Misleading, exaggerated, or confusing claim about software capabilities.      | Understandable concept, but software intervention mechanism remains fuzzy.      | Crystal-clear demonstration of exact automatic software behavior and verifiable output.               |
| **5. Visual hierarchy & readability** | **10%** | Overlapping text clusters, clipping off-screen, or unreadable color contrast. | Legible text, but competing focal points or dense information clusters.         | Single focal point, ≤6 words per cluster, container-local coordinates, and high-contrast tokens.      |
| **6. Motion purpose and coherence**   | **10%** | Unmotivated chaotic animations, jarring cuts, or linear mechanical motion.    | Standard UI springs and basic entry cards without narrative choreography.       | Bespoke choreography where physics and easing mirror narrative metaphor; organic dampening.           |
| **7. Pacing and information density** | **10%** | Rushed frames (<1.5s reading time) or sluggish dwell times (>9s static hold). | Acceptable reading window; occasional timing hitch during complex tables.       | Golden reading window (2.0s–3.5s per concept) with natural breathing pauses between scenes.           |
| **8. CTA clarity & alignment**        | **5%**  | Missing, broken, or conflicting conversion action.                            | Generic website URL without compelling reason or incentive.                     | Contextualized commercial trigger («شروع رایگان در hisabche.com») seamlessly concluding narrative.    |
| **9. Distinctiveness in catalogue**   | **5%**  | Exact clone or indistinguishable variation of another catalog reel.           | Reusable layout topology with customized copy and colors.                       | Fully bespoke visual architecture, unique hero props, and non-repeating transition vocabulary.        |

## Dual-Score Output Protocol

- **Source-Based Creative Score:** Evaluated strictly from source code, AST inspection, narrative matrix, and motion plan.
- **Render-Verified Creative Score:** Requires frame-by-frame visual inspection of headless Chrome/Remotion output. Classified as `NOT_ASSESSED — PENDING_FULL_BATCH_RENDER` until rendered.
