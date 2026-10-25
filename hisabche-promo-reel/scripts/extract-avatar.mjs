import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const videoPath = 'C:\\Users\\hamed\\Music\\test.mp4'
const outDir = path.resolve(ROOT, 'public', 'avatars')
fs.mkdirSync(outDir, { recursive: true })

const poses = [
  { name: 'avatar-neutral', time: '00:00:02.500', crop: 'crop=420:510:150:770' },
  { name: 'avatar-pointing', time: '00:00:06.500', crop: 'crop=420:510:150:770' },
  { name: 'avatar-shrug', time: '00:00:12.500', crop: 'crop=480:510:120:770' },
]

for (const pose of poses) {
  const rawPng = path.join(outDir, `${pose.name}-raw.png`)
  const transPng = path.join(outDir, `${pose.name}.png`)

  console.log(`Extracting ${pose.name}...`)
  spawnSync(
    'ffmpeg',
    ['-y', '-ss', pose.time, '-i', videoPath, '-vf', pose.crop, '-vframes', '1', rawPng],
    { stdio: 'inherit' },
  )

  // Use ffmpeg colorkey or chromakey to make the pure off-white background transparent
  // In test.mp4, background is #ffffff / #fafafa
  console.log(`Transparenting ${pose.name}...`)
  spawnSync('ffmpeg', ['-y', '-i', rawPng, '-vf', 'colorkey=0xfafafa:0.08:0.02', transPng], {
    stdio: 'inherit',
  })
}

console.log('✓ All avatar poses extracted!')
