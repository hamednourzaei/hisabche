# Task for the agent: replace synthesized sound with a licensed recorded SFX + music library

You are working in `hisabche-promo-reel/` (Persian SaaS promo reels, React + Vite, deterministic
clock, MP4 export via `scripts/export-mp4.mjs` → `scripts/sound-design.mjs`).
Read `CLAUDE.md` in this folder and `.claude/reel-plugin/production-guardrails.md` first.

## The problem

Every sound in the reels is synthesized from oscillators and noise (`scripts/sound-design.mjs`
for the MP4, `src/engine/sound.ts` for the live preview). The owner's verdict: the sounds are
ugly and amateur. Replace them with **real recorded, properly licensed** sound effects and a
music bed, while keeping the export deterministic.

## Hard rules (read before downloading anything)

1. **Licenses: commercial use, no attribution required, redistribution inside a repo allowed.**
   Accept only:
   - **CC0 / Public Domain** (e.g. Freesound filtered to CC0, Kenney.nl audio packs, OpenGameArt CC0),
   - **Pixabay Content License** (sound effects and music, pixabay.com),
   - **Mixkit Free License** for SFX/music _only if_ its terms allow use inside a commercial video
     (they do for videos; do not redistribute the files outside this repo).

   **Rejected:** any CC-BY-NC, CC-BY-ND, "personal use only", YouTube rips, "free trial" packs,
   anything whose license you could not read on its own page. **CC-BY is allowed only if you
   record the exact attribution line**, but prefer CC0.

2. **Download only audio files** (`.wav`, `.ogg`, `.mp3`, `.flac`). Never download or run an
   executable, installer, browser extension or script. Never paste credentials anywhere. If a site
   requires login, skip it.
3. **Every file is logged** in `assets/sfx/LICENSES.md`: file name → source page URL, author,
   license name, license URL, date downloaded. A file without a row is deleted.
4. **Size budget:** the whole `assets/` audio folder ≤ **15 MB**. Convert to **OGG Vorbis q5,
   48 kHz** (or MP3 192k) with ffmpeg (`C:\ffmpeg\bin\ffmpeg.exe` is installed). Trim silence,
   fade the edges (5 ms) so nothing clicks.
5. **Git:** `hisabche-promo-reel/.gitignore` ignores `*.wav` and `*.mp4`. Store library files as
   `.ogg` under `assets/sfx/` and `assets/music/` and make sure they ARE tracked
   (`git check-ignore` must print nothing for them). Finished videos still go to
   `%USERPROFILE%\Videos\hisabche-reels` — do not change that.
6. **No commit, no push.** The owner commits.
7. **Determinism stays:** the same reel must produce the same audio bytes every export. Variant
   choice (when a kind has several takes) is chosen by a hash of `(reelId, cueIndex)`, never
   `Math.random()`.

## What to build

### 1. The library (`assets/`)

For each `SoundKind` in `src/engine/sound.ts` (the full list is in
`.claude/reel-plugin/fast-track-sdk.md` §3), source **2–3 takes** so repeats don't sound
mechanical. Character guide (the bar is Apple / Linear product films — tactile, warm, never
8-bit, never a harsh beep):

| Kinds                                                                          | What it should sound like                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| `pop`, `chatPop`                                                               | soft UI bubble / soft click, not a game coin        |
| `tick`, `clockTickRapid`                                                       | a real mechanical watch / wall clock                |
| `typewriterClick`                                                              | real keyboard or typewriter keys                    |
| `markerScribble`                                                               | felt marker on paper                                |
| `paperRustle`, `paperTear`                                                     | paper handling, a sheet tearing                     |
| `cardEnter`, `cardThock`                                                       | a card / file set down on a desk, soft wooden thock |
| `cash`                                                                         | coins dropping / a cash drawer                      |
| `receiptPrint`                                                                 | a thermal receipt printer                           |
| `whoosh`, `cameraSwish`, `softTransition`, `sceneTransition`                   | airy, low whooshes (no white-noise hiss)            |
| `impact`                                                                       | rubber stamp slam on paper                          |
| `alert`                                                                        | a muted, low two-note notification, never a siren   |
| `titleHit`, `bigReveal`, `majorReveal`                                         | cinematic boom / hit with a short tail              |
| `cinematicReveal`, `insightReveal`                                             | soft shimmer / swell                                |
| `dataFlow`, `sync`, `scan`, `precisionSequence`                                | subtle digital ticks, barcode scanner beep (soft)   |
| `success`, `chime`, `financialMilestone`, `successResolution`, `ctaResolution` | warm muted chime / soft resolve, no piercing bells  |

Plus **3–4 music beds** (calm corporate / minimal electronic / tense-then-resolve), each
≥ 30 s, loopable, instrumental, same license rules. Put them in `assets/music/`.

Write `assets/sfx/manifest.json`: `{ "<SoundKind>": ["file1.ogg", "file2.ogg"], ... }` and
`assets/music/manifest.json`: `[{ "file": "...", "mood": "calm|tense|uplifting", "bpm": 0 }]`.

### 2. The export (`scripts/sound-design.mjs`)

- Load samples by decoding each `.ogg` once to 48 kHz stereo float PCM with ffmpeg
  (`-f f32le -ac 2 -ar 48000 pipe:1`), cache in memory for the run.
- For every cue: if the manifest has the kind, place the recorded take (deterministic variant,
  gain per kind, stereo pan as today); **only if** a kind is missing, fall back to the existing
  synthesized recipe. Keep the existing hit-thinning rule (one hit per 120 ms).
- Replace the synthesized pad (`musicBed`) with a chosen music file: pick by a new optional
  `Reel.musicMood` (default `calm`), loop/trim to the reel length, fade in 1.5 s / out 1.2 s,
  **keep the side-chain ducking** under hits, and duck the music by about −10 dB whenever a
  voiceover file exists (`audio/reel-XX-vo.*`).
- Keep the reverb send and the mastering chain, and the result must still measure
  **−14 ± 1 LUFS integrated, true peak ≤ −1 dBTP** (measure with
  `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`).

### 3. The live preview (`src/engine/sound.ts`)

Play the same files in the browser (Web Audio `decodeAudioData`, files served by Vite from
`assets/`), same variant rule, synth fallback only for missing kinds. Mute toggle unchanged.

### 4. Tests (vitest, in `src/__tests__/` or `scripts/__tests__/`)

- every `SoundKind` either has ≥ 1 file in the manifest or is listed in an explicit
  `SYNTH_FALLBACK_ALLOWED` array (that list should end up empty or near-empty);
- every file in the manifests exists, and every file in `assets/` has a row in `LICENSES.md`
  with a license from the allowed list (parse the markdown table);
- the variant choice is deterministic (same inputs → same file);
- total size of `assets/` ≤ 15 MB.

## Measure vs do — keep these separate

- **Do:** everything above.
- **Measure and report, do not "fix" by guessing:** loudness numbers, file sizes, which kinds
  still fall back to synthesis, and any license you were unsure about (leave it out and list it).

## Done means (paste real command output in the report)

```bash
cd hisabche-promo-reel
npm run typecheck
npm test
npm run build
node scripts/export-mp4.mjs 60
C:\ffmpeg\bin\ffmpeg.exe -hide_banner -i "%USERPROFILE%\Videos\hisabche-reels\reel-60.mp4" -af ebur128=peak=true -f null - 2>&1 | findstr /C:"I:" /C:"Peak:"
```

Report in Persian with: files added (count, total MB), the license table, which kinds still
fall back to synthesis, LUFS / true-peak of reel 60, test numbers. Status per project rules:
`IMPLEMENTED_NOT_LIVE_VERIFIED` (a human has to listen and approve the sound).
