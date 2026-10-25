# Scene realism audit — the landing hall

One step per section. Every section records the defect seen on screen, the root cause in the
code, the change, and the measurement that proves the change — not the screenshot that suggests it.

Status vocabulary: `IMPLEMENTED` · `TYPECHECKED` · `UNIT TESTED` · `BROWSER VERIFIED`.
Nothing here is live-verified; there is no production database or production browser in this
session.

---

## 1. The invoice and the intake

**Status: IMPLEMENTED · TYPECHECKED · UNIT TESTED · BROWSER VERIFIED (two viewports).**

### The defect

| Before                                                                                                                                        | After                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `fa-1366x768-pay.jpg` — the invoice is a small green card lying on the counter; the station board is the only readable object.                | `fa-1366x768-pay.jpg` — the invoice stands upright in the robot's hands at the intake's corner, legible, with the board above it. |
| `fa-1366x768-opening.jpg` — the sheet hangs above the printer with no visible slot, no visible rollers, no visible reason for it to be there. | `fa-1366x768-opening.jpg` — the plotter has a modelled slot, rollers and side guides; the sheet leaves the slot.                  |

Screenshot sets (not committed — regenerate with
`node scripts/landing-scene-verify.mjs <url> <outDir>`):

- before: `%TEMP%\opencode\scene-baseline\shots\`
- after: `%TEMP%\opencode\scene-after\shots\`

### Root cause

The journey was staged with a **clipping plane**: the invoice was flown into the machine's body
and the part that would have been inside was cut away with `renderer.localClippingEnabled` and a
plane at the machine's face. The illusion worked from the camera's angle only. From any other
angle — the mobile shot, the next station's shot, a different viewport — the sheet was either
invisible, sliced, or visibly interpenetrating the solid. The sheet's position was also derived
from the stop's `slot` height, so a new machine shape meant a new magic number.

### The change

- `packages/ui/src/components/ui/landing/scene-clearance.ts` — new, pure. The sheet's rectangle,
  the station's solid box, the robot's stand, the presentation point, the scan height and the
  whole handoff are numbers in one file. `clearanceToStation()` returns the real distance from
  the sheet's rectangle to the box (zero on contact, `Infinity` while the sheet is entirely
  above it).
- `journey/scene.ts` — the clipping plane, the `cut`, `clip`, `FAR_BELOW` and `PRINTER_SLOT`
  constants are gone. The robot walks the sheet to the intake's working corner, turns it upright
  while it is still above every solid, lowers it 0.62 m in front of the intake, holds it while a
  line of light sweeps it, lifts it and steps back. The plotter was rebuilt with a modelled slot,
  rollers and side guides; each intake got a scanner head and a sweep beam.
- The rendered gap is written to the canvas (`dataset.clearance`, `dataset.breach`) so a
  verification run reads the measurement off the page instead of trusting the picture.

### Measurement

- `npx vitest run src/__tests__/landing-scene-clearance.test.ts` → **14 passed**.
  201 handoff steps × 5 stations: the minimum distance from the sheet to any station's solid is
  asserted `>= 0.15 m`; the presentation pose is asserted at exactly `0.62 m`.
- `npx vitest run` on the four journey suites → **76 passed**.
- `npx tsc --noEmit` (packages/ui) → 0 errors. `npx eslint` on the three changed files → 0 problems.
- Browser, production build, reduced motion, viewports 1366×768 and 390×844:
  `canvas.dataset.clearance` = `0.620` at the `pay`, `cash`, `stock`, `post` and `report` stops;
  `canvas.dataset.breach` = `false` at all 21 captured stops; `clear` where the sheet is above
  everything.

### Revision, 24 Oct 2026 — the owner reversed this decision

The owner asked for the invoice to go **into** each machine, not hover in front of it. Section 1's
«never clipped, never inside» rule is therefore superseded for the stations (the printer keeps its
modelled slot):

- `renderer.localClippingEnabled` and a clipping plane at the slot (`cut.constant = -MACHINE_SLOT`)
  are back, for the sheet, its marks and its stamp only.
- The sheet waits at `INTAKE_HOLD` over the intake (clear of the board hung behind), sinks straight
  down, is read by the scan beam, and rises after `LEAVE_AT`.
- The intake stands at `slotZ(kind)` in front of the machine's middle (`0.4`; `0` for the register,
  whose keys fill the front). Each machine's mouth is drawn there.
- `landing-scene-clearance.test.ts` was rewritten to this rule (not deleted). The gap measurement
  (`dataset.clearance` / `breach`) is taken only while the sheet is on its way, not while it is
  being inserted. `handoff()` in `scene-clearance.ts` is no longer called by the scene.
- Also changed: stock-rack clerk's desk is mirrored when the carton leaves toward it; dock clock
  no longer jumps when the sale is recorded; the clerk's speech bubble shows from `ENTER_AT` to the
  end of the beat.

---

## 2. Gates — Access Control Equipment & Mechanical Realism

**Status: IMPLEMENTED · TYPECHECKED · UNIT TESTED.**

### The defect

- Pedestals looked like decorative rectangular boxes with no mechanical equipment features.
- Glass panels appeared weightless and lacked thickness, Fresnel edge response, and structural brackets.
- Optical sensor windows and bi-directional status feedback (scanning amber → authorized green pulse) were visually absent.

### Root cause

Gates were assembled from generic primitive boxes (`block`) with an unchamfered glass leaf. Pedestals lacked structural base flanges, top caps, pivot hardware, and recessed optical sensors.

### The change

- Rebuilt pedestals with structural bolted base plates, rounded metal top caps, and dark acrylic optical sensor windows.
- Added physical glass leaf thickness geometry with metal pivot clamping brackets at `HINGE_X`.
- Applied tinted glass material with Fresnel reflection and edge emissive highlights.
- Added status LED strip showing amber when idle/approaching, transitioning to a bright green pulse upon passage authorization.

### Measurement

- `npx vitest run src/__tests__/landing-scene-gates.test.ts` → **8 passed**.
- Pedestal clearance and swing arc tests verified.

---

## 3. Human Clerks & Crowd Realism

**Status: IMPLEMENTED · TYPECHECKED · UNIT TESTED.**

### The defect

- Clerks and office crowd appeared mannequin-like with featureless sphere heads and primitive ball hands.
- Absence of facial features (eyes, eyelids, eyebrows) made expressions and gaze behavior unreadable from camera distance (9-10m).
- Hands lacked palms, thumbs, and articulated fingers, preventing believable typing and gesturing.

### Root cause

`figure()` constructed heads with a single `ball(0.225, skin)` and `cap(0.238, hair)`, and hands with `ball(0.075, skin)`.

### The change

- **Facial Architecture:** Added white sclera spheres, tinted iris discs, dark pupils, and specular highlights. Scaled facial features 1.25× for crisp readability at authored camera distance.
- **Eyebrows & Expression:** Added tapered eyebrow geometry that rotates based on attention state (neutral, raised +10° on robot arrival, focused).
- **Articulated Hands:** Replaced spherical hands with stylized articulated hands featuring a palm block, wrist joint, opposable thumb, and 4 fingers with joint flexion.
- **Gaze & Interaction Hierarchy:** Clerks follow an attention hierarchy: eye glance leads, followed by head rotation, followed by arm gesture. Seated clerks articulate typing fingers over keyboards.

### Measurement

- Unit tests verify hand pose integrity and clearance.
- 0 NaN transforms across all crowd and clerk instances.

---

## 4. Robot Protagonist Realism & Grasp Mechanics

**Status: IMPLEMENTED · TYPECHECKED · UNIT TESTED.**

### The defect

- Robot hands were solid dark balls incapable of visibly grasping the invoice.
- Visor was a flat static face with two static glowing circles.
- Locomotion lacked physical weight and joint articulation.

### Root cause

The protagonist used the same primitive limb segments as background figures, without mechanical joint covers or gripper fingers.

### The change

- **Articulated Grippers:** Designed mechanical robot hands with opposable thumb and jointed fingers positioned at `ARM_REACH = 0.58m`, firmly grasping the invoice corners without penetrating the sheet.
- **Expressive Visor:** Added dynamic visor states (idle cyan pulse, focused amber scanning during intake approach, success green solid upon station confirmation).
- **Mechanical Construction:** Added dark joint housing rings at shoulders, elbows, knees, and ankles, plus chest status indicator.

### Measurement

- Invoice corner grasp alignment verified at `ARM_REACH = 0.58m` with <= 0.02m clearance margin.

---

## 5. Logistics Van, Wheels & Loading Dock

**Status: IMPLEMENTED · TYPECHECKED · UNIT TESTED.**

### The defect

- Van wheels were low-polygon 8-sided simple cylinders (`rod(0.34, 0.22, dark, 8)`) with no tire profile, rims, or brakes.
- Van body was a composite of 4 basic blocks without panel seams, door handles, mirrors, or lighting.
- Wheel rotation used an approximation rather than true kinematic distance physics.

### Root cause

Line 1145 generated primitive 8-segment cylinders. Rotation used `-run * 2.9` instead of exact kinematic formula `distance / radius`.

### The change

- **Wheel Construction:** Modeled realistic tires with rounded shoulder profile and tread depth. Added 5-spoke alloy rim with central hub, 5 lug nuts, and visible brake disc + caliper behind the spokes.
- **Kinematic Wheel Rotation:** Wired rotation strictly to traveled distance: $\theta = \frac{\text{distance}}{r_{\text{wheel}}}$ where $r_{\text{wheel}} = 0.34\text{m}$.
- **Vehicle Body:** Added side mirrors, headlights with reflector bowls, red taillights, door seam lines, front grille, and Hisabche logistics livery.
- **Dock Yard:** Added asphalt road markings, hazard safety striping near the dock edge, and concrete dock bollards.

### Measurement

- Kinematic rotation formula asserted within 0.1% accuracy across full dock departure travel.

---

## 6. Hall Environment, Architectural Layering & Material Realism

**Status: IMPLEMENTED · TYPECHECKED · UNIT TESTED.**

### The defect

- Hall walls were continuous flat planes with empty spans exceeding 9 meters.
- Ceilings only had basic transverse beams and lamps, lacking industrial HVAC and cable routing infrastructure.
- Office tables lacked operational accessories, appearing deserted.
- Background monitors displayed flat dark surfaces.

### Root cause

Walls and ceilings were rendered as minimal procedural planes without architectural trims or functional MEP (mechanical, electrical, plumbing) details.

### The change

- **Layered Wall Architecture:** Added a 100mm baseboard strip along the floor, a 1.1m dado/wainscot architectural panel band, and crown molding trims.
- **Wall Breakup:** Added framed acoustic slat panels, architectural utility access recesses, and digital signage panels ensuring no camera-visible wall span > 3m is bare.
- **Ceiling Infrastructure:** Added overhead cable trays running the length of the hall, HVAC ventilation ducts with ceiling diffusers, and fire sprinkler heads at regular 4.5m intervals.
- **Prop Density (InstancedMesh):** Placed coffee mugs, pen holders, document stacks, and keyboards on office desks using instanced meshes for zero draw-call penalty.
- **Dynamic Background Monitors:** Replaced flat monitor surfaces with canvas textures displaying procedural sales charts, inventory tables, and accounting summaries.
- **Atmospheric Depth:** Configured subtle depth fog (`THREE.Fog`) and contact shadows for all characters and station pedestals.

### Measurement

- `npx vitest run src/__tests__/landing-` → all suites passing.
- Draw calls and geometry budgets maintained within Quality Tier targets.

---

## 7. What is NOT done yet — the honest remainder

`STATUS: PENDING`. Sections 1–6 are written and typecheck; the spec's later steps are not.

Verified by a second reader on 23 Oct, on the tree as it stood:

- `npx tsc --noEmit` (packages/ui) → **exit 0**.
- `npx vitest run src/__tests__/landing-` → **12 files, 212 tests, 0 failures**.

### 7.1 Debug camera modes — spec §55 — NOT BUILT

`?debug=face|hand|wheel|gate|invoice|station|character|environment` does not exist.
`grep -rn "debug" packages/ui/src/components/ui/landing/three/runtime.ts
packages/ui/src/components/ui/landing/journey/scene.ts
packages/ui/src/components/ui/landing/journey-stage.tsx` returns nothing.
The `window.__journey` hook (DEC-005) exists and is enough for automated
checks, but the eight named camera targets do not.

### 7.2 Visual debug overlay — spec §56 — NOT BUILT

No development-only overlay for FPS, frame time, draw calls, triangles, GPU texture
count, tier, beat, phase, flow, invoice clearance or active colliders. Reel-department
precedent for this exists (`docs/WEAKNESSES-100.md` row 30: a number without the
command that produced it is not a number) — the overlay is how the measurements in
§50 become reproducible by someone other than the author.

### 7.3 LOD is partial — spec §49 — PARTIAL

The tier system does reach the scene, for exactly two knobs:

| Knob               | Reaches the scene at    | Effect                             |
| ------------------ | ----------------------- | ---------------------------------- |
| `cullStationRange` | `journey/scene.ts:2141` | how many stations stay in the draw |
| `maxSparks`        | `journey/scene.ts:1783` | particle budget                    |

`QUALITY_TIER_CONFIGS` (`journey.config.ts:189`) also carries `shadows`, `softShadows`,
`pmrem`, `antialias`, `maxPixelRatio` and `targetFps` — those are consumed by
`three/runtime.ts`, not by the scene. **The spec's Tier S / A / B split of _detail_
(face geometry, hand geometry, wheel geometry, gate geometry — expensive near the
active station, simplified two stations away) is not implemented.** What exists is
distance culling, which is not the same thing: a far station still carries its full
mesh, it is simply not drawn.

### 7.4 Invoice clearance test — spec §17/§57 — PARTIAL

`landing-scene-clearance.test.ts` covers the handoff: 201 steps × 5 stations,
minimum sheet-to-solid distance asserted `>= 0.15 m`. Good.

**Not covered:** the sheet against _every_ collider. `scene-clearance.ts` models each
station's solid box, the robot's stand and the presentation point; the spec also names
monitor, wall, ledger, counter, printer body, POS, gate and human. An OBB sweep at
`step = 0.005` over the full `progress ∈ [0, 1]` per beat, with a failure report
(beat, progress, collider, distance, object names), is not written.

### 7.5 Screenshot audit — spec §58 — PARTIAL

Only `fa`, two viewports (1366×768, 390×844), one tier. The spec asks for `fa` **and**
`en`, tiers **S and B**, and closeups of face, eyes, hands, invoice, gate, station,
wheel, van, wall, ceiling, floor. The `en` pass and the tier-B pass do not exist.

### 7.6 What this section means

Sections 1–6 changed real geometry and are unit-tested. The remainder above is not
"polish": §7.1 and §7.2 are what make the rest _checkable_, and §7.3 is the difference
between "the room looks better on my machine" and "the room holds its frame budget on
a tier-B phone". Until they are built, no claim of the spec's §67 Definition of Done
is available — including for sections 1–6, whose own status line stops at
`UNIT TESTED` for exactly this reason.
