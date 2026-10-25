import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const neutralB64 = fs
  .readFileSync(path.join(ROOT, 'public/avatars/avatar-neutral.png'))
  .toString('base64')
const pointingB64 = fs
  .readFileSync(path.join(ROOT, 'public/avatars/avatar-pointing.png'))
  .toString('base64')
const shrugB64 = fs
  .readFileSync(path.join(ROOT, 'public/avatars/avatar-shrug.png'))
  .toString('base64')

const content = `// Auto-generated Base64 Data URIs for Tech Presenter Avatar
export const AVATAR_NEUTRAL = 'data:image/png;base64,${neutralB64}'
export const AVATAR_POINTING = 'data:image/png;base64,${pointingB64}'
export const AVATAR_SHRUG = 'data:image/png;base64,${shrugB64}'
`

fs.writeFileSync(path.join(ROOT, 'src/ui/avatar-assets.ts'), content, 'utf8')
console.log('✓ src/ui/avatar-assets.ts generated successfully!')
