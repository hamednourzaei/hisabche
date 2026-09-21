import type { Config } from 'tailwindcss'
import baseConfig from '../../packages/ui/tailwind.config'

// Desktop reuses the web design system verbatim; only the content globs differ.
const config: Config = {
  ...baseConfig,
  content: ['../../packages/app-shell/src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
}

export default config
