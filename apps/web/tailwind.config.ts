import type { Config } from 'tailwindcss'
import baseConfig from '../../packages/ui/tailwind.config'

const config: Config = {
  ...baseConfig,
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config