// Brings the owner's hand-picked sound pack (CapCut library, Sounds.zip, Sep 2026) into the
// studio's one sound library. Usage:  node scripts/ingest-user-sounds.mjs <folder-with-the-mp3s>
//
//  · every file is kept as the owner gave it in assets/sfx/user-pack/ (kebab-case name);
//  · the short, single-hit ones are also converted with the SAME trim + fade the rest of the
//    library gets (build-audio-library.mjs) and added to assets/sfx/manifest.json under the
//    existing SoundKind they match — no new kind, no second library;
//  · swells, loops and long textures stay in user-pack/ only: AV SYNC LAW rule 6 forbids them as
//    event sounds. Run the law's test afterwards: it rejects any converted file that breaks it.
// Idempotent: running it twice changes nothing.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const FFMPEG = 'C:\\ffmpeg\\bin\\ffmpeg.exe'
const ROOT = path.resolve('.')
const SFX = path.join(ROOT, 'assets', 'sfx')
const PACK = path.join(SFX, 'user-pack')
const MANIFEST = path.join(SFX, 'manifest.json')

/** Source file -> the SoundKind it serves. Only transients that lead with their first hit. */
const AS_EVENT = {
  'pop.MP3': { kind: 'pop', file: 'user-pop.ogg' },
  'mouse click.MP3': { kind: 'tick', file: 'user-mouse-click.ogg' },
  'Ding.MP3': { kind: 'chime', file: 'user-ding.ogg' },
  'correct answer.MP3': { kind: 'success', file: 'user-correct-answer.ogg' },
  'money payment.MP3': { kind: 'cash', file: 'user-money-payment.ogg' },
  'error.MP3': { kind: 'alert', file: 'user-error.ogg' },
  'glitch.MP3': { kind: 'dataFlow', file: 'user-glitch.ogg' },
  'title swoosh.MP3': { kind: 'whoosh', file: 'user-title-swoosh.ogg' },
}

const from = process.argv[2]
if (!from || !fs.existsSync(from))
  throw new Error('usage: node scripts/ingest-user-sounds.mjs <folder>')

const kebab = (name) =>
  name
    .replace(/\.mp3$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

fs.mkdirSync(PACK, { recursive: true })
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const kept = []
const converted = []

for (const name of fs.readdirSync(from).sort()) {
  if (!/\.mp3$/i.test(name)) continue
  // A commercial recording is not a sound effect and is not ingested here.
  if (/everything in its right place/i.test(name)) continue
  const target = path.join(PACK, kebab(name) + '.mp3')
  fs.copyFileSync(path.join(from, name), target)
  kept.push(path.basename(target))

  const asEvent = AS_EVENT[name]
  if (!asEvent) continue
  const out = path.join(SFX, asEvent.file)
  execFileSync(FFMPEG, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    path.join(from, name),
    '-filter_complex',
    'silenceremove=start_periods=1:start_duration=0.005:start_threshold=-55dB:detection=peak,afade=t=in:ss=0:d=0.005',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'libvorbis',
    '-q:a',
    '5',
    out,
  ])
  const list = manifest[asEvent.kind] ?? []
  if (!list.includes(asEvent.file)) manifest[asEvent.kind] = [...list, asEvent.file]
  converted.push(`${asEvent.kind} <- ${asEvent.file}`)
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`kept ${kept.length} originals in assets/sfx/user-pack/`)
console.log(`converted ${converted.length} into the library:\n  ${converted.join('\n  ')}`)
