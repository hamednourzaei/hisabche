# DESKTOP RELEASE AUDIT v2.0

## 🚨 CRITICAL ISSUE IDENTIFIED

### Root Cause: Package Manager Mismatch

**Repository Configuration:**
- ✅ Uses pnpm workspaces (`pnpm-workspace.yaml`)  
- ✅ Uses pnpm lock file (`pnpm-lock.yaml`)
- ✅ Uses pnpm commands throughout codebase

**CI Pipeline Configuration:**
- ❌ Uses npm in GitHub Actions (`actions/setup-node` with npm)
- ❌ Uses legacy-peer-deps workaround
- ❌ Incompatible cache strategy

### Impact Analysis

**Current State:**
```
Node: v24.12.0 (Latest)
pnpm: auto-installed v21+
pnpm-lock.yaml: EXISTS
pnpm-workspace.yaml: EXISTS
pnpm-lock.yaml: EXISTS
```

**Problems:**
1. **Package Resolution Conflict**: npm vs pnpm dependency resolution
2. **Lock File Issues**: npm cannot read pnpm-lock.yaml
3. **Peer Dependencies**: `legacy-peer-deps` needed due to conflicts
4. **Build Failures**: Cannot install dependencies correctly
5. **Installer Generation**: Cannot create .exe/.dmg/.AppImage

### Evidence

**GitHub Workflow (desktop.yml) problematic lines:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: npm  # ❌ WRONG - should be pnpm

- run: npm ci --legacy-peer-deps  # ❌ WRONG - should be pnpm install

- run: npm run type-check --workspace @hisabche/desktop  # ❌ WRONG - should be pnpm run
```

**Desktop Package (apps/desktop/package.json):**
```json
{
  "name": "@hisabche/desktop",
  "version": "0.0.1",
  // ❌ Missing: "packageManager": "pnpm@10.0.0"
}
```

### Technical Details

**Why pnpm is Required:**

1. **Workspace Architecture**: `pnpm-workspace.yaml` is pnpm-specific
2. **Lock File Format**: `pnpm-lock.yaml` uses pnpm's own format
3. **Native Module Loading**: `better-sqlite3` requires pnpm's native binding
4. **Monorepo Performance**: pnpm excels with workspace structures
5. **Peer Dependency Resolution**: pnpm has superior handling

**pnpm Benefits:**
- Faster dependency resolution (~5-10x faster)
- Better deduplication
- Native peer dependency handling
- Workspace-first architecture
- Consistent across all environments

### Solution Required

### **Fix Priority 1: Update CI Pipeline**
**File:** `.github/workflows/desktop.yml`

**Changes:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm  # ✅ SHOULD BE pnpm

- run: pnpm install --frozen-lockfile  # ✅ SHOULD BE pnpm install

- run: pnpm run type-check --filter desktop  # ✅ SHOULD BE pnpm run
- run: pnpm test --filter desktop              # ✅ SHOULD BE pnpm test
- run: pnpm run build --filter desktop       # ✅ SHOULD BE pnpm run
```

### **Fix Priority 2: Update Desktop Package**
**File:** `apps/desktop/package.json`

**Add:**
```json
"packageManager": "pnpm@10.0.0",
"pnpm": {
  "overrides": {
    "react": "19.2.6",
    "react-dom": "19.2.6"
  }
}
```

### **Fix Priority 3: Verify Local Environment**
**Local setup:**
```bash
# ✅ CORRECT - should use pnpm
pnpm install --frozen-lockfile
pnpm --filter desktop type-check
pnpm --filter desktop test
pnpm --filter desktop build
```

**❌ BROKEN - currently using npm:**
```bash
npm ci --legacy-peer-deps
npm run type-check --workspace @hisabche/desktop
npm test --workspace @hisabche/desktop
npm run build --workspace @hisabche/desktop
```

### Build Status

**Current:** ❌ BROKEN
- Package manager mismatch
- Lock file incompatibility
- CI pipeline using wrong tools

**Target:** ✅ WORKING
- pnpm as primary package manager
- Correct lock file usage
- Consistent environment across all platforms

### Files Modified for Fix:

1. **`.github/workflows/desktop.yml`** - Update cache to pnpm
2. **`apps/desktop/package.json`** - Add packageManager field

### Verification Steps:

1. **Update GitHub workflow** - Change npm to pnpm
2. **Add packageManager** - To desktop package.json
3. **Test locally** - Use pnpm install and build
4. **Run CI** - Verify workflow changes work

### Expected Outcome After Fix:

✅ **pnpm@10** will be used consistently
✅ **pnpm-lock.yaml** will be respected
✅ **Native peer dependency resolution** will work
✅ **Production builds** will succeed
✅ **Installer generation** will work
✅ **CI pipeline** will pass

### Risk Assessment:

**Risk Level:** LOW
- Straightforward environment alignment
- No architectural changes required
- Clear dependency on pnpm across entire stack

**Impact:** HIGH
- Block to production deployment
- Cannot generate installers
- CI pipeline failure

### Conclusion:

**Issue:** Package manager mismatch between repository (pnpm) and CI workflow (npm)

**Root Cause:** CI workflow incorrectly uses npm despite repository being entirely pnpm-based

**Fix:** Update CI pipeline and desktop package.json to use pnpm

**Status:** ✅ ANALYSIS COMPLETE - Ready for implementation

**Next Step:** Apply fixes to CI pipeline and package configuration