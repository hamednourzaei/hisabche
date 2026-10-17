# Hisabche Promo Reel — Registration & Wiring Contract
> **Path:** `.claude/reel-plugin/registration-contract.md`  
> **Source of Truth:** `src/reels/index.ts`, `src/data/reel-ledger.json`, `docs/prompts/`

When a new reel (e.g. Reel #55) is generated, it must be wired into the repository following this exact 7-step sequence without exception:

---

## Step 1: Create Definition File
Create `src/reels/reel-55-<slug>.ts`:
```ts
import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'

export const reel55: Reel = {
  id: '55',
  title: '...',
  duration: 26.0,
  theme: 'financial-intelligence',
  storyMatrix: { ... },
  scenes: [ ... ]
}
```

---

## Step 2: Wire into Global Reel Registry (`src/reels/index.ts`)
In `src/reels/index.ts`:
1. Add import:
   ```ts
   import { reel55 } from './reel-55-<slug>'
   ```
2. Add to `export const REELS: Reel[] = [ ..., reel55 ]`
3. Add to bottom export list:
   ```ts
   export { ..., reel55 }
   ```

---

## Step 3: Append Entry to Ledger (`src/data/reel-ledger.json`)
In `src/data/reel-ledger.json`, append a new entry to the `reels` array:
```json
{
  "id": "55",
  "title": "عنوان ریلز ۵۵",
  "theme": "financial-intelligence",
  "hookFormula": "immediate-consequence",
  "dominantLayout": "spatial-2.5d-portal",
  "cardQuotaPercent": 15,
  "components": ["word-sync", "word-sync", "word-sync", "word-sync", "word-sync"]
}
```

---

## Step 4: Author Strategy Prompt Document (`docs/prompts/reel-55-prompt.md`)
Create `docs/prompts/reel-55-prompt.md` containing:
- Voiceover artist guidance (tone, pacing, pauses).
- Full 5-scene Persian script breakdown.
- Synchronized visual actions for key words.
- Instructions for audio ingestion (`node scripts/align-voiceover.mjs 55`).
- *Note:* All strategy labels and debug phase headers belong in this file, NOT inside the 9:16 video canvas.

---

## Step 5: Update Reel State Pointer (`.claude/reel-plugin/reel-state.json`)
Update the fast-track state file so the next agent doesn't scan the codebase:
```json
{
  "lastReelId": 55,
  "nextReelId": 56,
  "lastUpdated": "2026-10-16",
  "sdkVersion": "1.0.0"
}
```

---

## Step 6: Update Style Memory (`.claude/reel-plugin/recent-reels.json`)
Append the new reel metadata to `recent-reels.json` so future agents avoid repeating this creative mechanism.

---

## Step 7: Fast Typecheck & Verify
Run:
```bash
npm run typecheck
```
Verify zero TypeScript compilation errors.
