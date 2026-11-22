---
name: hisabche-release-build
description: The end-of-work gate — full verify, lint, then the site, Windows and Android builds, in that order, with the checks that tell a real build from a stale one. Use only after ALL requested work is finished, or when the owner asks for a build.
---

# Verify, lint, build

**Not before the work is finished.** The owner has stopped a session twice for
building mid-task. Builds are batched at the end, or taken when asked.

## 1. Typecheck everything

```bash
for p in backend packages/ui packages/api packages/validation packages/ui-contract \
         packages/app-shell apps/web apps/desktop apps/admin; do
  (cd $p && npx tsc --noEmit)
done
```

## 2. Tests

```bash
cd backend              && npx vitest run     # ~5–6 min, embedded Postgres included
cd packages/ui          && npx vitest run
cd packages/api         && npx vitest run
cd packages/validation  && npx vitest run
cd packages/ui-contract && npx vitest run
cd apps/desktop         && npx jest
```

Report the real counts. A suite you did not run is «not run», not «green».

## 3. Lint the files you touched

The owner's pre-commit lints staged files — including old errors in a file you
changed one line of. Run eslint **from the package's own folder** (the same
escape is a warning from the root and an error from `backend/`):

```bash
git status --porcelain | awk '{print $2}' | grep -E '^backend/.*\.ts$' | sed 's#^backend/##' > "$TEMP/be.txt"
git ls-files --others --exclude-standard | grep -E '^backend/.*\.ts$' | sed 's#^backend/##' >> "$TEMP/be.txt"
cd backend && npx eslint $(sort -u "$TEMP/be.txt" | tr '\n' ' ')
```

Zero errors is the bar. Warnings that were already there are not yours to fix.

## 4. Builds

Do not touch source while one is running. Each takes minutes; run them one
after another.

### Site

```bash
cd apps/web && npx next build
```

Check the route table lists every new page. `next start` reads the build only
at start — restart the preview server afterwards.

### Windows

```bash
cd apps/desktop && npx electron-vite build \
  && npx electron-builder --win --publish never -c.electronDist=node_modules/electron/dist
```

`-c.electronDist` is required: without it `@electron/get` goes to npmmirror for
a checksum and dies behind the proxy. Output:
`apps/desktop/dist/Hisabche-0.0.1-setup.exe`.

### Android

```bash
cd apps/mobile && pnpm run android:release
# = vite build --config vite.shell.config.mjs && node scripts/copy-shell-for-ios.mjs
#   && node scripts/gradle.mjs assembleRelease
```

⚠️ **The shell first.** The UI lives in the web shell; `gradle.mjs
assembleRelease` alone ends with `BUILD SUCCESSFUL`, every task `UP-TO-DATE`,
and yesterday's APK untouched. Output:
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

The Gradle step sometimes fails in `createBundleReleaseJsAndAssets` or
`packageRelease` on a file lock. Run it once more before debugging.

## 5. Prove each build is the new one

```bash
ls -la --time-style=long-iso <artifact>
```

The timestamp must be after your last source change. A success message is not
evidence; the file's date is.

## 6. What cannot be checked here

No backend runs against the live database from this machine, no email is sent,
no AI provider is called. Say so: `IMPLEMENTED_NOT_LIVE_VERIFIED`, with what
the owner has to set or run for it to become real.

After a change to `robots` / sitemap / metadata, the real-HTTP audit on the
production build (port 3111) is part of the gate — see `hisabche-web`.
