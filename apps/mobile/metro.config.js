const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files in monorepo
config.watchFolders = [workspaceRoot]

// Let Metro find modules in root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
]

// Force single instance of these — prevents duplicate React error
config.resolver.extraNodeModules = {
  // ─── Critical: ONE React instance, and it must be THIS app's ──────────
  //
  // ⚠️ NOT the workspace root. Web and desktop are on React 19; React Native
  // 0.74 pins `react: 18.2.0` as a peer and its renderer reaches into
  // `ReactSharedInternals.ReactCurrentDispatcher`, which React 19 REMOVED.
  // Resolving to the root gave a release APK that installed, opened, and died
  // on the first render with:
  //   TypeError: Cannot read property 'ReactCurrentDispatcher' of undefined
  // Nothing catches this at build time — the bundle is valid JavaScript and
  // every test is green; only the device says so.
  react: path.resolve(projectRoot, 'node_modules', 'react'),
  'react-dom': path.resolve(projectRoot, 'node_modules', 'react-dom'),
  'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),

  // ─── Workspace packages ───────────────────────────────
  clsx: path.resolve(workspaceRoot, 'node_modules', 'clsx'),
  'tailwind-merge': path.resolve(workspaceRoot, 'node_modules', 'tailwind-merge'),
  'class-variance-authority': path.resolve(
    workspaceRoot,
    'node_modules',
    'class-variance-authority',
  ),
  'lucide-react': path.resolve(workspaceRoot, 'node_modules', 'lucide-react'),
  i18next: path.resolve(workspaceRoot, 'node_modules', 'i18next'),
  'react-i18next': path.resolve(workspaceRoot, 'node_modules', 'react-i18next'),
  zustand: path.resolve(workspaceRoot, 'node_modules', 'zustand'),

  // ─── Shared message catalogs ──────────────────────────
  // `@hisabche/i18n/messages` is a package `exports` subpath, and Expo SDK 51's
  // Metro has package-exports resolution off by default. Aliasing it keeps the
  // import spelled the same on every platform instead of forcing mobile to
  // reach across the package boundary with a relative path.
  '@hisabche/i18n/messages': path.resolve(workspaceRoot, 'packages', 'i18n', 'src', 'messages.ts'),
}

// ============================================
// ⚠️ `extraNodeModules` IS A FALLBACK, NOT AN ALIAS.
//
// Metro consults it only when normal resolution FAILS. A workspace package
// that declares its own `react` — `@hisabche/ui` and friends are on React 19
// for web — resolves it through pnpm's symlinks and never reaches the map
// above, so a SECOND React was bundled beside React Native's. Verified by
// exporting the bundle and finding `e.version="19.2.6"` inside it.
//
// Two Reacts in one bundle is not a duplicate-work problem, it is a crash:
// React Native's renderer reads `ReactCurrentDispatcher` off the React 18
// internals it was compiled against, and the React 19 copy has no such field.
//
// `resolveRequest` runs FIRST and unconditionally, so it is the only place
// that can make this guarantee. Guard: `single-react-instance.test.ts`.
// ============================================
const FORCED = {
  react: path.resolve(projectRoot, 'node_modules', 'react'),
  'react-dom': path.resolve(projectRoot, 'node_modules', 'react-dom'),
  'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
}

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedRoot = FORCED[moduleName]
  if (forcedRoot) {
    return context.resolveRequest(context, forcedRoot, platform)
  }

  // Subpaths too: `react/jsx-runtime`, `react-dom/client`, … Without this the
  // JSX runtime alone can drag the other copy back in.
  for (const [name, root] of Object.entries(FORCED)) {
    if (moduleName.startsWith(`${name}/`)) {
      return context.resolveRequest(
        context,
        path.join(root, moduleName.slice(name.length + 1)),
        platform,
      )
    }
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
