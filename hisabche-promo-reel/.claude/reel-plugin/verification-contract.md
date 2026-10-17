# Hisabche Promo Reel — Verification & Provenance Contract
> **Path:** `.claude/reel-plugin/verification-contract.md`  
> **Standard:** AGENTS.md §8 & §9 — Rigorous Truthful Verification

---

## 1. The 5-Stage Verification Pipeline

Before reporting any reel as complete, execute this exact sequence:

```bash
# 1. Typecheck: Zero TypeScript compilation errors
npm run typecheck

# 2. Test Suite: Ensure all 141+ motion, alignment, and speech tests pass
npm test
# (or: node ../backend/node_modules/vitest/vitest.mjs run)

# 3. Production Build: Ensure Vite builds cleanly without bundle errors
npm run build

# 4. Visual QA Snapshots: Render 1080x1920 scene-boundary frames
node scripts/visual-qa.mjs <ID>

# 5. Deterministic MP4 Export: Render full 780 frames + audio track
node scripts/export-mp4.mjs <ID>
```

---

## 2. Audio Provenance & Alignment Truthfulness

Never claim a reel is "word-synced with human speech" when no audio file has been ingested. Adhere strictly to the 5 lifecycle states:

| Lifecycle Status | Provenance Rule | Confidence Value |
|---|---|---|
| `PROVISIONAL_CADENCE_MODEL_ACTIVE` | Audio file absent. Timings mathematically estimated via syllable weights in `cadence-model.ts`. | **MUST be `null`** (never fake a float like 0.85). |
| `AUDIO_DETECTED_NOT_WORD_ALIGNED` | Audio file present (`audio/reel-XX-vo.wav`), but word alignment has not yet been extracted. | `null` |
| `EXTERNAL_UNVERIFIED` | Word timestamps provided by external tool without verifiable cryptographic execution trace. | `null` |
| `MANUAL_REVIEW_ACCEPTED` | Timestamps reviewed and accepted by a human operator. | `null` |
| `REAL_WORD_ALIGNMENT_READY` | Real audio file ingested AND verified subprocess ASR / forced-aligner trace validates >= 90% word coverage with zero collisions. | Real float (e.g. `0.94`) |

### Critical Rule on Speech Engines:
**ASR (Speech-to-Text) is NOT Forced Alignment.**  
Never allow an agent to describe OpenAI Whisper word timestamps as "Forced Alignment" unless a dedicated forced-alignment engine (e.g. CTC aligner against the reference text) was executed.

---

## 3. Reporting Format (AGENTS.md §9)

Every final report delivered to the founder must follow this exact Persian structure:

1. **وضعیت (Status):** Exactly one of `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_BY_EXISTING_SYSTEM` · `FAILED`. Never `VERIFIED_COMPLETE` without live database or real audio.
2. **فایل‌های تغییریافته (Files Changed):** Path and 1-line reason for each file.
3. **اعداد اندازه‌گیری‌شده (Numbers Measured):** Exact command outputs (tests passed, build duration, frame count).
4. **کارهای انجام‌نشده (What Was Not Done):** Honest disclosure of deferred steps.
5. **فرضیات (Assumptions):** Decisions made on behalf of the task.
6. **اقدامات لازم توسط کارفرما (For the Owner):** Order of commands or audio files to provide.
