# DESKTOP STATUS v2.0

## Current Environment Issue
- ❌ **pnpm@10 vs npm@21 dependency conflict**
- ❌ **CI workflow using npm instead of pnpm**
- ❌ **Cannot generate production installers**

## Problem Analysis

### Root Cause
The Hisabche Desktop build system fails because:

1. **Repository uses pnpm workspaces** (`pnpm-workspace.yaml`) and `pnpm-lock.yaml`
2. **CI workflow uses npm** (`cache: npm`, `npm ci --legacy-peer-deps`)
3. **Version mismatch**: npm@21 incompatible with pnpm@10 environment

### Current State
```
Node: v24.12.0 (Latest)
npm: auto-installed (likely v21+)
pnpm-lock.yaml: NOT FOUND (repo uses pnpm-lock.yaml)
pnpm-lock.yaml: EXISTS
pnpm-workspace.yaml: EXISTS
```

CI workflow lines causing issues:
- Line 25: `cache: npm` (should be pnpm)
- Line 29: `npm ci --legacy-peer-deps` (should be `pnpm install`)
- Line 32: `npm run type-check` (should be `pnpm type-check`)
- Line 35: `npm test` (should be `pnpm test`)

## Immediate Fix Required

### Step 1: Update GitHub Workflow
**File:** `.github/workflows/desktop.yml`

Change:
```yaml
cache: npm
- run: npm ci --legacy-peer-deps
- name: Type-check (renderer + main)
  run: npm run type-check --workspace @hisabche/desktop
- name: Unit tests
  run: npm test --workspace @hisabche/desktop
- name: Build
  run: npm run build --workspace @hisabche/desktop
```

To:
```yaml
cache: pnpm
- run: pnpm install --frozen-lockfile
- name: Type-check (renderer + main)
  run: pnpm run type-check --filter desktop
- name: Unit tests
  run: pnpm test --filter desktop
- name: Build
  run: pnpm run build --filter desktop
```

### Step 2: Update Desktop Package
**File:** `apps/desktop/package.json`

Add `pnpm` as package manager:
```json
{
  "name": "@hisabche/desktop",
  "packageManager": "pnpm@10.0.0",
  "pnpm": {
    "overrides": {
      "react": "19.2.6",
      "react-dom": "19.2.6"
    }
  }
}
```

### Step 3: Ensure Lock File

pnpm has native peer dependency resolution, no legacy-peer-deps needed.

## Fix Strategy

### High Priority Actions:
1. Update GitHub workflow to use pnpm
2. Set proper cache key for pnpm
3. Use frozen-lockfile for consistency
4. Update package-manager field in desktop package.json

### Medium Priority:
1. Update repository's root package.json if needed
2. Verify pnpm versions across all environments
3. Update CI runner setup to use pnpm

## IMMEDIATE FIX CHECKLIST

**URGENT - Must fix before any further work:**

[ ] Update `.github/workflows/desktop.yml` to use pnpm
[ ] Update `apps/desktop/package.json` packageManager field
[ ] Test local: `pnpm install --frozen-lockfile`
[ ] Test build: `pnpm --filter desktop build`
[ ] Update CI workflow to cache pnpm

## EXPECTED OUTCOME

After these fixes:

- ✅ **pnpm@10** will be used consistently
- ✅ **pnpm-lock.yaml** will be respected
- ✅ **Native peer dependency resolution** will work
- ✅ **Production builds** will succeed
- ✅ **Installer generation** will work
- ✅ **CI pipeline** will pass

## TECHNICAL DETAILS

### Why pnpm is Required:

1. **Workspace Management**: `pnpm-workspace.yaml` is pnpm-specific
2. **Lock File Format**: `pnpm-lock.yaml` uses pnpm's own format
3. **Native Bindings**: `better-sqlite3` requires proper native module loading
4. **Performance**: pnpm is faster for monorepos

### pnpm Benefits:

- Faster dependency resolution
- Better deduplication
- Native peer dependency handling
- Workspace-first architecture
- Consistent across all environments

## REPOSITORY STRUCTURE

```
.github/workflows/desktop.yml  ❌ WRONG - uses npm
pnpm-workspace.yaml           ✅ CORRECT - pnpm workspaces
pnpm-lock.yaml               ✅ CORRECT - pnpm lock file
```

## SUMMARY

**Issue:** Package manager mismatch between repository (pnpm) and CI workflow (npm)

**Fix:** Update CI to use pnpm, update desktop package.json

**Impact:** Resolves build failures, enables production deployment

**Risk:** Low - straightforward environment alignment