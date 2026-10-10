# Landing scene «Living Store» — progress against the brief

Updated 10 Oct 2026 (second round). Scene code: `packages/ui/src/components/ui/landing/journey/`
and `packages/ui/src/components/ui/landing/three/`.

| File                    | What it owns                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| `journey-hero.tsx`      | Server component: resolves every word, renders `<h1>` and the invitation   |
| `journey-stage.tsx`     | Client: which beat is on screen, the route, captions, bubble, text summary |
| `journey-machine.ts`    | Pure: WHERE the story is (beat, phase, gates, recorded, invited)           |
| `landing-demo-data.ts`  | Pure: the one sample sale and every figure derived from it                 |
| `journey-screens.ts`    | Pure: what each station's board shows (rows built from the selectors)      |
| `journey-shots.ts`      | Pure: one authored camera shot per station, fit maths, the hall's size     |
| `journey-industries.ts` | The kinds of business named on the wall boards                             |
| `journey-state.ts`      | The plain object the stage writes and the scene reads                      |
| `scene.ts`              | The only file that imports `three`                                         |

The scene is plain `three`, not React Three Fiber. Station order in code:
printer (start) → payment → cash → stock → ledger → report → core (end). Five stations.

## Status by item of the brief

| #   | Item                             | State                  | Evidence / what is missing                                                                                                                                                                                                                             |
| --- | -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Screens show data, no flat green | DONE (seen in browser) | Each station has a 512×320 board painted from `ScreenModel`; desk screens and each clerk's screen show the same boards; small machine screens carry a row pattern. Wall boards name 24 kinds of business with an icon (one texture, one mesh).         |
| 2   | Staff talk to the agent          | PARTLY                 | The clerk turns the head to the agent, raises a hand, an arrow stands over the speaker and one DOM bubble is projected to the head (tablet/desktop); on a phone the line is in the caption. No typewriter.                                             |
| 3   | Gates                            | DONE (seen)            | A fare gate on the road before each station: two hinged glass leaves, lamp amber → green, driven by `snapshot.gates`. Plus the station's arch carrying its board.                                                                                      |
| 4   | Enclosed hall                    | PARTLY                 | Four walls, ceiling with beams and light strips, tiled floor with grout and an inlaid path, dock door, shop front. NOT done: dithered wall dissolve, skirting, vents, environment reflection.                                                          |
| 5   | Lighting design                  | PARTLY                 | ACES tone mapping, hemisphere + key + a spot pool that follows the active station + rim light on the agent (not on phones), floor glow, contact shadows. NOT done: shadow maps, PMREM environment, vignette, tiers beyond phone/desktop.               |
| 6   | Camera moves and focuses         | DONE (seen) / PARTLY   | One authored shot per station (`journey-shots.ts`), five different moves, eye level (owner's request), fitted to the free band of the frame with `setViewOffset`, clamped inside the hall. NOT done: spline path, occluder raycasts, pointer parallax. |
| 7   | Carried sheet blocks the view    | PARTLY                 | The board hangs above the slot, so the sheet working at the machine does not cover it. No overlap solver, no measurement.                                                                                                                              |
| 8   | Mobile composition               | PARTLY                 | Distance and framing computed from the free band between the route and the caption; yaw limited to ±15°. Seen at 375×812 only.                                                                                                                         |
| 9   | Wall of identical green monitors | DONE (seen)            | Replaced by named business boards and windows only at the two ends.                                                                                                                                                                                    |
| 10  | Counter                          | DONE                   | One sentence template `{current}`/`{total}`, numbers in `<bdi>`, total = number of stations.                                                                                                                                                           |
| 11  | Two console errors               | NOT REPRODUCED         | Fresh loads of `/fa` and `/en` show no console error.                                                                                                                                                                                                  |
| 12  | Figures                          | PARTLY                 | Seated clerks have a chair, a desk, keyboard and screen; staff stand in pairs at the wall tables. Still procedural boxes — reference-quality people need real models, which need the owner's go-ahead to download.                                     |

Owner requests made during this round, all applied: the invitation appears only after
the core has burst, and the burst has a shot of its own; a wheel notch is a small
step (150dvh per beat); eye-level camera; four-legged tables with people grouped at
them; business names on the wall boards and the chip list removed from the landing;
the «double entry» chapter removed (the hall shows it); scrolling back is a scene of
its own (the agent turns round, the van backs in).

## Not started

Offline/sync wave · connectivity state in the machine · receipt stamps as distinct
documents · font-load gate before canvas paint (boards repaint on `fonts.ready`) ·
runtime locale switch without remount · pseudo-locale run · ESLint no-literal-string
rule · WebGL-off poster (the page text and the text summary remain; the canvas is
empty) · Playwright matrix · visual assertions · `3d-living-scene-verification.md`.

## Measured

| Check                                                                                        | Result                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` in `packages/ui` and `apps/web`                                           | 0 errors                                                                                 |
| `npx eslint` on the journey folder, `three/`, changed landing files and the three test files | 0 errors, 0 warnings                                                                     |
| Landing tests (8 files)                                                                      | 160 / 160                                                                                |
| HTTP on the dev server                                                                       | `/fa`, `/af`, `/en` → 200; `/en` HTML contains «13,000 AFN»; no raw key in the HTML      |
| Browser, `/fa` and `/en`, laptop width                                                       | every station, the ending and the opening seen; no console error; no horizontal overflow |
| Browser, 375×812                                                                             | opening, payment, stock, ledger seen                                                     |

## NOT measured

Lighthouse, LCP/CLS, fps, `renderer.info`, texture memory, bundle size, production
build, `/af` in a browser, light theme, tablet sizes, landscape phone, reduced
motion with the OS setting (only simulated in the page), WebGL disabled.
