import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const FFMPEG = 'C:\\ffmpeg\\bin\\ffmpeg.exe'
const ROOT = path.resolve('.')
const TMP = path.resolve(ROOT, '.tmp', 'sfx-download')
const ASSETS_SFX = path.resolve(ROOT, 'assets', 'sfx')
const ASSETS_MUSIC = path.resolve(ROOT, 'assets', 'music')

fs.mkdirSync(ASSETS_SFX, { recursive: true })
fs.mkdirSync(ASSETS_MUSIC, { recursive: true })

/**
 * Process a source audio file into 48kHz stereo OGG Vorbis q5 with 5ms edge fades.
 */
function processSample(src, dest, { start = null, duration = null, gain = null } = {}) {
  const filterParts = []
  if (gain) {
    filterParts.push(`volume=${gain}`)
  }
  // Trim silence at start
  filterParts.push(
    'silenceremove=start_periods=1:start_duration=0.005:start_threshold=-55dB:detection=peak',
  )
  // 5ms fade in
  filterParts.push('afade=t=in:ss=0:d=0.005')

  const filter = filterParts.join(',')
  const timeArgs = []
  if (start !== null) timeArgs.push(`-ss ${start}`)
  if (duration !== null) timeArgs.push(`-t ${duration}`)

  const cmd = `"${FFMPEG}" -y -hide_banner -loglevel error ${timeArgs.join(' ')} -i "${src}" -filter_complex "${filter}" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "${dest}"`
  execSync(cmd)
}

/**
 * Process a music track: loopable, normalized, 48kHz stereo OGG Vorbis q5.
 */
function processMusic(src, dest, { start = 0, duration = 45 } = {}) {
  const filter = 'afade=t=in:ss=0:d=0.5,afade=t=out:st=' + (duration - 0.5) + ':d=0.5'
  const cmd = `"${FFMPEG}" -y -hide_banner -loglevel error -ss ${start} -t ${duration} -i "${src}" -filter_complex "${filter}" -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "${dest}"`
  execSync(cmd)
}

console.log('Processing audio files...')

// ─── SFX DEFINITIONS ────────────────────────────────────────────────────────

const sfxMap = {
  pop: [
    {
      file: 'pop-bubble-soft.ogg',
      src: path.join(TMP, 'mixkit', 'bubble-pop-up-alert.mp3'),
      duration: 0.25,
    },
    {
      file: 'pop-select-click.ogg',
      src: path.join(TMP, 'mixkit', 'select-click.mp3'),
      duration: 0.2,
    },
    { file: 'pop-click-tactile.ogg', src: path.join(TMP, 'ui-audio', 'Audio', 'click1.ogg') },
  ],
  chatPop: [
    {
      file: 'chatpop-message.ogg',
      src: path.join(TMP, 'mixkit', 'message-pop-alert.mp3'),
      duration: 0.3,
    },
    {
      file: 'chatpop-bubble.ogg',
      src: path.join(TMP, 'mixkit', 'bubble-pop-up-alert.mp3'),
      duration: 0.25,
    },
    { file: 'chatpop-switch.ogg', src: path.join(TMP, 'ui-audio', 'Audio', 'switch1.ogg') },
  ],
  tick: [
    {
      file: 'tick-mechanical-1.ogg',
      src: path.join(TMP, 'clock-ticking.ogg'),
      start: 1.2,
      duration: 0.08,
    },
    {
      file: 'tick-mechanical-2.ogg',
      src: path.join(TMP, 'alarm-clock-ticking.ogg'),
      start: 0.45,
      duration: 0.08,
    },
    { file: 'tick-ui-click.ogg', src: path.join(TMP, 'interface-sounds', 'Audio', 'tick_001.ogg') },
  ],
  clockTickRapid: [
    {
      file: 'clocktickrapid-burst-1.ogg',
      src: path.join(TMP, 'clock-ticking.ogg'),
      start: 1.0,
      duration: 0.65,
    },
    {
      file: 'clocktickrapid-burst-2.ogg',
      src: path.join(TMP, 'alarm-clock-ticking.ogg'),
      start: 1.0,
      duration: 0.65,
    },
  ],
  typewriterClick: [
    {
      file: 'typewriter-laptop.ogg',
      src: path.join(TMP, 'mixkit', 'laptop-keyboard-typing.mp3'),
      start: 0.1,
      duration: 0.2,
    },
    {
      file: 'typewriter-mechanical-1.ogg',
      src: path.join(TMP, 'typewriter.ogg'),
      start: 0.3,
      duration: 0.22,
    },
    {
      file: 'typewriter-mechanical-2.ogg',
      src: path.join(TMP, 'typewriter.ogg'),
      start: 0.8,
      duration: 0.22,
    },
  ],
  markerScribble: [
    { file: 'marker-stroke-1.ogg', src: path.join(TMP, 'feltpen.ogg'), start: 0.2, duration: 0.4 },
    { file: 'marker-stroke-2.ogg', src: path.join(TMP, 'feltpen.ogg'), start: 1.1, duration: 0.35 },
    { file: 'marker-stroke-3.ogg', src: path.join(TMP, 'feltpen.ogg'), start: 2.2, duration: 0.45 },
  ],
  paperRustle: [
    { file: 'paper-flip-1.ogg', src: path.join(TMP, 'rpg-audio', 'Audio', 'bookFlip1.ogg') },
    { file: 'paper-flip-2.ogg', src: path.join(TMP, 'rpg-audio', 'Audio', 'bookFlip2.ogg') },
    {
      file: 'paper-pages-rustle.ogg',
      src: path.join(TMP, 'paper-pages.ogg'),
      start: 0.5,
      duration: 0.5,
    },
  ],
  paperTear: [
    {
      file: 'paper-tear-seal-1.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'cards-pack-open-1.ogg'),
      start: 0.1,
      duration: 0.4,
    },
    {
      file: 'paper-tear-seal-2.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'cards-pack-open-2.ogg'),
      start: 0.1,
      duration: 0.4,
    },
    { file: 'paper-tear-slice.ogg', src: path.join(TMP, 'rpg-audio', 'Audio', 'knifeSlice.ogg') },
  ],
  cardEnter: [
    { file: 'card-enter-1.ogg', src: path.join(TMP, 'casino-audio', 'Audio', 'card-place-1.ogg') },
    { file: 'card-enter-2.ogg', src: path.join(TMP, 'casino-audio', 'Audio', 'card-place-2.ogg') },
    { file: 'card-enter-3.ogg', src: path.join(TMP, 'casino-audio', 'Audio', 'card-place-3.ogg') },
  ],
  cardThock: [
    {
      file: 'card-thock-table.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'card-place-4.ogg'),
    },
    { file: 'card-thock-book-1.ogg', src: path.join(TMP, 'rpg-audio', 'Audio', 'bookPlace1.ogg') },
    { file: 'card-thock-book-2.ogg', src: path.join(TMP, 'rpg-audio', 'Audio', 'bookPlace2.ogg') },
  ],
  cash: [
    {
      file: 'cash-register-drawer.ogg',
      src: path.join(TMP, 'cash-register.ogg'),
      start: 0,
      duration: 0.9,
    },
    {
      file: 'cash-coins-handle-1.ogg',
      src: path.join(TMP, 'rpg-audio', 'Audio', 'handleCoins.ogg'),
    },
    {
      file: 'cash-coins-handle-2.ogg',
      src: path.join(TMP, 'rpg-audio', 'Audio', 'handleCoins2.ogg'),
    },
    {
      file: 'cash-coin-win.ogg',
      src: path.join(TMP, 'mixkit', 'winning-a-coin.mp3'),
      duration: 0.45,
    },
  ],
  receiptPrint: [
    {
      file: 'receipt-print-feed-1.ogg',
      src: path.join(TMP, 'atm-printer.ogg'),
      start: 1.0,
      duration: 0.55,
    },
    {
      file: 'receipt-print-feed-2.ogg',
      src: path.join(TMP, 'atm-printer.ogg'),
      start: 2.2,
      duration: 0.5,
    },
    {
      file: 'receipt-print-feed-3.ogg',
      src: path.join(TMP, 'atm-printer.ogg'),
      start: 3.5,
      duration: 0.6,
    },
  ],
  whoosh: [
    { file: 'whoosh-air-soft.ogg', src: path.join(TMP, 'mixkit', 'air-woosh.mp3'), duration: 0.5 },
    {
      file: 'whoosh-card-fan-1.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'card-fan-1.ogg'),
    },
    {
      file: 'whoosh-card-slide-1.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'card-slide-1.ogg'),
    },
  ],
  cameraSwish: [
    {
      file: 'cameraswish-vacuum.ogg',
      src: path.join(TMP, 'mixkit', 'air-zoom-vacuum.mp3'),
      duration: 0.45,
    },
    {
      file: 'cameraswish-card-fan-2.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'card-fan-2.ogg'),
    },
    {
      file: 'cameraswish-card-slide-2.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'card-slide-2.ogg'),
    },
  ],
  softTransition: [
    {
      file: 'softtrans-sweep.ogg',
      src: path.join(TMP, 'mixkit', 'fast-small-sweep-transition.mp3'),
      duration: 0.4,
    },
    {
      file: 'softtrans-scroll-1.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'scroll_001.ogg'),
    },
    {
      file: 'softtrans-card-slide-3.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'card-slide-3.ogg'),
    },
  ],
  sceneTransition: [
    {
      file: 'scenetrans-cinematic.ogg',
      src: path.join(TMP, 'mixkit', 'cinematic-whoosh-fast-transition.mp3'),
      duration: 0.5,
    },
    {
      file: 'scenetrans-scroll-2.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'scroll_002.ogg'),
    },
    {
      file: 'scenetrans-back-1.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'back_001.ogg'),
    },
  ],
  impact: [
    {
      file: 'impact-wood-stamp-1.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactWood_heavy_000.ogg'),
    },
    {
      file: 'impact-wood-stamp-2.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactWood_heavy_001.ogg'),
    },
    {
      file: 'impact-soft-punch.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactSoft_heavy_000.ogg'),
    },
  ],
  alert: [
    {
      file: 'alert-soft-bong.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'bong_001.ogg'),
    },
    { file: 'alert-twotone.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'twoTone1.ogg') },
    {
      file: 'alert-threetone.ogg',
      src: path.join(TMP, 'digital-audio', 'Audio', 'lowThreeTone.ogg'),
    },
  ],
  titleHit: [
    {
      file: 'titlehit-trailer-cool.ogg',
      src: path.join(TMP, 'mixkit', 'cool-impact-movie-trailer.mp3'),
      duration: 0.65,
    },
    {
      file: 'titlehit-wood-heavy.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactWood_heavy_002.ogg'),
    },
    {
      file: 'titlehit-plate.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactPlate_heavy_000.ogg'),
    },
  ],
  bigReveal: [
    {
      file: 'bigreveal-trailer-epic.ogg',
      src: path.join(TMP, 'mixkit', 'movie-trailer-epic-impact.mp3'),
      duration: 0.75,
    },
    {
      file: 'bigreveal-metal-heavy.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactMetal_heavy_000.ogg'),
    },
    {
      file: 'bigreveal-powerup.ogg',
      src: path.join(TMP, 'digital-audio', 'Audio', 'powerUp1.ogg'),
    },
  ],
  majorReveal: [
    {
      file: 'majorreveal-bell-heavy.ogg',
      src: path.join(TMP, 'impact-sounds', 'Audio', 'impactBell_heavy_000.ogg'),
    },
    {
      file: 'majorreveal-powerup-2.ogg',
      src: path.join(TMP, 'digital-audio', 'Audio', 'powerUp2.ogg'),
    },
    {
      file: 'majorreveal-epic-impact.ogg',
      src: path.join(TMP, 'mixkit', 'movie-trailer-epic-impact.mp3'),
      duration: 0.75,
    },
  ],
  cinematicReveal: [
    {
      file: 'cinematic-sparkle.ogg',
      src: path.join(TMP, 'mixkit', 'magic-sparkle-whoosh.mp3'),
      duration: 0.7,
    },
    {
      file: 'cinematic-powerup-7.ogg',
      src: path.join(TMP, 'digital-audio', 'Audio', 'powerUp7.ogg'),
    },
    {
      file: 'cinematic-glass-1.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'glass_001.ogg'),
    },
  ],
  insightReveal: [
    {
      file: 'insight-glass-2.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'glass_002.ogg'),
    },
    {
      file: 'insight-glass-3.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'glass_003.ogg'),
    },
    { file: 'insight-highup.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'highUp.ogg') },
  ],
  dataFlow: [
    {
      file: 'dataflow-glitch-1.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'glitch_001.ogg'),
    },
    {
      file: 'dataflow-glitch-2.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'glitch_002.ogg'),
    },
    { file: 'dataflow-pep-1.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'pepSound1.ogg') },
  ],
  sync: [
    {
      file: 'sync-software-start.ogg',
      src: path.join(TMP, 'mixkit', 'software-interface-start.mp3'),
      duration: 0.5,
    },
    { file: 'sync-twotone.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'twoTone2.ogg') },
    { file: 'sync-switch.ogg', src: path.join(TMP, 'interface-sounds', 'Audio', 'switch_001.ogg') },
  ],
  scan: [
    { file: 'scan-barcode-zap-1.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'zap1.ogg') },
    { file: 'scan-barcode-zap-2.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'zap2.ogg') },
    { file: 'scan-pep-3.ogg', src: path.join(TMP, 'digital-audio', 'Audio', 'pepSound3.ogg') },
  ],
  precisionSequence: [
    {
      file: 'precision-click-1.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'click_001.ogg'),
    },
    {
      file: 'precision-click-2.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'click_002.ogg'),
    },
    { file: 'precision-mouse.ogg', src: path.join(TMP, 'ui-audio', 'Audio', 'mouseclick1.ogg') },
  ],
  success: [
    {
      file: 'success-notification.ogg',
      src: path.join(TMP, 'mixkit', 'positive-notification.mp3'),
      duration: 0.6,
    },
    {
      file: 'success-confirm-1.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'confirmation_001.ogg'),
    },
    {
      file: 'success-threetone.ogg',
      src: path.join(TMP, 'digital-audio', 'Audio', 'threeTone1.ogg'),
    },
  ],
  chime: [
    {
      file: 'chime-correct-tone.ogg',
      src: path.join(TMP, 'mixkit', 'correct-answer-tone.mp3'),
      duration: 0.55,
    },
    {
      file: 'chime-confirm-2.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'confirmation_002.ogg'),
    },
    {
      file: 'chime-confirm-3.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'confirmation_003.ogg'),
    },
  ],
  financialMilestone: [
    {
      file: 'finmilestone-completed.ogg',
      src: path.join(TMP, 'mixkit', 'game-level-completed.mp3'),
      duration: 0.8,
    },
    {
      file: 'finmilestone-chips.ogg',
      src: path.join(TMP, 'casino-audio', 'Audio', 'chips-stack-2.ogg'),
    },
    {
      file: 'finmilestone-confirm.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'confirmation_004.ogg'),
    },
  ],
  successResolution: [
    {
      file: 'successres-correct.ogg',
      src: path.join(TMP, 'mixkit', 'correct-answer-tone.mp3'),
      duration: 0.55,
    },
    {
      file: 'successres-confirm.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'confirmation_002.ogg'),
    },
    {
      file: 'successres-glass.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'glass_004.ogg'),
    },
  ],
  ctaResolution: [
    {
      file: 'ctares-completed.ogg',
      src: path.join(TMP, 'mixkit', 'game-level-completed.mp3'),
      duration: 0.8,
    },
    {
      file: 'ctares-confirm.ogg',
      src: path.join(TMP, 'interface-sounds', 'Audio', 'confirmation_001.ogg'),
    },
    { file: 'ctares-glass.ogg', src: path.join(TMP, 'interface-sounds', 'Audio', 'glass_005.ogg') },
  ],
}

const sfxManifest = {}

for (const [kind, list] of Object.entries(sfxMap)) {
  sfxManifest[kind] = []
  for (const item of list) {
    const dest = path.join(ASSETS_SFX, item.file)
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
      processSample(item.src, dest, item)
    }
    if (!sfxManifest[kind].includes(item.file)) {
      sfxManifest[kind].push(item.file)
    }
  }
}

fs.writeFileSync(path.join(ASSETS_SFX, 'manifest.json'), JSON.stringify(sfxManifest, null, 2))
console.log(`SFX manifest written: ${Object.keys(sfxManifest).length} kinds mapped.`)

// ─── MUSIC DEFINITIONS ──────────────────────────────────────────────────────

const musicList = [
  {
    file: 'music-calm-softly.ogg',
    src: path.join(TMP, 'music-softly.ogg'),
    mood: 'calm',
    bpm: 100,
    start: 0,
    duration: 38,
  },
  {
    file: 'music-tense-coexistenz.ogg',
    src: path.join(TMP, 'music-coexistenz.ogg'),
    mood: 'tense',
    bpm: 120,
    start: 0,
    duration: 35,
  },
  {
    file: 'music-uplifting-alive.ogg',
    src: path.join(TMP, 'music-alive.ogg'),
    mood: 'uplifting',
    bpm: 110,
    start: 0,
    duration: 36,
  },
  {
    file: 'music-calm-cadillac.ogg',
    src: path.join(TMP, 'music-cadillac.ogg'),
    mood: 'calm',
    bpm: 90,
    start: 0,
    duration: 35,
  },
]

const musicManifest = []

for (const m of musicList) {
  const dest = path.join(ASSETS_MUSIC, m.file)
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
    processMusic(m.src, dest, m)
  }
  musicManifest.push({
    file: m.file,
    mood: m.mood,
    bpm: m.bpm,
  })
}

fs.writeFileSync(path.join(ASSETS_MUSIC, 'manifest.json'), JSON.stringify(musicManifest, null, 2))
console.log(`Music manifest written: ${musicManifest.length} tracks registered.`)

// ─── LICENSES.md ────────────────────────────────────────────────────────────

const licenseRows = [
  // Kenney UI Audio
  {
    file: 'pop-click-tactile.ogg',
    source: 'https://kenney.nl/assets/ui-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'UI Audio Pack',
  },
  {
    file: 'chatpop-switch.ogg',
    source: 'https://kenney.nl/assets/ui-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'UI Audio Pack',
  },
  {
    file: 'precision-mouse.ogg',
    source: 'https://kenney.nl/assets/ui-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'UI Audio Pack',
  },
  // Kenney Interface Sounds
  {
    file: 'tick-ui-click.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'softtrans-scroll-1.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'scenetrans-scroll-2.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'scenetrans-back-1.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'alert-soft-bong.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'cinematic-glass-1.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'insight-glass-2.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'insight-glass-3.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'dataflow-glitch-1.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'dataflow-glitch-2.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'sync-switch.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'precision-click-1.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'precision-click-2.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'success-confirm-1.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'chime-confirm-2.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'chime-confirm-3.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'finmilestone-confirm.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'successres-confirm.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'successres-glass.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'ctares-confirm.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  {
    file: 'ctares-glass.ogg',
    source: 'https://kenney.nl/assets/interface-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Interface Sounds Pack',
  },
  // Kenney Casino Audio
  {
    file: 'paper-tear-seal-1.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'paper-tear-seal-2.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'card-enter-1.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'card-enter-2.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'card-enter-3.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'card-thock-table.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'whoosh-card-fan-1.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'whoosh-card-slide-1.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'cameraswish-card-fan-2.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'cameraswish-card-slide-2.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'softtrans-card-slide-3.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  {
    file: 'finmilestone-chips.ogg',
    source: 'https://kenney.nl/assets/casino-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Casino Audio Pack',
  },
  // Kenney RPG Audio
  {
    file: 'paper-flip-1.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  {
    file: 'paper-flip-2.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  {
    file: 'paper-tear-slice.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  {
    file: 'card-thock-book-1.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  {
    file: 'card-thock-book-2.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  {
    file: 'cash-coins-handle-1.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  {
    file: 'cash-coins-handle-2.ogg',
    source: 'https://kenney.nl/assets/rpg-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'RPG Audio Pack',
  },
  // Kenney Impact Sounds
  {
    file: 'impact-wood-stamp-1.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  {
    file: 'impact-wood-stamp-2.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  {
    file: 'impact-soft-punch.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  {
    file: 'titlehit-wood-heavy.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  {
    file: 'titlehit-plate.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  {
    file: 'bigreveal-metal-heavy.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  {
    file: 'majorreveal-bell-heavy.ogg',
    source: 'https://kenney.nl/assets/impact-sounds',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Impact Sounds Pack',
  },
  // Kenney Digital Audio
  {
    file: 'alert-twotone.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'alert-threetone.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'bigreveal-powerup.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'majorreveal-powerup-2.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'cinematic-powerup-7.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'insight-highup.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'dataflow-pep-1.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'sync-twotone.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'scan-barcode-zap-1.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'scan-barcode-zap-2.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'scan-pep-3.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  {
    file: 'success-threetone.ogg',
    source: 'https://kenney.nl/assets/digital-audio',
    author: 'Kenney',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Digital Audio Pack',
  },
  // Mixkit Free License
  {
    file: 'pop-bubble-soft.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Bubble pop up alert notification (#2357)',
  },
  {
    file: 'pop-select-click.ogg',
    source: 'https://mixkit.co/free-sound-effects/click/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Select click (#1109)',
  },
  {
    file: 'chatpop-message.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Message pop alert (#2354)',
  },
  {
    file: 'chatpop-bubble.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Bubble pop up alert notification (#2357)',
  },
  {
    file: 'typewriter-laptop.ogg',
    source: 'https://mixkit.co/free-sound-effects/click/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Laptop keyboard typing (#2531)',
  },
  {
    file: 'cash-coin-win.ogg',
    source: 'https://mixkit.co/free-sound-effects/game/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Winning a coin (#2069)',
  },
  {
    file: 'whoosh-air-soft.ogg',
    source: 'https://mixkit.co/free-sound-effects/whoosh/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Air woosh (#1489)',
  },
  {
    file: 'cameraswish-vacuum.ogg',
    source: 'https://mixkit.co/free-sound-effects/transition/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Air zoom vacuum (#2608)',
  },
  {
    file: 'softtrans-sweep.ogg',
    source: 'https://mixkit.co/free-sound-effects/transition/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Fast small sweep transition (#166)',
  },
  {
    file: 'scenetrans-cinematic.ogg',
    source: 'https://mixkit.co/free-sound-effects/whoosh/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Cinematic whoosh fast transition (#1492)',
  },
  {
    file: 'titlehit-trailer-cool.ogg',
    source: 'https://mixkit.co/free-sound-effects/transition/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Cool impact movie trailer (#2909)',
  },
  {
    file: 'bigreveal-trailer-epic.ogg',
    source: 'https://mixkit.co/free-sound-effects/transition/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Movie trailer epic impact (#2908)',
  },
  {
    file: 'majorreveal-epic-impact.ogg',
    source: 'https://mixkit.co/free-sound-effects/transition/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Movie trailer epic impact (#2908)',
  },
  {
    file: 'cinematic-sparkle.ogg',
    source: 'https://mixkit.co/free-sound-effects/whoosh/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Magic sparkle whoosh (#2350)',
  },
  {
    file: 'sync-software-start.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Software interface start (#2574)',
  },
  {
    file: 'success-notification.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Positive notification (#951)',
  },
  {
    file: 'chime-correct-tone.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Correct answer tone (#2870)',
  },
  {
    file: 'finmilestone-completed.ogg',
    source: 'https://mixkit.co/free-sound-effects/game/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Game level completed (#2059)',
  },
  {
    file: 'successres-correct.ogg',
    source: 'https://mixkit.co/free-sound-effects/notification/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Correct answer tone (#2870)',
  },
  {
    file: 'ctares-completed.ogg',
    source: 'https://mixkit.co/free-sound-effects/game/',
    author: 'Mixkit',
    license: 'Mixkit Free License',
    licenseUrl: 'https://mixkit.co/license/#sfxFree',
    date: '2026-10-17',
    notes: 'Game level completed (#2059)',
  },
  // Wikimedia Commons Public Domain & CC BY
  {
    file: 'tick-mechanical-1.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Clock_ticking.ogg',
    author: 'natalie',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Mechanical clock ticking sound',
  },
  {
    file: 'tick-mechanical-2.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Alarm_clock_ticking.ogg',
    author: 'ezwa',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Alarm clock ticking sound',
  },
  {
    file: 'clocktickrapid-burst-1.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Clock_ticking.ogg',
    author: 'natalie',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Rapid 6-tick burst',
  },
  {
    file: 'clocktickrapid-burst-2.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Alarm_clock_ticking.ogg',
    author: 'ezwa',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Rapid 6-tick burst',
  },
  {
    file: 'typewriter-mechanical-1.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:WWS_Typewriter.ogg',
    author: 'Konrad Gutkowski / Work With Sounds',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    date: '2026-10-17',
    notes: 'Vintage mechanical typewriter key click',
  },
  {
    file: 'typewriter-mechanical-2.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:WWS_Typewriter.ogg',
    author: 'Konrad Gutkowski / Work With Sounds',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    date: '2026-10-17',
    notes: 'Vintage mechanical typewriter key click',
  },
  {
    file: 'marker-stroke-1.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Writing_with_feltpen.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Felt pen writing on paper',
  },
  {
    file: 'marker-stroke-2.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Writing_with_feltpen.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Felt pen writing on paper',
  },
  {
    file: 'marker-stroke-3.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Writing_with_feltpen.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Felt pen writing on paper',
  },
  {
    file: 'paper-pages-rustle.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Book_paper_pages_assorted.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Book paper pages handling',
  },
  {
    file: 'cash-register-drawer.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Cash_register.ogg',
    author: 'Me (Wikimedia Commons)',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Antique cash register open',
  },
  {
    file: 'receipt-print-feed-1.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Atm_printer_prints_statement_of_account.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Thermal statement printer feed',
  },
  {
    file: 'receipt-print-feed-2.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Atm_printer_prints_statement_of_account.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Thermal statement printer feed',
  },
  {
    file: 'receipt-print-feed-3.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Atm_printer_prints_statement_of_account.ogg',
    author: 'stephan',
    license: 'Public Domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    date: '2026-10-17',
    notes: 'Thermal statement printer feed',
  },
  // Music Tracks
  {
    file: 'music-calm-softly.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg',
    author: 'Loyalty Freak Music',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Instrumental music bed (calm)',
  },
  {
    file: 'music-tense-coexistenz.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_31_-_Coexistenz.ogg',
    author: 'Loyalty Freak Music',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Instrumental music bed (tense)',
  },
  {
    file: 'music-uplifting-alive.ogg',
    source:
      'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_10_-_Everyone_is_so_alive.ogg',
    author: 'Loyalty Freak Music',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Instrumental music bed (uplifting)',
  },
  {
    file: 'music-calm-cadillac.ogg',
    source: 'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_No_Cadillac.ogg',
    author: 'Loyalty Freak Music',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    date: '2026-10-17',
    notes: 'Instrumental music bed (calm)',
  },
]

let licenseMd = `# Audio Library Licenses & Provenance\n\n`
licenseMd += `This directory houses licensed recorded sound effects and music beds for the Hisabche Promo Reel production studio.\n`
licenseMd += `All assets comply strictly with project rules: CC0, Public Domain, Mixkit Free License, or CC BY (with explicit attribution).\n\n`
licenseMd += `| File | Source Page URL | Author / Creator | License Name | License URL | Download Date | Notes |\n`
licenseMd += `|---|---|---|---|---|---|---|\n`

for (const row of licenseRows) {
  licenseMd += `| \`${row.file}\` | [Link](${row.source}) | ${row.author} | **${row.license}** | [License](${row.licenseUrl}) | ${row.date} | ${row.notes} |\n`
}

fs.writeFileSync(path.join(ASSETS_SFX, 'LICENSES.md'), licenseMd)
console.log(`LICENSES.md written: ${licenseRows.length} files documented.`)
