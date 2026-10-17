# Hisabche Motion Graphics Prompt Library — Source Registry & Legal Auditing

> **Status:** Fully Audited & Clean  
> **Collection Date:** 2026-10-17  
> **Compliance Officer:** Autonomous Reel Studio  
> **Policy:** Text-only research, strict rate limits (≤ 1 req/sec), no credentialed surfaces, zero verbatim storage except under CC BY 4.0 with full attribution.

---

## 1. Ethical & Legal Ingestion Policy

All motion-graphics techniques and prompt architectures in this repository were collected following strict legal and safety protocols:

1. **Robots.txt & Terms Verification:** Every host was audited for crawler allowances before querying. Disallowed paths were respected.
2. **Rate Limiting:** Requests were throttled to at most one request per second per site with honest User-Agent headers.
3. **No Verbatim Piracy:**
   - **HeyDreaming (CC BY 4.0):** Prompts are stored and adapted under Creative Commons Attribution 4.0 International, citing title, author, canonical URL, and adaptation notes.
   - **All Other Sites:** No verbatim prompt text is stored. Only abstract motion techniques, easing physics, camera choreographies, and layout dynamics were extracted and rewritten from scratch for Hisabche's authentic merchant narrative.
4. **No Reverse Engineering / No Gated Access:** Public documentation and web showcases only; no logins, sessions, or private endpoints were touched.

---

## 2. Visited Sources Audit Table

| #      | Domain & Landing URL                                    | Inspection Date | License / Terms Discovered                                                                                 | Robots.txt Result                                                                 | What Was Extracted & Re-authored                                                                                                                                                                                                                                                   | Compliance Status                 |
| ------ | ------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **1**  | `https://promptmotion.org/prompts`                      | 2026-10-17      | Public community showcase of Claude-coded motion design prompts. Individual creators credited via handles. | `User-Agent: * Allow: /`                                                          | Extracted motion choreographies: single dot continuous traveler (`p-f6775974`), flipbook bounce typography (`p-2c76f525`), metric counter morphing into SVG line graph (`p-539f86ad`), and 3-way split comparison (`p-58e1738b`). No verbatim prompt text stored.                  | **COMPLIANT** (Technique Only)    |
| **2**  | `https://oneshotted.io/`                                | 2026-10-17      | Public showcase of AI-coded motion graphics (Remotion, GSAP, Canvas, Three.js).                            | `User-agent: * Disallow:`                                                         | Architectural taxonomy (kinetic type, product launch, UI walkthrough, data-viz, explainer, showreel, web scroll), continuous shape morph loop (`twoclipping`), and multi-layer Z-plane parallax. No verbatim text stored.                                                          | **COMPLIANT** (Technique Only)    |
| **3**  | `https://runway.com/resources/ai-video-prompting-guide` | 2026-10-17      | Proprietary educational resource by Runway AI Inc.                                                         | `User-agent: * Allow: / Disallow: /api/gated-resource/`                           | Extracted 4-part prompt formula: `[Camera Movement] + [Scene] + [Action] + [Details]`, shot-leading syntax (macro push-in, tracking shot parallel, drone ascending, low-angle locked, whip-pan), positive phrasing rules, and Foley acoustic layering. No verbatim prompts stored. | **COMPLIANT** (Technique Only)    |
| **4**  | `https://heydreaming.com/prompts`                       | 2026-10-17      | Creative Commons Attribution 4.0 International (CC BY 4.0).                                                | `User-agent: * Allow: / Disallow: /dashboard Disallow: /api/`                     | Stored and adapted prompts with explicit CC BY 4.0 attribution: tactile micro-textures, 360 turntable orbit, exploded levitation layers, and easing deceleration curve `cubic-bezier(0.22, 0.8, 0.2, 1)`.                                                                          | **COMPLIANT** (CC BY 4.0 Adapted) |
| **5**  | `https://ai9app.io/video-prompts`                       | 2026-10-17      | Public AI creative marketplace & prompt catalog.                                                           | `User-agent: * Allow: / Disallow: /api/ Disallow: /uploads/`                      | Interface depth layering, SaaS teaser pacing, and role permission lock mechanics. No verbatim prompt text stored.                                                                                                                                                                  | **COMPLIANT** (Technique Only)    |
| **6**  | `https://www.medeo.app/prompts/video`                   | 2026-10-17      | Public video motion prompts repository.                                                                    | `User-Agent: * Allow: / Disallow: /*?* Disallow: /__test__ Disallow: /preview`    | Fast state-switching transitions, split-screen order vs chaos contrasts, and high-energy pace modulations. No verbatim prompt text stored.                                                                                                                                         | **COMPLIANT** (Technique Only)    |
| **7**  | `https://imageprompts.app/video-prompts`                | 2026-10-17      | Free public AI prompt directory.                                                                           | `User-Agent: * Allow: /video-prompts Disallow: /admin Disallow: /api/`            | Zoom-through camera gates, speed-ramp acceleration/deceleration, and macro textile surface lighting. No verbatim prompt text stored.                                                                                                                                               | **COMPLIANT** (Technique Only)    |
| **8**  | `https://www.freeveoprompt.com/`                        | 2026-10-17      | N/A (Server-side TLS error).                                                                               | Host unreachable via TLS handshake (`remote error: tls: internal error`).         | Skipped entirely per safety guidelines. Zero requests retained.                                                                                                                                                                                                                    | **SKIPPED** (Unreachable)         |
| **9**  | `https://soprompts.com/free-ai-video-prompts`           | 2026-10-17      | Public free AI video prompt library.                                                                       | `User-agent: * Allow: / Disallow: /admin/ Disallow: /(dashboard)/ Crawl-delay: 1` | Countdown urgency timers, chronological day-in-the-life timelines, and multi-currency ticker tickers. No verbatim prompt text stored.                                                                                                                                              | **COMPLIANT** (Technique Only)    |
| **10** | `https://wadepixels.com/prompts.html`                   | 2026-10-17      | Design portfolio & prompt handbook by Wade Pixels.                                                         | `404 Not Found` for robots.txt (No crawler restrictions specified).               | 3D tilted card decks (`rotate(-9deg) translate(-32%, 6%)`), frosted glassmorphic card overlays (`backdrop-filter: blur(22px)`), typographic line rise (`translateY(108%) -> 0`), and infinite ticker drift. No verbatim prompt text stored.                                        | **COMPLIANT** (Technique Only)    |

---

## 3. License Attribution Notice for HeyDreaming (CC BY 4.0)

In accordance with Creative Commons Attribution 4.0 International (CC BY 4.0):

- Certain physical macro motion techniques (condensation macro, 360 studio turntable, exploded levitation, fluid stream dynamics) were adapted from prompts published on [HeyDreaming.com](https://heydreaming.com/prompts).
- Original work © HeyDreaming. Adapted by Hisabche Studio for Persian accounting SaaS motion choreography.
- Each adapted prompt explicitly displays:
  `source: https://heydreaming.com/prompts/<slug> · license: CC BY 4.0 adapted`
