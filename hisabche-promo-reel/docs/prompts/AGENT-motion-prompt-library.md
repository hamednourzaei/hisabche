# Task for the agent: build a library of 50+ motion-graphics prompts, rewritten for Hisabche

You are working in `hisabche-promo-reel/` (Persian SaaS promo reels for Hisabche — accounting,
inventory, till, multi-currency; React + Vite, deterministic clock, 9:16, 26–60 s).
Read `CLAUDE.md` in this folder, `.claude/reel-plugin/creative-director.md`,
`.claude/reel-plugin/production-guardrails.md` and `SCENARIOS.md` first.

You may split the work across parallel sub-agents (one per source site), then merge.

## Goal

Study real motion-graphics / video prompt libraries, extract what makes good prompts work
(structure, camera language, timing, easing, transitions, typography motion, UI animation),
and produce **at least 50 Hisabche-specific prompts** that our studio can turn into reels.
Each final prompt keeps the technique of its source but carries **our** story, product and
numbers.

## Sources

| #   | Site                                                  | Use                                                      |
| --- | ----------------------------------------------------- | -------------------------------------------------------- |
| 1   | https://promptmotion.org/prompts                      | UI animation, product teasers, kinetic type              |
| 2   | https://oneshotted.io/                                | product launch, logo reveal, UI motion made with code    |
| 3   | https://runway.com/resources/ai-video-prompting-guide | how to describe camera, action, timing                   |
| 4   | https://heydreaming.com/prompts                       | ad sequences with timing/camera/light — **CC BY 4.0**    |
| 5   | https://ai9app.io/video-prompts                       | coded motion graphics, explainers                        |
| 6   | https://www.medeo.app/prompts/video                   | product ads, social video                                |
| 7   | https://imageprompts.app/video-prompts                | camera moves, transitions, product                       |
| 8   | https://www.freeveoprompt.com/                        | product ad structure (subject/action/camera/light/style) |
| 9   | https://soprompts.com/free-ai-video-prompts           | product, cinematic, ads                                  |
| 10  | https://wadepixels.com/prompts.html                   | style breakdowns, motion design guides                   |

Prioritise what fits **motion graphics for a SaaS product**: kinetic typography, UI animation,
staggered reveals, easing, seamless transitions, product explainers, data visualisation.
Skip photoreal people, fantasy, and anything that needs a generative video model to work.

## Legal and safety rules (non-negotiable)

1. **Read each site's terms / license page and its `robots.txt` before collecting.** Do not
   collect from pages `robots.txt` disallows; do not bypass logins, paywalls, rate limits or
   CAPTCHAs; at most one request per second per site; identify honestly (no fake browser UA
   tricks to dodge blocks). If a site blocks automated access, read it by hand or skip it.
2. **Copying rules:**
   - **HeyDreaming (CC BY 4.0):** you may store and adapt prompts, and every one carries its
     attribution (title, author if given, URL, "CC BY 4.0", "adapted").
   - **Every other site (license unstated):** do **not** store their prompt text verbatim.
     Record only _what technique it uses_ (in your own short words) + the source URL, and write
     the Hisabche prompt **from scratch**. Quoting more than one short phrase is not allowed.
3. Download **text only**. No videos, images, executables, extensions or scripts. No login, no
   credentials anywhere.
4. No commit, no push. The owner commits.

## Product truth (every final prompt must respect it)

Only show what Hisabche really does. Allowed claims (check `SCENARIOS.md` and
`docs/WEAKNESSES-100.md` §الف): invoice → stock, till/bank, customer balance, double-entry
ledger and profit update together; per-invoice profit, and «نامعلوم» when the purchase cost is
missing; multi-warehouse, transfers, stock count, the warehouse map and shelf locations;
multi-currency with the day's rate frozen on the invoice, exchange gain/loss, gold/silver by the
gram; roles, audit log, separation of duties; Excel/CSV import with preview; offline **in the
Windows and mobile apps** with sync on reconnect; AI assistant; free plan.

**Forbidden claims:** سامانه مودیان / tax-ID connection, SMS reminders or SMS signatures,
«تضمین», «۱۰۰٪», «ضدجعل», legal/tax outcomes, bank connection, fake customers or fake
testimonials, numbers that do not add up.

## Output

```
hisabche-promo-reel/docs/prompt-library/
  README.md                 index table: id, title, technique, persona, product feature, source, license
  SOURCES.md                every page visited: URL, date, license/terms found, robots.txt result,
                            what was taken (technique note or adapted CC BY text)
  techniques.md             the extracted craft, grouped: camera, easing, transitions, typography,
                            UI motion, data-viz, sound cues — each with source URL(s)
  prompts/
    hp-001-<slug>.md … hp-050+-<slug>.md
```

Each `prompts/hp-XXX-<slug>.md`:

```markdown
# <Persian title>

- technique: <e.g. staggered card cascade + push-in + odometer>
- source: <URL> · license: <CC BY 4.0 adapted | technique only>
- persona: <retail-shopkeeper | wholesaler | workshop-producer | money-changer | goldsmith | accountant | multi-branch>
- feature: <the ONE real Hisabche feature it proves>
- duration: <26–45 s> · format: 9:16 (1080×1920)

## Story (Persian, in medias res — no «سلام، امروز…»)

<3–6 lines: the merchant moment, the pain with real-looking numbers that add up, the turn>

## Shot list

| t                                                                                                    | on screen | motion / camera / easing | sound cue (SoundKind) |
| ---------------------------------------------------------------------------------------------------- | --------- | ------------------------ | --------------------- |
| 0.0–3.5                                                                                              | …         | …                        | …                     |
| … (hook ≤ 3.5 s, climax held ≥ 1.2 s, CTA in at +0.3 s and held ≥ 3 s, hisabche.com on the end card) |

## Voiceover (Persian, word count ≤ 70)

<script>

## Build notes for our engine
<which existing scene kinds / actors from `.claude/reel-plugin/scene-catalog.md` fit, or what
new actor would be needed — never assume an API that is not in the SDK>
```

Mix of the 50+ prompts (at least): 10 kinetic-typography, 10 UI-animation/product-demo,
8 data-viz (numbers, charts, ledgers), 8 before/after or split, 6 one-shot continuous camera,
4 humour or human moment, 4 industry-specific (goldsmith, money changer, clothing, pharmacy).
No two prompts with the same hook line or the same feature + persona pair.

## Where they are used

- Do **not** create or edit reels in `src/` in this task. The library feeds `/new_reels`.
- Add one line to `.claude/reel-plugin/creative-director.md`: «Before writing a new reel, pick
  an unused prompt from `docs/prompt-library/README.md` and mark it used there.»
- If a prompt needs an engine capability we lack (e.g. a camera move), list it in
  `docs/prompt-library/README.md` under «Gaps» — do not build it here.

## Measure vs do

- **Do:** collect, extract, write the prompts and the files above.
- **Report, do not decide silently:** sites skipped and why, licenses you could not determine,
  any prompt you were unsure is truthful about the product.

## Done means (report in Persian)

- number of prompts written (≥ 50) and the mix table;
- per site: pages visited, what was taken, license/robots result;
- `grep` for the forbidden words above over `docs/prompt-library/` returns nothing
  (paste the command and its empty output);
- status `IMPLEMENTED_NOT_LIVE_VERIFIED` (a human picks which prompts become reels).
