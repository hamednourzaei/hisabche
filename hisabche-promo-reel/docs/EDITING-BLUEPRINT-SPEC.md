# Editing Direction & Video Edit Blueprint — mandatory layer for every Hisabche reel

> Added 24 Oct 2026 at the owner's request. It sits **on top of** the existing master rules
> (`CLAUDE.md` §§0–17, `docs/100-VIDEO-PLAN.md` §1 and §3) and replaces none of them: reference-first
> research, creative diversity, audience value, factual product representation, natural Persian,
> source verification, implementation feasibility and repository safety all still apply.
> Applies to the 100 scenarios of `docs/100-VIDEO-PLAN.md` and to every reel made with `/new_reels`.

## 0. Precedence — where this layer meets a rule that already exists

When two rules meet, the narrower, earlier-enforced one wins, and the plan says so out loud.

| This layer says                                | Existing rule                                                                                                         | Resolution                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split screen is a valid format                 | Hard Rule 14: one dominant stage; **no divider lines / border bars** (`.r61-horizon`)                                 | Split screen is allowed as ONE stage with two clearly separated roles, divided by space, scale or contrast — never by a drawn divider line.                                             |
| Subtitles and headline typography are planned  | Hard Rule 14: ≤ 6 non-subtitle words on stage, subtitle at `bottom: 80px`, no duplicated narration                    | The text plan stays inside that budget. «Headline» means the 1–2 word label, not a second narration.                                                                                    |
| Prefer a plain cut when it serves the story    | Hard Rule 15: `whoosh` on every **scene** change, `pop` on every element appearance                                   | A cut that starts a new scene gets the whoosh. A cut inside the same scene is a plain cut with no sound.                                                                                |
| Do not add sound or effect to every key moment | Hard Rule 13: a sound exists only where a word has `sound` + `action`                                                 | Same direction: a key moment gets a sound only if the script gives it an action.                                                                                                        |
| A-roll / B-roll / live action may be chosen    | The studio renders React/SVG motion graphics (Remotion, Puppeteer, FFmpeg); the repo holds **no** live-action footage | Live-action formats are allowed in a plan only when the asset list names the footage as **to be filmed or sourced**; the feasibility section says the current engine cannot produce it. |
| Real product interface only                    | `docs/100-VIDEO-PLAN.md` §1: every video has at least one shot of the real product screen                             | Same direction. A mock-up never stands in for a real capture.                                                                                                                           |
| Claims must be true                            | Blacklist in `100-VIDEO-PLAN.md` §1 and `docs/WEAKNESSES-100.md`                                                      | Unchanged; the blueprint's copy is checked against it.                                                                                                                                  |

## 1. Editing is part of the story

Every editing decision serves a purpose: communicate an idea, hold attention, clarify, emphasise a
meaningful detail, or lead to the next moment. Define **how the video is edited**, not only what
appears. The plan states: what is seen at each moment and why; when the image, composition or focus
changes; how two moments connect; how narration, music, sound, subtitles and picture line up; where
live action, product footage, split screen or motion graphics is needed; and how the edit supports
the narrative. No motion, transition or effect is added only to look sophisticated.

## 2. Choose the format per scene

**A. A-roll** — a person speaking, demonstrating, reacting. Keep natural delivery; cut pauses without
making speech feel edited; reframe only to improve emphasis; no large text or graphics over the face;
the speaker stays dominant when expression carries the message.

**B. B-roll** — an action, object, environment or process shows it better than a talking head.
Every shot has a narrative or informational purpose and matches the narration; use inserts and
close-ups for meaningful detail; no generic stock; never show a capability Hisabche does not have.

**C. Split screen** — only when comparing two states, actions, perspectives or outcomes at once beats
showing them in sequence. The comparison is understood immediately; each side has a clear role; text
and interface stay readable; actions are synchronised when that strengthens the comparison; avoided
when it adds complexity. (Divider rule: §0.)

**D. Full-screen product or motion graphics** — the information itself is the subject: a real
Hisabche feature, a financial concept, one number or relationship, a real workflow, a concise diagram.
Clarity, legibility and accuracy first; motion directs attention to what matters; no decorative
floating cards, 3D objects, neon or particles without a creative reason; no simulated interface that
could be mistaken for a real feature.

A video may combine formats. Do not force every video into the same A/B/split structure; choose by
narrative, audience, available assets and objective.

## 3. Editing rules per part

### 3.1 Hook

Specify: the first visible frame; the opening shot/format; the first action or movement; the exact
opening text (if any); whether the hook is driven by a person, object, number, question, visual
contrast or unexpected event; how the first image relates to the first spoken line; the transition
into the next section. No automatic logo, floating object, animated dashboard or cinematic zoom at the
start — the first frame is chosen for the specific hook.

### 3.2 Body

For each segment: format; exact action or information; relation of picture to narration; intended
viewer focus; timing and duration; transition in; reason for the visual change. Every shot adds
something new — no repeating the same information through functionally identical shots. Change the
picture to clarify, reveal, compare or restore attention.

### 3.3 Key moments

Name them (a result reveal, a substantiated surprising number, a critical mistake, a change of
expression, an important feature, a before/after, a resolved open loop, a moment of recognition) and
give each its exact treatment — a brief pause, a precisely timed cut, a change of shot size, a
controlled push-in, a short hold on a detail, a split-screen reveal, a timed sound, a change of music
intensity, restrained typographic emphasis, an action-motivated transition. The treatment matches the
moment's weight; no automatic slow-motion, impact, zoom, glitch or dramatic music.

### 3.4 Animation-only segments

Specify: starting state; initial composition; the element that moves or changes; order of events;
direction and speed; where the viewer should look; final state; the transition after. Animation shows
relationships, processes or change. Example: revenue versus net profit must explain that relationship
accurately, not show two glowing numbers.

### 3.5 CTA and ending

Specify: final visual; exact wording; spoken, displayed or both; how long it stays readable; the role
of the interface, logo or brand; the transition in; whether the last frame connects to the first for a
loop. No long logo animation after the message is finished. The CTA fits the objective — save, share,
comment, follow, explore a feature or visit the site — not always a sale.

## 4. Timing and pacing

A precise timeline in practical ranges (`00:00–00:02`, `00:02–00:05` …), each with the reason its
duration fits (information density, speech rate, action, purpose). Five seconds is a starting
heuristic for «should the picture change?», not a rule: a meaningful shot may stay longer, a fast
sequence may change several times in two seconds. Avoid stagnation the content does not justify;
never cut only to satisfy a timer; leave time to read important information; cut on meaningful
actions, speech, music or narrative turns; use pauses deliberately; avoid cut-fatigue.

## 5. Subtitles, typography, composition

Defined in the plan, not left to production. Subtitles sit consistently near the bottom inside the
platform-safe area, readable against the background, never over a face or over product elements,
numbers, buttons or actions. Persian sentences split into natural readable units; correct Persian
spelling, punctuation, spacing and RTL; no overlong lines or decorative type; emphasis only on words
with real meaning; legible on a typical phone; account for platform overlays and the publishing format.
Subtitles and headline type have different jobs; not every spoken word needs a large animated text.

## 6. Brand identity

Before choosing an editing style, inspect what the repository documents: brand colours, logo
variants, typography and Persian font support, interface styling, iconography, motion/video guidelines,
social identity. Use documented values; never present an invented colour, font or rule as official —
name what is unknown. Consistency is not sameness: recognisable brand, distinct visual language per
concept (a relatable owner story may use natural footage and restrained type; a product demo, clean
captures and precise motion).

## 7. Existing footage is inspected before it is planned

If the task edits a source video, inspect the actual video first — never plan from a filename or a
short description. Analyse the shot sequence; speech content and timing; main actions and reactions;
the strongest hook candidates; important visual detail; repetition and waste; cutaway and insert
opportunities; where A-roll, B-roll or split screen fit; where subtitles or graphics would obstruct;
audio problems, pauses and sync opportunities; what to keep, shorten, reorder or remove. Establish
the timing of important speech and events. If the video cannot be accessed or inspected, say so —
never claim to have watched footage that was not available. A real product interface in the source is
preserved as it behaves and looks; it is not replaced by an easier-to-animate invention.

## 8. `## Editing Blueprint` — required in every one of the 100 scenario files

An executable plan, not creative advice. A timeline table with exactly these columns:

| Column              | Required content                                                                 |
| ------------------- | -------------------------------------------------------------------------------- |
| Timecode            | exact start and end                                                              |
| Narrative purpose   | what the segment must communicate                                                |
| Visual format       | A-roll, B-roll, split screen, product footage, motion graphics, or a combination |
| Source and assets   | existing footage, new footage needed, verified product capture, graphics, other  |
| Composition         | framing, subject placement, layout, hierarchy                                    |
| On-screen action    | what actually happens                                                            |
| Editing and motion  | cuts, reframing, movement, animation, speed changes                              |
| Transition          | how it enters and exits                                                          |
| Text and subtitles  | exact copy, placement, timing, emphasis                                          |
| Audio               | dialogue, voice-over, music, effects, pauses, sync points                        |
| Editorial rationale | why this treatment                                                               |

It must be specific enough for an editor or production system to implement without inventing the
core creative decisions. After the table:

- **A. Overall editing strategy** — concept, pacing, visual language, narrative structure.
- **B. Shot and layout plan** — how A-roll, B-roll, split screen, product footage and animation are distributed.
- **C. Transition plan** — only the transitions that matter, with their narrative purpose; a plain cut where a cut is better.
- **D. Typography and subtitle plan** — headline treatment, subtitle behaviour, hierarchy, safe areas, Persian RTL.
- **E. Audio editing plan** — voice-over timing, music progression, effects, silence, key sync points (library and placement: `CLAUDE.md` §17).
- **F. Asset requirements** — footage, screenshots, screen recordings, graphics, audio; **existing** versus **to be created or sourced**.
- **G. Production feasibility** — how this edit is built with the real engine, components, tools and assets; nothing is called executable if the project cannot do it without further implementation.
- **H. Quality assurance** — how timing, readability, visual consistency, audio sync (`scripts/check-av-sync.mjs`), product accuracy, export quality and the CTA are verified.

## 9. Diversity across the 100

The editing requirements are applied without becoming one repeated template. Do not default to the
same opening shot, camera movement, transition, subtitle animation, music pattern, colour treatment,
split-screen layout, product reveal, logo animation or CTA composition. Each scenario has its own
editorial reason for its structure.

Before the 100 are final, audit the whole set for repetition in: hook structure, shot sequencing,
editing rhythm, composition, transition choices, motion-graphics techniques, sound design, narrative
payoff. Where patterns repeat, decide whether the content justifies it; if not, revise. Diversity is
substantive — a new background colour or a different floating card is not a different concept.
The audit is a matrix kept beside the plan (`docs/100-VIDEO-PLAN.md`), one row per scenario.

## 10. Approval before final production

1. **Inspection and planning** — inspect source footage, repository, assets and constraints; write the blueprint; list missing assets, assumptions and technical limits; present the plan.
2. **Approval** — wait for explicit approval before final production, unless the owner has already authorised direct execution.
3. **Production** — implement the approved plan, keeping the agreed direction.
4. **QA** — review against the blueprint and report deviations and open issues.

For the 100: no approval per file. Write the scenario plans and the diversity matrix, pick **five
representative scenarios with clearly different approaches**, present those five, refine the direction
from the feedback, then apply it to the rest while keeping each scenario's identity. An explicit
authorisation to produce directly overrides this stage.

## 11. Acceptance — a scenario passes only when

- every segment has a clear narrative purpose and the format fits the content;
- the timeline is realistic and consistent, and specific enough to implement;
- every visual change is motivated, and subtitles/text are readable and correctly placed;
- Persian text and RTL are right, and audio and picture are synchronised;
- the product is shown accurately, and required assets and dependencies are named;
- the ending completes the story and serves the objective;
- the scenario adds to the diversity of the set and is compatible with what the project can do;
- the result can be judged against explicit QA criteria.

A timeline, or a mention of several transitions, is not by itself a pass.
