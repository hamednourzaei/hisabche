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
  // ─── Critical: ONE React instance only ───────────────
  react: path.resolve(workspaceRoot, 'node_modules', 'react'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules', 'react-dom'),
  'react-native': path.resolve(workspaceRoot, 'node_modules', 'react-native'),

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

module.exports = config
