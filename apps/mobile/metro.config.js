const { getDefaultConfig } = require('expo/metro-config')
const fs = require('fs')
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
// ⚠️ EVERY LIBRARY THAT CARRIES STATE IN A MODULE OR A REACT CONTEXT BELONGS
// HERE, not just React.
//
// pnpm gives each workspace package its own copy of a dependency when the
// peer graph differs — and `packages/api` is built against React 19 for web
// while this app is on React 18, so its `@tanstack/react-query` was a
// DIFFERENT MODULE INSTANCE from the one `QueryProvider` renders. Same class,
// different context object, so on the real device:
//
//   Error: No QueryClient set, use QueryClientProvider to set one
//     at useQueryClient → useRealtime → useDashboardKPIs → DashboardScreen
//
// …even though QueryClientProvider is plainly in the tree above it. The same
// trap applies to `i18next` (the configured instance is module state — a
// second copy is an EMPTY i18n that renders raw keys), `react-i18next` (five
// copies in the store) and `zustand` (three): a second store is a store
// nobody writes to.
const FORCED = {
  react: path.resolve(projectRoot, 'node_modules', 'react'),
  'react-dom': path.resolve(projectRoot, 'node_modules', 'react-dom'),
  'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
  '@tanstack/react-query': path.resolve(projectRoot, 'node_modules', '@tanstack/react-query'),
  i18next: path.resolve(projectRoot, 'node_modules', 'i18next'),
  'react-i18next': path.resolve(projectRoot, 'node_modules', 'react-i18next'),
  zustand: path.resolve(projectRoot, 'node_modules', 'zustand'),
}

// ⚠️ THE LIST ABOVE IS NOT ENOUGH, BECAUSE THE PROBLEM IS pnpm's SHAPE.
//
// pnpm duplicates a package whenever two workspace packages resolve a
// different peer graph, and this monorepo does that everywhere: `packages/api`
// is built against React 19 for web, this app against React 18. A snapshot of
// the store found duplicates of `react-i18next` (5 copies), `expo-router`,
// `react-native-screens`, `react-native-reanimated`, every `expo-*` native
// module, `@tanstack/react-query` and `zustand`.
//
// A bundler cannot tell which duplicates are harmless. A plain React Native
// app never has to: npm/yarn hoist ONE copy of each package and every import
// lands on it. This restores exactly that shape for the bundle — if this app
// declares a package, its copy wins for everybody — instead of patching the
// list one crash at a time.
function packageOf(moduleName) {
  if (moduleName.startsWith('@')) {
    const [scope, name] = moduleName.split('/')
    return name ? `${scope}/${name}` : null
  }
  return moduleName.split('/')[0] ?? null
}

const appModules = path.resolve(projectRoot, 'node_modules')
const ownCopy = new Map()

function appCopyOf(pkg) {
  if (!ownCopy.has(pkg)) {
    const candidate = path.join(appModules, pkg)
    ownCopy.set(pkg, fs.existsSync(candidate) ? candidate : null)
  }
  return ownCopy.get(pkg)
}

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fallback = () =>
    defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform)

  // Relative and absolute requests already point at one file.
  if (moduleName.startsWith('.') || path.isAbsolute(moduleName)) return fallback()

  const pkg = packageOf(moduleName)
  if (!pkg) return fallback()

  // The workspace packages are single by construction — and rewriting them
  // would break the symlink Metro follows to their source.
  if (pkg.startsWith('@hisabche/')) return fallback()

  const root = FORCED[pkg] ?? appCopyOf(pkg)
  if (!root) return fallback()

  const subpath = moduleName.slice(pkg.length + 1)
  const target = subpath ? path.join(root, subpath) : root

  try {
    return context.resolveRequest(context, target, platform)
  } catch {
    // A package whose subpath only resolves through its own `exports` map:
    // let Metro do it the ordinary way rather than fail the build.
    return fallback()
  }
}

module.exports = config
