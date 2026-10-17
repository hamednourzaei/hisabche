# Hisabche Universal Reel Generation Plugin

> **Universal Fast-Track AI Agent Contract for the 9:16 SaaS Motion Film Engine**

This directory contains the machine-readable and human-readable fast-track contracts for generating promo reels in Hisabche.

## Architecture & Zero-Discovery Workflow

```text
User: /new_reels [موضوع]
        ↓
.claude/commands/new_reels.md (Command Entrypoint)
        ↓
.claude/skills/new-reels/SKILL.md (Canonical Skill Execution)
        ↓
Reads ONLY the Fast-Track Context:
  ├── plugin-manifest.json      (Machine manifest)
  ├── fast-track-sdk.md         (TypeScript interfaces & golden example)
  ├── production-guardrails.md  (Visual, subtitle, timing, & math guardrails)
  ├── creative-director.md      (Narrative arcs, tension formulas, & mechanisms)
  ├── scene-catalog.md          (All supported SceneSpec kinds & props)
  ├── token-catalog.md          (Exact icons, tones, rich markup, & audio cues)
  ├── registration-contract.md  (4-step registration recipe)
  ├── reel-state.json           (Fast pointer to next Reel ID)
  └── recent-reels.json         (Last 7 reels style memory to prevent repetition)
        ↓
Zero-Scan Implementation (no grepping or reading src/):
  ├── src/reels/reel-XX-<slug>.ts
  ├── docs/prompts/reel-XX-prompt.md
  ├── src/reels/index.ts (registration)
  └── src/data/reel-ledger.json (metadata)
        ↓
Verification:
  npm run typecheck && npm test && npm run build
```

## Why This Exists

Without this plugin, AI agents waste minutes and context window tokens scanning 50+ files across `src/` to rediscover interfaces, icon names, scene kinds, and registration points.

With this plugin:
1. **Zero-Discovery**: All contracts are pre-indexed from the verified codebase.
2. **Deterministic Quality**: Hard guardrails prevent negative countdown timers, debug header leaks, and repetitive templates.
3. **Universal Compatibility**: Works identically in Claude Code, Cursor, GitHub Copilot, Codex, and OpenAI CLI.
