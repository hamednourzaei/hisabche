// scripts/process-user-avatars.mjs
// Extracts and removes background from user-uploaded avatar poses using floodfill from edges.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(ROOT, 'public', 'avatars')
fs.mkdirSync(outDir, { recursive: true })

const UPLOADS = [
  {
    name: 'avatar-crossed',
    file: 'C:/Users/hamed/.gemini/antigravity/brain/dcd72220-ddde-4cad-9f16-008bac48be04/.user_uploaded/media_1792863949463_c3fe5aef.jpg',
  },
  {
    name: 'avatar-welcome',
    file: 'C:/Users/hamed/.gemini/antigravity/brain/dcd72220-ddde-4cad-9f16-008bac48be04/.user_uploaded/media_1792863971411_ca3b162f.jpg',
  },
  {
    name: 'avatar-pointing',
    file: 'C:/Users/hamed/.gemini/antigravity/brain/dcd72220-ddde-4cad-9f16-008bac48be04/.user_uploaded/media_1792863978578_4aa55424.jpg',
  },
  {
    name: 'avatar-thumbsup',
    file: 'C:/Users/hamed/.gemini/antigravity/brain/dcd72220-ddde-4cad-9f16-008bac48be04/.user_uploaded/media_1792863983818_f03ff2b7.jpg',
  },
  {
    name: 'avatar-shrug',
    file: 'C:/Users/hamed/.gemini/antigravity/brain/dcd72220-ddde-4cad-9f16-008bac48be04/.user_uploaded/media_1792863988342_160b6fed.jpg',
  },
]

for (const item of UPLOADS) {
  console.log(`Processing ${item.name}...`)
  // 1. Get image dimensions via ffprobe
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      item.file,
    ],
    { encoding: 'utf8' },
  )
  const dims = JSON.parse(probe.stdout).streams[0]
  const width = dims.width
  const height = dims.height

  // 2. Decode to raw RGBA
  const dec = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', item.file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'],
    { maxBuffer: 100 * 1024 * 1024 },
  )
  const buf = dec.stdout

  // 3. Flood-fill from outer edges to find background pixels
  // A background pixel has r > 175, g > 175, b > 175 and is connected to border
  const visited = new Uint8Array(width * height)
  const queue = []

  // Add all border pixels that look like background
  function isBgColor(idx) {
    const r = buf[idx]
    const g = buf[idx + 1]
    const b = buf[idx + 2]
    // The background grid is white to light gray: r,g,b are close and > 170
    const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
    const minVal = Math.min(r, g, b)
    return minVal > 170 && diff < 40
  }

  for (let x = 0; x < width; x++) {
    const topIdx = (0 * width + x) * 4
    if (isBgColor(topIdx)) {
      visited[0 * width + x] = 1
      queue.push(x, 0)
    }
    const btmIdx = ((height - 1) * width + x) * 4
    if (isBgColor(btmIdx)) {
      visited[(height - 1) * width + x] = 1
      queue.push(x, height - 1)
    }
  }

  for (let y = 0; y < height; y++) {
    const leftIdx = (y * width + 0) * 4
    if (isBgColor(leftIdx) && !visited[y * width + 0]) {
      visited[y * width + 0] = 1
      queue.push(0, y)
    }
    const rightIdx = (y * width + (width - 1)) * 4
    if (isBgColor(rightIdx) && !visited[y * width + (width - 1)]) {
      visited[y * width + (width - 1)] = 1
      queue.push(width - 1, y)
    }
  }

  let head = 0
  while (head < queue.length) {
    const cx = queue[head++]
    const cy = queue[head++]

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const npos = ny * width + nx
        if (!visited[npos]) {
          const nidx = npos * 4
          if (isBgColor(nidx)) {
            visited[npos] = 1
            queue.push(nx, ny)
          }
        }
      }
    }
  }

  // Set alpha to 0 for all visited background pixels
  for (let i = 0; i < visited.length; i++) {
    if (visited[i]) {
      buf[i * 4 + 3] = 0 // transparent
    }
  }

  // 4. Encode back to PNG via ffmpeg
  const outPng = path.join(outDir, `${item.name}.png`)
  const enc = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-i',
      'pipe:0',
      '-vcodec',
      'png',
      outPng,
    ],
    { input: buf },
  )

  if (enc.status === 0) {
    console.log(`  ✓ Saved ${outPng}`)
  } else {
    console.error(`  ❌ Failed encoding ${item.name}`, enc.stderr?.toString())
  }
}

console.log('✓ All 5 user avatar poses processed!')
