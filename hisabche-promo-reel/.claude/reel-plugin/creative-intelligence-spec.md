# Hisabche Promo Reel — Creative Intelligence Engine Specification

> **Path:** `.claude/reel-plugin/creative-intelligence-spec.md`
> **Status:** Hard-locked creative rules for maximum performance and real diversity
> **Language:** English (canonical spec; Persian workflow docs are derived from this)
> **Scope:** These rules govern how every new reel is conceived, planned, scored, reviewed, and registered. Rendering, audio, Persian typography, and existing guardrails remain untouched.

This specification replaces the old "template-first" production mindset with a **Creative Intelligence Engine**. The renderer is the executor; the creative layer decides what to build.

---

## 1. Core Principle

**Idea first. Then narrative. Then medium. Then shot plan. Then rendering.**

The rendering engine must execute a creative decision, not predetermine it with a closed set of templates.

Real diversity must come from differences in:

- idea
- narrative
- medium
- rhythm
- viewing experience

Not from metadata differences alone.

---

## 2. Non-Negotiable Protection Rules

Do not delete or rewrite existing engine files:

- `src/components/WordDrivenStage.tsx`
- `src/engine/sound.ts`
- `src/engine/speech-*.ts`
- `src/engine/guardrails.ts`
- `scripts/export-mp4.mjs`
- `scripts/visual-qa.mjs`

Preserve:

- deterministic rendering
- forced alignment and word timing
- Persian RTL typography
- Persian digits
- product claim guardrails
- typography and text tests
- real MP4 export
- audio/video sync
- reel registration structure
- reusable primitives and animations
- current performance and healthy paths

Forbidden:

- changing the main site or backend without proven necessity
- rewriting the renderer for aesthetic reasons only
- adding heavy dependencies without justification
- enabling paid APIs without approval
- auto-publishing to social platforms
- committing secrets or credentials
- destructive file or data changes
- commit/push/deploy without explicit request
- claiming success for tests not actually run
- inventing viral/performance numbers

---

## 3. Target Architecture

```
Brief / Business Goal
        ->
Audience & Problem Definition
        ->
Creative Hypothesis
        ->
Idea Divergence
        ->
Concept Evaluation
        ->
Creative DNA
        ->
Narrative & Hook Design
        ->
Storyboard / Shot Plan
        ->
Asset & Medium Selection
        ->
Existing Reel Renderer
        ->
Technical QA
        ->
Creative QA
        ->
Similarity & Novelty Gate
        ->
Export
        ->
Performance Data Import
        ->
Learning / Experiment Registry
```

The creative layer must be independent from the rendering layer.

---

## 4. Creative DNA Schema

Every reel must export a typed `CreativeDNA` object.

File location (adjust to actual project structure): `src/engine/creative-dna.ts` or compatible path.

Minimum dimensions:

```
type CreativeDNA = {
  audience: string;
  businessProblem: string;
  creativeHypothesis: string;

  hookMechanism:
    | "contradiction" | "curiosity" | "confession" | "challenge"
    | "unexpectedResult" | "specificPain" | "demonstration"
    | "question" | "comedy" | "visualMystery" | "coldOpen" | "other";

  narrativeGrammar:
    | "problem-solution" | "reverseReveal" | "miniDocumentary" | "pov"
    | "sketch" | "interview" | "confession" | "challenge"
    | "demonstration" | "mythBusting" | "beforeAfter" | "dataStory"
    | "productJourney" | "oneTake" | "other";

  emotionalArc: string[];

  visualMedium:
    | "realProductUI" | "screenRecording" | "typography" | "2dMotion"
    | "3d" | "liveAction" | "ugcStyle" | "documentary"
    | "mixedMedia" | "illustration" | "physicalMetaphor" | "other";

  visualGrammar: string;
  cameraLanguage: string;
  editingRhythm: string;
  transitionLanguage: string;
  soundLanguage: string;

  humanPresence: "none" | "voiceOnly" | "hands" | "character" | "interview" | "onCamera";
  productExposure: "none" | "briefProof" | "mainSubject" | "continuousDemo";

  realityLevel: "abstract" | "stylized" | "grounded" | "realFootage";
  humorLevel: number;
  tensionLevel: number;
  surpriseMechanism: string;

  targetDurationSeconds: number;
  aspectRatios: string[];
  localization: "fa-IR" | "fa-AF" | "neutral" | "multiVariant";

  primaryCTA?: string;
};
```

Rules:

- Types must be constrained and meaningful.
- No `any`.
- Validate with Zod or existing project validation.
- `other` must include a usable explanation.
- Every field must affect a real decision; no decorative metadata.
- Do not remove existing fields without reason.
- Schema must be versionable so legacy reels still work.

---

## 5. Idea Divergence Engine

Before selecting a template or writing a reel file, generate at least 10 concept candidates with genuinely different angles.

Input:

- video goal
- audience
- problem
- real product capability
- market
- time constraint
- previous reels
- optional references

Each candidate must include:

- id
- short title
- specific audience
- core problem
- creative hypothesis
- exact hook
- narrative summary
- expected payoff
- medium type
- narrative structure
- product presence
- suggested duration
- production complexity
- false-claim risk
- similarity to previous reels
- reason it is different

### Mandatory diversity across candidates

When appropriate for the brief, cover these angles:

- emotional
- rational
- humorous
- documentary
- contrarian
- curiosity-driven
- product-led
- human-led
- physical metaphor
- data-led
- challenge/experiment
- narrative reversal

If an angle is unsuitable, do not force it; record the reason for exclusion.

### Not real diversity

Do NOT count these as different:

- changing the color of the same scene
- rewriting the same hook
- swapping one card icon
- replacing chart with card without changing narrative
- changing template while story order and payoff stay the same
- using different music on the same edit

If several candidates are the same idea in disguise, merge or reject them.

---

## 6. Creative Scoring Engine

Score and rank candidates using a configurable rubric.

Minimum criteria:

| Criterion                        | Initial Weight |
| -------------------------------- | -------------: |
| Hook clarity and curiosity       | 15             |
| Audience/problem specificity     | 12             |
| Originality vs prior reels       | 18             |
| Narrative distinction            | 12             |
| Visual-medium distinction        | 10             |
| Emotional progression            | 8              |
| Product proof / credibility      | 10             |
| Payoff strength                  | 8              |
| Production feasibility           | 4              |
| Platform fit                     | 3              |

Total weight must equal 100.

Weights must be configurable and documented. These scores are heuristic, not scientific predictions of virality.

### Hard gates

A candidate must not pass only because of a high total score if:

- hook is vague
- audience is unspecified
- payoff is missing
- product claim is unverified
- similarity to recent reels is too high
- production depends on missing tools or assets
- it requires a paid external API without approval

Results:

- `PASS`
- `REVISE`
- `REJECT`
- `NEEDS_HUMAN_REVIEW`

Record the reason for every result. Never present invented scores as real performance metrics.

---

## 7. Separate Narrative Grammar from Template

Visual template and narrative order must be conceptually separated and, where possible, code-separated.

Narrative Plan defines what happens, when, and why.

Visual Plan defines how each beat is displayed.

Example:

```
Narrative:
Cold open
-> contradiction
-> evidence
-> reveal
-> payoff

Visual Plan:
Close-up of a real invoice
-> abrupt hard cut
-> real product screen
-> zoom into changed inventory
-> silence + final line
```

They must remain independent.

Rules:

- No fixed scene order for all reels.
- CTA is not mandatory in every video.
- Duration is driven by story and platform.
- Product demo does not always appear at a fixed point.
- UI cards are not the default for every scene.
- One concept can be rendered with multiple visual treatments.
- Plan must be valid and renderable according to types and tests.

Only extend the renderer where truly necessary.

---

## 8. Shot Library Instead of Accumulating Similar Templates

Build an independent shot grammar library.

Each shot must have a typed structure:

- id and name
- narrative purpose
- framing type
- camera or element movement
- energy level
- suggested duration
- required inputs
- RTL/LTR compatibility
- UI compatibility
- asset dependencies
- technical constraints
- example usage
- common anti-pattern

Suggested categories:

- extreme close-up
- macro detail
- wide establishing shot
- hard cut
- match cut
- whip-pan simulation
- snap zoom
- split-screen reveal
- freeze frame
- one-take screen recording
- cursor-led product proof
- physical object transformation
- visual metaphor
- text interruption
- time jump
- before/after wipe
- documentary insert
- reaction shot
- silence beat
- negative-space reveal

This list is an initial catalog, not a requirement to implement every item.

### Addition rule

Add a new shot only if:

- it provides a distinct visual capability
- it cannot be produced with existing primitives or creates a new combination
- it has real use
- performance and rendering cost are acceptable

Do not add shots only to increase the count.

---

## 9. Creative Medium Selection

The engine must choose the best medium for the idea before production.

Options:

1. real product UI
2. screen recording
3. typography-led motion
4. 2D motion
5. 3D
6. UGC-style
7. documentary
8. interview / talking-head
9. physical metaphor
10. illustration
11. mixed media

Select a medium only when real tools and assets exist to produce it.

Examples:

- For proving a capability, screen recording may be the strongest choice.
- For showing hidden cost, human storytelling or physical metaphor may be better.
- For a humorous idea, a conversation scene may outperform a dashboard.
- For a complex capability, real demo may be more credible than abstract motion.

### Critical limitation

If the project can currently produce only procedural videos, do not pretend it produces live-action or real UGC.

In that case:

- record the path as `planned` or `unsupported`
- define an adapter or expansion contract
- do not mark unavailable capability as `implemented`
- use the closest supported medium instead of generating fake output

Do not activate paid external APIs or services without approval.

---

## 10. Trend Research and Reference Video Learning

Build an optional system for receiving and analyzing references.

### Allowed inputs

- public accessible URL
- local video file
- screenshot or storyboard
- user text description
- manual notes about a reference video

### Analysis output

- hook mechanism
- narrative structure
- beat timing
- editing rhythm
- visual medium
- camera language
- sound strategy
- caption behavior
- product exposure
- payoff
- transferable techniques
- elements that must not be copied

### Safety and honesty rules

- Do not assume any URL is accessible.
- Do not bypass login walls, download restrictions, or platform limits.
- Do not use private APIs or unauthorized endpoints.
- Do not treat a single trend or sample as absolute truth.
- Never copy a video verbatim.
- Learn from structure and technique, not text, character, logo, or copyrighted work.
- If real audio/video analysis tools are unavailable, record the limitation.
- Trend data and reference analysis must include timestamp and source.
- Do not use stale data as current trend without warning.

## Suggested architecture

Only build these if needed:

- `reference-analyzer`
- `trend-source-adapters`
- `reference-library`
- `creative-pattern-extractor`

### Research sources

Use public and permitted sources such as:

- TikTok Creative Center
- public YouTube Shorts
- public Instagram Reels within permitted access
- relevant GitHub repositories
- public SaaS ad examples

Inspiration from projects such as `video-shotcraft` and `HyperFrames` is allowed for architecture ideas. Do not add dependencies solely because those projects exist.

If GitHub is accessible in the current environment, inspect real README, license, API, and limitations. If not, do not claim live research.

---

## 11. Creative Similarity Engine

Build a system that goes beyond metadata comparison.

Each reel must have Creative DNA, narrative plan, shot plan, and, when available, keyframe fingerprint.

### Level 1: Metadata Similarity

Compare:

- hook mechanism
- narrative grammar
- visual medium
- emotional arc
- editing rhythm
- camera language
- product exposure
- duration
- sound language

### Level 2: Narrative Similarity

Check:

- Is the core problem the same?
- Does the hook use the same mechanism?
- Is the reveal order similar?
- Is the payoff similar?
- Is the ending similar?

### Level 3: Visual Similarity

If real frames are available:

- extract keyframes from the new reel
- compare them with representative frames from previous reels
- use perceptual hash or available embeddings
- add heavy dependencies only with technical justification
- the numeric result must come from a real algorithm

If image analysis is unavailable, record visual similarity as `UNAVAILABLE`, not as an invented number.

### Level 4: Temporal Similarity

When possible, compare:

- beat timing
- cut density
- frame composition changes
- distance between reveals
- text display duration
- silence and sound patterns

### Output

The similarity report must show:

- nearest previous reels
- similar dimensions
- different dimensions
- reason for warning
- specific suggestion to increase distinction

### Reject rule

If two reels are too similar in narrative and visual grammar, the system must reject or flag them for redesign.

But:

- thresholds must be configurable
- false positives must be reviewable
- shared topic alone is not enough to reject
- localized variants must not be treated as new reels only because of language differences
- insufficient data must be reported as `INSUFFICIENT_DATA`

---

## 12. Creative Distance Score

Build a score for measuring distinction.

Initial weights:

| Dimension                    | Weight |
| ---------------------------- | -----: |
| Narrative structure          | 20%    |
| Hook mechanism               | 15%    |
| Visual medium                | 15%    |
| Visual grammar               | 15%    |
| Editing rhythm               | 10%    |
| Emotional arc                | 10%    |
| Camera language              | 5%     |
| Sound language               | 5%     |
| Product exposure pattern     | 5%     |

Weights must be configurable.

The distance score ranges from 0 to 100:

- 0: practically identical
- 100: highly different across measured dimensions

This is an approximate distinction measurement, not a prediction of quality or virality.

Initial rules:

- low distance from any of the last 5 reels: serious warning
- high similarity with one reel in the last 20: detailed review
- same topic with different narrative is not automatically rejected
- different metadata with similar frames and narrative is not automatically accepted
- if previous data is insufficient, report the data shortage

---

## 13. Generate Three Genuinely Different Concepts

For each brief, the system must propose at least three top concepts.

They should differ, as much as possible, in:

- hook type
- narrative grammar
- visual medium
- pacing
- human presence
- product introduction method
- payoff

For example, these are not sufficiently different:

1. dark card animation
2. dark chart animation
3. dark dashboard animation

These are more genuinely different:

1. a practical experiment with an unexpected result
2. a short sketch about a common mistake
3. a direct product demo with a contradiction-based hook

For each concept, write:

- why it is suitable
- what makes it different from the other two
- main risk
- required assets
- why it is worth testing
- what should be measured in performance data

Final selection must be based on score, production constraints, and campaign goal, not random choice or model taste alone.

---

## 14. Creative QA Independent from Technical QA

Keep existing QA. Add an independent Creative QA layer.

### Technical QA

Preserve current checks:

- typecheck
- tests
- build
- text overflow
- Persian rendering
- timing
- AV sync
- MP4 validity
- render stability
- frame sampling

### Creative QA

Check:

1. Is the hook clear and understandable at the start?
2. Is there a reason to keep watching in the first seconds?
3. Does the narrative reach a clear payoff?
4. Is there at least one notable or unexpected moment?
5. Does the idea address a real audience pain?
6. Does the product prove something real?
7. Is the video worth watching even without CTA?
8. Are hook and ending similar to recent videos?
9. Does a single frame communicate the video idea?
10. Do editing and sound serve the story?
11. Are the facts reliable?
12. Does it feel like generic advertising or platform-native content?

Each criterion must have one of:

- `PASS`
- `WARN`
- `FAIL`
- `UNVERIFIED`

Do not use an "8/10" score without evidence.

If AI review is used:

- record prompt and model version when possible
- do not treat the result as absolute truth
- store reviewed frames and decision reasons
- criticism must lead to a concrete change in the creative plan

### Creative Review Loop

```
Render
  ->
Extract Keyframes
  ->
Technical QA
  ->
Creative QA
  ->
Similarity Check
  ->
Weak? -> Change Concept or Creative DNA
  ->
Re-render
```

If the problem is in the idea, do not fix it by only changing color or transition.

---

## 15. Asset Strategy and Real Product Proof

For Hisabche, trust matters more than visual effect.

The creative plan must state which claim or capability will be proven.

Use, when available:

- real product screenshots
- real screen recordings
- real voiceover files
- original logo
- labeled sample data
- licensed local footage
- existing project assets

Rules:

- Do not present synthetic UI as a real product screenshot.
- Do not present invented numbers as real business results.
- Do not invent testimonials or customer stories.
- Do not advertise unimplemented capabilities.
- If data is sample data, mark it in documentation.
- Verify required assets and their availability before rendering.

Build a manifest so each shot states which asset it uses.

---

## 16. Branding: Fixed Identity, Flexible Visual Language

Do not remove or keep the "always dark" rule blindly. Convert it from an absolute requirement into a justifiable artistic choice.

Brand DNA must remain fixed:

- correct logo
- correct typography
- brand voice
- claim accuracy
- real product display
- base color identity
- audience-appropriate tone

But these should not be identical across all reels:

- background
- lighting
- dominant color
- layout
- camera
- medium
- abstraction level
- human presence
- editing rhythm
- text display style

Each video may have an independent visual style, as long as Hisabche identity and product accuracy are preserved.

---

## 17. Localization for fa-IR and fa-AF

If both markets are supported, localization must not be limited to changing a few words.

When verified information exists, reflect differences in:

- vocabulary
- financial terminology
- currency
- business examples
- address style
- problem type
- CTA
- voiceover tone

Every localized data point must come from a real source or verified input.

Do not remove general rules without reason. For example, the ban on hardcoded currency units must be compatible with the localization model, not randomly generate currency information.

A reel may have separate localized variants, but the registry must state whether these are variants of one concept or independent concepts.

---

## 18. Flexible Duration and Format

The engine must not depend on a single fixed duration or aspect ratio.

Duration must be selected from story and platform needs.

Support, when appropriate:

- 8-15 seconds
- 15-30 seconds
- 30-45 seconds
- 45-60 seconds
- custom duration

These are production options, not performance laws.

Support multiple formats only when renderer and composition truly support them:

- 9:16
- 1:1
- 16:9

If a scene cannot be used in another format, the system must create a separate composition or mark it as unsupported. It must not simply stretch the output.

Preserve existing timing rules and resolve contradictions between duration, sequence, and export.

---

## 19. Performance Feedback Loop

Build a performance logging system that can return real data to the creative registry.

Do not force connection to any social account.

The first version must support manual CSV/JSON input.

When data exists, support fields such as:

- platform
- post ID or URL
- publication date
- impressions / views
- average watch time
- completion rate
- retention milestones
- shares
- saves
- comments
- profile visits
- clicks
- conversions
- campaign objective
- creative variant

Missing fields must remain optional.

## Attribution

Every reel and variant must have a stable ID.

For testing multiple hooks:

- shared concept ID
- separate variant ID
- tested difference clearly recorded
- publication time
- real result

If three versions of one concept are produced with different hooks, keep them as related experiments.

### Analysis rules

- views alone are not a quality metric
- low data does not produce definitive conclusions
- do not compare platform results without normalization
- include duration and campaign objective in comparisons
- preserve the difference between correlation and causation
- do not confuse test data with real data
- do not turn one video's success into a universal rule

Ultimately, the registry should help identify which patterns work for real Hisabche audiences.

---

## 20. Usable CLI and Workflow

The workflow must be usable by the user.

Align commands with the project's real package manager and naming convention.

When appropriate, add commands with concepts such as:

```
creative:ideas
creative:plan
creative:review
creative:similarity
creative:references
creative:import-performance
creative:report
```

These are suggested names. Before adding them, inspect the real `package.json` and existing scripts.

### Idea generation output

One command should be able to:

1. generate candidates
2. validate them
3. check similarity
4. show score and rejection reasons
5. propose three distinct options
6. save a reviewable creative plan

### Production output

After concept selection:

- build storyboard
- build asset manifest
- generate Reel data compatible with renderer
- preserve alignment and timing
- run tests
- extract keyframes
- build creative report

If an LLM or external service is needed for ideation, define a provider interface and keep a manual fallback path.

If no API is available, the workflow must still work with manual briefs and local references.

---

## 21. Test Strategy

Add tests at multiple layers.

### Unit tests

- schema validation
- creative score calculation
- similarity calculation
- deterministic output
- concept deduplication
- narrative plan validation
- shot compatibility
- localization validation
- performance CSV parsing
- missing-data handling

### Integration tests

- idea generation output -> schema
- creative plan -> valid Reel
- Reel -> renderer
- keyframe extraction -> similarity analysis
- performance import -> registry
- legacy Reel compatibility

### Regression tests

- previous Reels still render
- Persian typography is not broken
- audio alignment does not change unintentionally
- durations remain correct
- MP4 output is valid
- no previous asset or Reel is removed without reason

### Variety tests

Tests must check real distinction, not only metadata.

For example, two Reels with only different themes must not receive full diversity credit.

Also, two Reels with a shared topic but different narrative must not be automatically rejected.

Deterministic tests must use controlled fixtures.

---

## 22. Resolve Workflow Contradictions

The current document may contain contradictions, such as:

- mismatch between title and body law counts
- mismatch between sample Reel duration and expected test duration
- over-dependence on a fixed scene order
- mandatory dark theme
- text persistence until scene end

Inspect all of these in code and documentation.

Do not remove any rule blindly.

For each rule, define:

- its purpose
- the limitation it creates
- whether it should be a hard guardrail
- whether it should be an overridable preference
- which test guarantees it

Then define a single source of truth so documentation, schema, tests, and renderer stay aligned.

---

## 23. Required Documentation

Create or update at least:

- `docs/CREATIVE-ENGINE-AUDIT.md`
- `docs/CREATIVE-ENGINE-ARCHITECTURE.md`
- `docs/CREATIVE-DNA.md`
- `docs/CREATIVE-QA.md`
- `docs/REFERENCE-VIDEO-WORKFLOW.md`
- `docs/PERFORMANCE-FEEDBACK.md`
- `docs/CREATIVE-ENGINE-MIGRATION.md`

Use names or paths that better fit the project if appropriate.

Documentation must:

- be actionable
- cite real paths
- include valid commands
- distinguish implemented vs planned capabilities
- not hide real limitations

---

## 24. Phased Execution Plan

Divide implementation into these phases.

### Phase 1 - Audit and baseline

- inspect architecture
- record Git status
- inspect scripts
- capture baseline from existing Reels
- write audit report
- identify regression risks

### Phase 2 - Creative data model

- Creative DNA
- Narrative Plan
- Shot Plan
- Asset Manifest
- schema validation
- compatibility with legacy Reels

### Phase 3 - Idea divergence and scoring

- generate 10 candidates
- remove duplicate ideas
- score candidates
- select three concepts
- report reasons for selection and rejection

### Phase 4 - Similarity gate

- metadata similarity
- narrative similarity
- visual fingerprint when possible
- nearest-neighbor report
- configurable hard/soft thresholds

### Phase 5 - Creative QA

- rubric
- keyframe review
- creative report
- required change if failed

### Phase 6 - Reference workflow

- URL/file/manual notes input
- analysis schema
- source tracking
- extract transferable patterns
- respect access and license limits

### Phase 7 - Performance feedback

- CSV/JSON import
- variant registry
- metrics validation
- fair comparison
- experiment reports

### Phase 8 - Integration and regression

- connect to real workflow
- test legacy Reels
- run typecheck/test/build
- export at least one real Reel
- final documentation

After each phase, record the real status. If one phase is blocked by an external dependency, stop that part with a clear status; do not stop the whole project because of one external API.

---

## 25. Final Acceptance Criteria

Work is complete only when these evidence points exist.

### Architecture

- Creative Intelligence is separate from renderer.
- Creative DNA and Narrative Plan have valid schemas.
- Legacy Reels still work.
- Template selection is no longer the only creative decision.
- Idea divergence and concept scoring are actually executed.

### Diversity

- At least 10 candidates are generated from one brief.
- At least 3 distinct concepts with selection reasons are provided.
- Color-only or template-only differences are not accepted as diversity.
- Similarity report identifies nearest previous Reels.
- Missing data is reported as missing data.
- Narrative and medium can change without rewriting renderer.

### Quality

- Creative QA is separate from Technical QA.
- Creative criticism leads to real plan changes.
- Product claims are traceable.
- Frames and MP4 output are reviewable.

### Feedback

- Manual performance import exists.
- Variants have stable IDs.
- Real and test data are separated.
- Reports avoid unsupported claims.

### Regression

- typecheck passes
- relevant tests pass
- build succeeds
- at least one real Reel is exported
- AV sync verified
- RTL and Persian fonts verified
- no major regression in previous Reels

---

## 26. Mandatory Final Report

At the end, provide the report in this structure:

### A. What changed

New and modified files and the role of each.

### B. Architecture

Real flow from brief to export and feedback.

### C. Creative diversity

Run one real brief and show three generated concepts. Explain why they are genuinely different.

### D. Similarity

Show which previous Reels were compared and which dimensions were actually measured.

### E. Creative QA

Provide a sample report with evidence.

### F. Performance feedback

State what is implemented and what depends on external data or connections.

### G. Tests

Exact commands, real results, and limitations.

### H. Remaining gaps

Items marked `UNVERIFIED`, `PLANNED`, or `BLOCKED`.

### I. Next priorities

Maximum five next priorities based on real impact.

Do not use phrases such as "fully viral", "guaranteed virality", or "unlimited diversity". No architecture guarantees virality.

---

## Final Principle

The goal is not to produce more Reels.

The goal is that every Reel has an independent, defensible creative decision.

**Idea first. Then narrative. Then medium. Then shot plan. Then rendering.**

The rendering engine must execute a creative decision, not predetermine it with a limited set of templates.

Now audit the project and implement this architecture phase by phase in the real codebase.

Prioritize lower-risk execution, clearly separate MVP from future capabilities, and produce a final report with evidence.
