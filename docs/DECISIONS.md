# Hisabche 3D Landing Page Engineering Decisions

This document records architectural, engineering, and performance decisions made during the execution of the Hisabche 3D Landing Page v2 specification (`docs/landing-v2-spec.md` and `docs/landing-3d-spec.md`).

---

## Decision Log

### DEC-001: Preservation & Incremental Parameterization of Procedural Three.js Scene

- **Date:** 2026-10-23
- **Context:** The working `scene.ts` contains ~1,980 lines of procedural Three.js code detailing the hall, lighting, materials, workstations, characters, particles, and animations. The task mandates not rewriting working scene code from scratch.
- **Decision:** Retain the solid geometry and procedural structure of `scene.ts`. Decouple configuration, timings, copy, camera poses, and event triggers into `journey.config.ts`. Parameterize all particle systems (van exhaust, core sparks, offline wave) and lighting transitions to be strict pure mathematical functions of the scroll progress $p \in [0, 1]$.
- **Consequences:** Eliminates time-accumulator drift, guarantees that forward, reverse, and jump scrubbing produce identical visual frames, and preserves 100% of tested visual assets.

### DEC-002: Single Source of Truth (`journey.config.ts`)

- **Date:** 2026-10-23
- **Context:** v2 spec Section 12 notes legacy discrepancies between 5 stations and 7 beats, split constants across `journey-machine.ts`, `journey-shots.ts`, and `journey-screens.ts`.
- **Decision:** Create `packages/ui/src/components/ui/landing/journey/journey.config.ts` as the single source of truth for:
  1. The 7 sequential beats (`beat-0` to `beat-6`), their IDs, normalized progress intervals, and scroll heights.
  2. Camera authored shots (yaw, pitch, distance, motion style).
  3. Station metadata, clerk dialogue keys, and demo transaction values per locale.
  4. Standardized analytics taxonomy event names and payload schemas.
- **Consequences:** All components (`journey-hero.tsx`, `journey-stage.tsx`, `journey-machine.ts`, `journey-shots.ts`, analytics emitter, and unit tests) derive their contracts from `journey.config.ts`.

### DEC-003: Device Quality Tiers (S/A/B/C/D) & Benchmark Heuristics

- **Date:** 2026-10-23
- **Context:** v2 Section 6 mandates 5 distinct quality tiers (S, A, B, C, D) based on hardware capability and runtime frame-time benchmarks.
- **Decision:**
  - **Initial Detection:** Evaluates `navigator.hardwareConcurrency`, `navigator.deviceMemory`, screen pixel density, GPU unmasked renderer string via WebGL debug info, and battery status API (if available).
  - **Runtime Benchmark:** A 60-frame benchmark monitors dropped frame rates during initial scroll. If average frame time exceeds 24ms (~40 FPS target), the engine steps down one tier (e.g. S -> A, or A -> B).
  - **Tier D / Battery Saver:** If `navigator.getBattery?.charging === false && battery.level <= 0.15` or low-end mobile hardware is detected, the engine switches to Tier D (static canvas or fallback card mode with 0 particle overhead).

### DEC-004: Pure Progress Determinism for Visual Effects

- **Date:** 2026-10-23
- **Context:** In standard animation loops, particles and dynamic lighting rely on `clock.getDelta()` or elapsed time `time`. When a user scrubs backwards or jumps using progress dots, time-based effects desynchronize from the robot's physical position.
- **Decision:**
  - Van exhaust puff scale and opacity: computed strictly from $p_{dock} = \text{clamp01}((p - p_{start}) / \Delta p)$.
  - Core burst sparks: position and dispersion are calculated deterministically as a closed-form parametric function of $p_{burst} \in [0, 1]$ seeded with deterministic pseudo-random offsets (`seededRandom`).
  - Offline mode dimming and green reconnection wave: strictly bound to $p_{offline} \in [0, 1]$.

### DEC-005: URL Hash Navigation & Bidirectional Sync (`#beat-0` to `#beat-6`)

- **Date:** 2026-10-23
- **Context:** Users and QA need direct deep-linking to beats for testing and sharing without breaking browser history or scroll position.
- **Decision:**
  - Synchronize `#beat-N` hash using `history.replaceState` (avoiding polluting the browser's back button stack on continuous scrolling).
  - On initial page load with a hash (e.g. `#beat-3`), automatically scroll the window to the target beat progress after layout mount.
  - Expose `window.__journey` in browser environments for automated testing, Playwright, and debugging.

### DEC-006: Accessibility, WCAG AA, and Text Occlusion Guard

- **Date:** 2026-10-23
- **Context:** Mobile viewports have restricted vertical space where speech bubbles and station caption cards could overlap.
- **Decision:**
  - Speech bubbles are hidden on narrow mobile viewports (<640px) when a station caption card is active; the clerk's spoken line is rendered directly inside the semantic caption card with `ps-3 border-s-2`.
  - All text elements enforce a minimum font size of 16px on mobile devices.
  - Station statuses, connection states, and ledger balance indicators always use text labels and iconography, never color alone.

### DEC-007: Realistic Access-Control Gate Construction and Physics

- **Date:** 2026-10-23
- **Context:** Access gates previously appeared as simple decorative frames with thin flat glass sheets and abrupt light state switches.
- **Decision:**
  - Build access control pedestals with physical base mounting flanges, rounded alloy caps, and recessed optical scan windows.
  - Model glass leaves with physical thickness, structural hinge clamps, and tinted transmission with Fresnel edge highlights.
  - Parameterize gate status LED transitions (amber idle/approach → authorized green pulse) tied to robot proximity and clearance.

### DEC-008: Stylized-Realistic Character Architecture and Attention Hierarchy

- **Date:** 2026-10-23
- **Context:** Procedural humans and clerks suffered from mannequin syndrome due to featureless spherical heads, primitive ball hands, and synchronized motion.
- **Decision:**
  - Equip all foreground character heads with readable facial geometry (sclera, tinted iris, pupil, specular catchlight, and expressive eyebrows scaled 1.25× for camera readability).
  - Implement an attention hierarchy: eye glance leads, head rotates toward protagonist, torso and arms follow.
  - Implement stylized articulated hands with palm, wrist, thumb, and jointed fingers capable of typing and gesturing poses.
  - Seeded desynchronized blinking and micro-movements ensure realistic human presence without uncontrolled time-drift.

### DEC-009: Protagonist Robot Articulation & Grasp Coupling

- **Date:** 2026-10-23
- **Context:** The protagonist robot's hands were solid spheres that floated adjacent to the invoice, rather than physically grasping it.
- **Decision:**
  - Construct articulated robotic gripper hands with three jointed fingers and opposable thumb that clamp the invoice corners at `ARM_REACH = 0.58m`.
  - Add expressive multi-state visor display (cyan idle, amber focused scan during intake approach, solid green on transaction confirmation).
  - Add mechanical joint housings at elbows, knees, and ankles for plausible mechanical construction.

### DEC-010: Kinematic Vehicle Physics & Wheel Assembly

- **Date:** 2026-10-23
- **Context:** The delivery van used low-polygon 8-sided cylinders for wheels and an arbitrary rotation factor.
- **Decision:**
  - Construct multi-component wheel assemblies: profiled tire with rounded shoulder, 5-spoke alloy rim with central hub and lug nuts, plus visible brake disc and caliper.
  - Wire wheel angular rotation strictly to traveled distance using the exact kinematic formula $\theta = \text{distance} / r_{\text{wheel}}$ with $r_{\text{wheel}} = 0.34\text{m}$.
  - Enhance van body with mirrors, lights, panel seams, and dock hazard markings.

### DEC-011: Environmental Layering & Instanced MEP Density

- **Date:** 2026-10-23
- **Context:** Long empty wall spans (>9m) and bare industrial ceilings made the scene look like an empty 3D box rather than a functioning enterprise hall.
- **Decision:**
  - Layer walls with baseboards, wainscot dado bands, crown moldings, acoustic panels, and utility access panels ensuring no visible wall span exceeds 3m without architectural breakup.
  - Populate ceilings with industrial cable trays, HVAC ductwork, and sprinkler heads.
  - Populate office workstations with instanced accessories (mugs, pens, document stacks, keyboards) for zero draw-call penalty.
  - Render dynamic canvas UI textures on background station monitors showing real-looking accounting tables and charts.
