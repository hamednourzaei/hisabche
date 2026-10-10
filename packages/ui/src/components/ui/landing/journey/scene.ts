// packages/ui/src/components/ui/landing/journey/scene.ts
//
// The journey of one invoice, inside a shop hall.
//
// A printer prints it. A robot carries it down the hall, through a gate that
// opens for it, to a station: payment terminal, cash register, stock rack,
// ledger, report desk. The sheet feeds into the machine, the station's board
// fills with that sale's own figures, the clerk looks up — and the sheet comes
// back out with one more mark and moves on. Past the last station is the core.
//
// What makes it read as a place rather than a diagram:
//   • it is a ROOM: four walls, a ceiling of light panels, a tiled floor;
//   • the sheet is CLIPPED at the slot, so it goes into the machine instead of
//     shrinking in mid-air;
//   • every board shows figures derived from one sale (`journey-screens.ts`) —
//     no screen is a flat colour;
//   • the camera has an authored shot per station (`journey-shots.ts`) and
//     composes it in the part of the frame the page's text leaves free;
//   • nothing follows the scroll wheel directly. The story position and the
//     camera both ease toward where the page is, so a wheel step is a glide.
//
// WHERE the story is comes from one place, `journey-machine.ts`. This file only
// reads that snapshot and interpolates; it keeps no timeline of its own (the
// loading dock is the one exception, and says why).
//
// Per frame: no object is created, no canvas is repainted. A board repaints
// only when what it shows changes.

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import type { SceneSetup } from '../three/scene-canvas'
import {
  ARRIVE_AT,
  BURST_AT,
  ENTER_AT,
  FINALE_AT,
  GATE_AT,
  JOURNEY_STATIONS,
  LEAVE_AT,
  RECORDED_AT,
  journeyInto,
  newJourneySnapshot,
} from './journey-machine'
import type { ScreenModel } from './journey-screens'
import {
  MAX_DISTANCE,
  OPENING_SHOT,
  STATION_GAP,
  STATION_SHOTS,
  eyeOffset,
  fitDistance,
  hallSize,
  shotPose,
  type CameraPose,
  type Offset,
} from './journey-shots'
import { journeyState, type InvoiceLabels } from './journey-state'

const GAP = STATION_GAP
const HOVER = 3.1
const SHEET_HALF = 1.03
const MACHINE_SLOT = 1.16
const PRINTER_SLOT = 1.32
const FAR_BELOW = -100
/** Four tiles of the floor texture cover this much floor. */
const TILE_SPAN = 3.4

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const css = (color: THREE.Color) => `#${color.getHexString()}`

/** A canvas painted once and used as a texture. */
function painted(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

interface BoardPalette {
  ground: string
  ink: string
  faint: string
  accent: string
  good: string
  warn: string
}

/** What a board is doing: nothing yet, next in line, taking the sale in, done. */
type BoardState = 'idle' | 'next' | 'working' | 'done'

/**
 * A station's board: its title, the sale's figures row by row, and a closing
 * line. Rows not yet reached are drawn as faint blanks, so a waiting board is
 * visibly a board and not a coloured rectangle.
 */
function paintBoard(
  ctx: CanvasRenderingContext2D,
  model: ScreenModel,
  shown: number,
  state: BoardState,
  recorded: string,
  palette: BoardPalette,
) {
  const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
  const family = getComputedStyle(document.body).fontFamily
  const near = rtl ? 484 : 28
  const far = rtl ? 28 : 484
  const middle = rtl ? 196 : 316
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = 1
  ctx.fillStyle = palette.ground
  ctx.fillRect(0, 0, 512, 320)
  ctx.strokeStyle = palette.faint
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.5
  ctx.strokeRect(7, 7, 498, 306)
  ctx.globalAlpha = 1

  const write = (
    text: string,
    x: number,
    y: number,
    size: number,
    bold: boolean,
    color: string,
    end = false,
  ) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${family}`
    ctx.fillStyle = color
    ctx.textAlign = end ? 'end' : 'start'
    ctx.fillText(text, x, y)
  }
  /** A bar that starts at `x` and runs `width` in the reading direction. */
  const bar = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(rtl ? x - width : x, y, width, height)
  }
  const toneColor = (tone: ScreenModel['rows'][number]['tone']) =>
    tone === 'good' ? palette.good : tone === 'warn' ? palette.warn : palette.ink

  const lead = state === 'done' ? palette.good : state === 'idle' ? palette.faint : palette.accent
  write(model.title, near, 50, 30, true, palette.ink)
  write(state === 'done' ? recorded : model.note, far, 46, 18, state === 'done', lead, true)
  ctx.fillStyle = lead
  ctx.fillRect(28, 64, 456, 3)

  if (model.columns) {
    write(model.columns[0], middle, 92, 16, false, palette.faint, true)
    write(model.columns[1], far, 92, 16, false, palette.faint, true)
  }
  const first = model.columns ? 130 : 112
  const step = model.rows.length > 3 ? 44 : 52
  model.rows.forEach((row, index) => {
    const y = first + index * step
    if (index >= shown) {
      ctx.globalAlpha = 0.3
      bar(near, y - 14, 130 - index * 14, 12, palette.faint)
      ctx.fillStyle = palette.faint
      ctx.fillRect(rtl ? far : far - 96, y - 14, 96, 12)
      ctx.globalAlpha = 1
      return
    }
    write(row.label, near, y, 21, false, palette.ink)
    const tone = toneColor(row.tone)
    if (model.columns) {
      write(row.value, middle, y, 22, true, tone, true)
      write(row.extra, far, y, 22, true, tone, true)
    } else {
      write(row.value, far, y, row.strong ? 25 : 22, row.strong, tone, true)
    }
    if (row.share > 0) {
      ctx.globalAlpha = 0.25
      ctx.fillStyle = palette.faint
      ctx.fillRect(28, y + 9, 456, 4)
      ctx.globalAlpha = 1
      const width = 456 * Math.min(1, row.share)
      ctx.fillStyle = tone
      ctx.fillRect(rtl ? 484 - width : 28, y + 9, width, 4)
    }
  })

  if (state === 'done') write(`✓ ${model.foot}`, near, 298, 19, true, palette.good)
  else write(model.waiting, near, 298, 17, false, palette.faint)
}

function drawInvoice(
  labels: InvoiceLabels,
  paper: string,
  ink: string,
  faint: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 704
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const paint = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
    const family = getComputedStyle(document.body).fontFamily
    const near = rtl ? 472 : 40
    const far = rtl ? 40 : 472
    ctx.direction = rtl ? 'rtl' : 'ltr'
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, 512, 704)

    const write = (
      text: string,
      x: number,
      y: number,
      size: number,
      bold: boolean,
      color: string,
      end = false,
    ) => {
      ctx.font = `${bold ? 700 : 400} ${size}px ${family}`
      ctx.fillStyle = color
      ctx.textAlign = end ? 'end' : 'start'
      ctx.fillText(text, x, y)
    }
    const rule = (y: number, width: number) => {
      ctx.fillStyle = ink
      ctx.fillRect(40, y, 432, width)
    }
    // A blank where a real invoice has a name or a figure: this is a sample.
    const blank = (x: number, y: number, width: number) => {
      ctx.fillStyle = faint
      ctx.fillRect(rtl ? x - width : x, y - 12, width, 12)
    }

    write(labels.brand, near, 78, 40, true, ink)
    write(labels.sample, far, 70, 20, false, faint, true)
    write(labels.title, near, 118, 24, false, ink)
    rule(138, 4)

    const meta: [string, number][] = [
      [labels.number, 110],
      [labels.date, 90],
      [labels.customer, 150],
    ]
    meta.forEach(([name, width], row) => {
      const y = 180 + row * 36
      write(name, near, y, 20, false, ink)
      blank(far + (rtl ? width : -width), y, width)
    })
    rule(270, 2)

    write(labels.items, near, 304, 19, true, ink)
    write(labels.quantity, rtl ? 250 : 262, 304, 19, true, ink)
    write(labels.unitPrice, far, 304, 19, true, ink, true)
    rule(318, 1)
    for (let row = 0; row < 3; row++) {
      const y = 356 + row * 40
      blank(near, y, 150 - row * 26)
      blank(rtl ? 250 : 262, y, 30)
      blank(far + (rtl ? 80 : -80), y, 80)
    }
    rule(456, 1)

    const sums = [labels.subtotal, labels.discount, labels.tax]
    sums.forEach((name, row) => {
      const y = 494 + row * 34
      write(name, near, y, 19, false, ink)
      blank(far + (rtl ? 90 : -90), y, 90)
    })
    rule(580, 4)
    write(labels.total, near, 634, 28, true, ink)
    write(labels.amount, far, 634, 30, true, ink, true)
    texture.needsUpdate = true
  }

  paint()
  // The page font may arrive after the scene; print the invoice again in it.
  void document.fonts?.ready.then(paint)
  return texture
}

const setup: SceneSetup = (runtime) => {
  const { scene, camera, renderer } = runtime
  renderer.localClippingEnabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3
  // The page shows the clerk's line in its caption until a scene is there to
  // hold the bubble over the clerk's head.
  journeyState.bubble?.parentElement?.setAttribute('data-scene', 'on')
  camera.near = 0.3
  camera.updateProjectionMatrix()

  const base = runtime.color('--surface-base')
  const light = runtime.color('--fg-primary')
  const line = runtime.color('--border-strong')
  const busy = runtime.color('--color-primary')
  const done = runtime.color('--color-success')
  const warm = runtime.color('--color-warning')
  const alert = runtime.color('--color-destructive')
  // Greys taken between the page's own background and text colours, so the
  // hall belongs to the theme it is drawn on.
  const body = base.clone().lerp(light, 0.34)
  const dark = base.clone().lerp(light, 0.12)
  const trim = base.clone().lerp(light, 0.62)
  const deep = base.clone().lerp(light, 0.05)
  // Lamps are the lighter of the two page colours, whichever theme is on.
  const lightIsPaper = light.getHSL({ h: 0, s: 0, l: 0 }).l > base.getHSL({ h: 0, s: 0, l: 0 }).l
  const lamp = lightIsPaper ? light : base

  const mobile = runtime.mode === 'mobile'
  const stations = journeyState.stations
  // A phone's frame is narrow: the machines stand closer to the middle of the road.
  const side = mobile ? 1.1 : 2.4
  // The hall is laid out in the reading direction: mirrored on a right-to-left page.
  const flow = getComputedStyle(document.documentElement).direction === 'rtl' ? -1 : 1
  const hall = hallSize(stations, side)
  const length = hall.front - hall.back
  const centre = (hall.front + hall.back) / 2

  // ── Light ──
  // A dim base, one key, a pool that follows the station being worked at, and
  // a rim on the agent. Ceiling panels and screens light themselves.
  scene.fog = new THREE.Fog(base, mobile ? 28 : 24, 82)
  scene.add(new THREE.HemisphereLight(lamp, dark, 0.8))
  const key = new THREE.DirectionalLight(lamp, 1)
  key.position.set(5 * flow, 9, 7)
  scene.add(key)
  const pool = new THREE.SpotLight(lamp, 3.4, 44, 0.6, 0.8, 0)
  pool.position.set(0, hall.height - 0.6, 3)
  scene.add(pool, pool.target)
  const rim = new THREE.PointLight(busy, 2.2, 8, 0)
  if (!mobile) scene.add(rim)

  const at = <T extends THREE.Object3D>(object: T, x: number, y: number, z: number): T => {
    object.position.set(x, y, z)
    return object
  }
  const matte = (color: THREE.Color, roughness = 0.62) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.12 })
  /** A rounded, lit solid. */
  const block = (w: number, h: number, d: number, color: THREE.Color = body, radius = 0.07) =>
    new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)),
      matte(color),
    )
  const rod = (radius: number, length: number, color: THREE.Color, sides = 20) =>
    new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, sides), matte(color, 0.4))
  /** A surface that shows by its own light: a screen, a lamp, a window. */
  const lit = (color: THREE.Color, map: THREE.Texture | null = null) =>
    new THREE.MeshBasicMaterial({ color, map, toneMapped: false })
  const glow = (w: number, h: number, material: THREE.MeshBasicMaterial) =>
    new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
  /** The mouth a sheet goes into: a dark recess on top of a body. */
  const mouth = (width: number) => block(width, 0.05, 0.16, base, 0.02)

  // ── Shared pictures ──
  const grey = new THREE.Color()
  // A small screen's face: bezel, ground, three rows. Tinted by its material.
  const chip = painted(64, 40, (ctx) => {
    ctx.fillStyle = css(grey.setScalar(0.22))
    ctx.fillRect(0, 0, 64, 40)
    ctx.fillStyle = css(grey.setScalar(0.5))
    ctx.fillRect(3, 3, 58, 34)
    ctx.fillStyle = css(grey.setScalar(1))
    ctx.fillRect(8, 9, 30, 4)
    ctx.fillRect(8, 18, 46, 4)
    ctx.fillRect(8, 27, 22, 4)
  })
  // Dusk outside the windows: the page's own colours, top to horizon.
  const sky = painted(4, 64, (ctx) => {
    const fade = ctx.createLinearGradient(0, 0, 0, 64)
    fade.addColorStop(0, css(busy.clone().lerp(base, 0.88)))
    fade.addColorStop(1, css(warm.clone().lerp(base, 0.82)))
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, 4, 64)
  })
  // A soft disc: contact shadows and the pool of light on the floor.
  const soft = painted(64, 64, (ctx) => {
    const fade = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
    const tone = css(grey.setScalar(1))
    fade.addColorStop(0, tone)
    fade.addColorStop(1, `${tone}00`)
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, 64, 64)
  })
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: base.clone().multiplyScalar(0.2),
    map: soft,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const flat = new THREE.PlaneGeometry(1, 1)
  /** A contact shadow lying on the floor under whatever it is added to. */
  const shadow = (width: number, depth: number) => {
    const mesh = new THREE.Mesh(flat, shadowMaterial)
    mesh.rotation.x = -Math.PI / 2
    mesh.scale.set(width * 2, depth * 2, 1)
    mesh.position.y = 0.016
    return mesh
  }

  // ── The hall ──
  // Ceramic floor: glossy tiles with grout lines, each a slightly different tone.
  let grain = 7
  const vary = () => {
    grain = (grain * 16807) % 2147483647
    return grain / 2147483647
  }
  const tilePixels = mobile ? 256 : 512
  const tiles = painted(tilePixels, tilePixels, (ctx) => {
    const cell = tilePixels / 4
    const tile = base.clone().lerp(light, 0.1)
    ctx.fillStyle = css(base.clone().lerp(light, 0.04))
    ctx.fillRect(0, 0, tilePixels, tilePixels)
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        ctx.fillStyle = css(grey.copy(tile).lerp(light, vary() * 0.05))
        ctx.fillRect(column * cell + 1.5, row * cell + 1.5, cell - 3, cell - 3)
      }
    }
  })
  tiles.wrapS = THREE.RepeatWrapping
  tiles.wrapT = THREE.RepeatWrapping
  tiles.repeat.set((hall.halfWidth * 2) / TILE_SPAN, length / TILE_SPAN)
  tiles.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(hall.halfWidth * 2, length),
    new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.3, metalness: 0.18 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(at(floor, 0, 0, centre))
  // The line inlaid in the floor that leads through every gate.
  const inlay = glow(0.22, length - 4, lit(busy.clone().lerp(base, 0.35)))
  inlay.rotation.x = -Math.PI / 2
  scene.add(at(inlay, 0, 0.012, centre))
  // Where the light pool lands, the floor glows a little.
  const spill = new THREE.Mesh(
    flat,
    new THREE.MeshBasicMaterial({
      color: busy,
      map: soft,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  spill.rotation.x = -Math.PI / 2
  spill.scale.set(11, 11, 1)
  scene.add(at(spill, 0, 0.02, 0))

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(hall.halfWidth * 2, length),
    matte(dark, 0.9),
  )
  ceiling.rotation.x = Math.PI / 2
  scene.add(at(ceiling, 0, hall.height, centre))

  // Everything repeated along the hall is instanced: one draw call a kind.
  /** x, y, z, then size x, y, z, then turn about y and about x. */
  type Placement = readonly [number, number, number, number, number, number, number, number]
  const slot = new THREE.Object3D()
  const repeat = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    placements: Placement[],
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length)
    placements.forEach(([x, y, z, sx, sy, sz, turnY, turnX], index) => {
      slot.position.set(x, y, z)
      slot.scale.set(sx, sy, sz)
      slot.rotation.set(turnX, turnY, 0)
      slot.updateMatrix()
      mesh.setMatrixAt(index, slot.matrix)
    })
    scene.add(mesh)
    return mesh
  }
  const cube = new THREE.BoxGeometry(1, 1, 1)

  // The stock station has a loading dock: its road leaves through a door in
  // the wall on that station's side.
  const dockStation = JOURNEY_STATIONS.indexOf('stock')
  const doorSide =
    dockStation >= 0 && dockStation < stations ? (dockStation % 2 === 0 ? flow : -flow) : 0
  const doorZ = -(dockStation + 1) * GAP + 1.4
  const doorLow = doorZ - 2.8
  const doorHigh = doorZ + 2.8
  const doorTop = 4.6
  const atDoor = (wall: number, z: number, margin: number) =>
    wall === doorSide && z > doorLow - margin && z < doorHigh + margin

  const wallAt = hall.halfWidth + 0.2
  const H = hall.height
  const walls: Placement[] = [
    [0, H / 2, hall.front + 0.2, wallAt * 2 + 0.4, H, 0.4, 0, 0],
    [0, H / 2, hall.back - 0.2, wallAt * 2 + 0.4, H, 0.4, 0, 0],
  ]
  const posts: Placement[] = []
  const frames: Placement[] = []
  const panes: Placement[] = []
  const desks: Placement[] = []
  const legs: Placement[] = []
  /** Where a table stands and which wall it is by: people are grouped at some of them. */
  const tables: { x: number; z: number; wall: number }[] = []
  /** The boards along the side walls: where each hangs and which wall it is on. */
  const signs: { x: number; z: number; wall: number }[] = []
  const monitors: Placement[] = []
  const displays: Placement[][] = [[], []]
  for (const wall of [-1, 1]) {
    if (wall === doorSide) {
      walls.push(
        [wall * wallAt, H / 2, (hall.front + doorHigh) / 2, 0.4, H, hall.front - doorHigh, 0, 0],
        [wall * wallAt, H / 2, (hall.back + doorLow) / 2, 0.4, H, doorLow - hall.back, 0, 0],
        [wall * wallAt, (H + doorTop) / 2, doorZ, 0.4, H - doorTop, doorHigh - doorLow, 0, 0],
      )
      // Outside the door: the evening the van drives into.
      panes.push([wall * (wallAt + 34), 7, doorZ, 60, 18, 1, (-wall * Math.PI) / 2, 0])
    } else {
      walls.push([wall * wallAt, H / 2, centre, 0.4, H, length, 0, 0])
    }
    const inner = wall * hall.halfWidth
    const facing = (-wall * Math.PI) / 2
    for (let z = hall.front - 4.5; z > hall.back + 3; z -= 9) {
      if (!atDoor(wall, z + 4.5, 0.6)) posts.push([inner, H / 2, z + 4.5, 0.7, H, 0.7, 0, 0])
      if (atDoor(wall, z, 3.2)) continue
      // A board above head height naming a kind of business; under it a
      // four-legged table with a working screen.
      frames.push([inner - wall * 0.03, 6.3, z, 3.9, 2.95, 0.1, facing, 0])
      signs.push({ x: inner - wall * 0.09, z, wall })
      const desk = wall * (side + 9)
      desks.push([desk, 0.74, z, 1.1, 0.06, 2.3, 0, 0])
      for (const dx of [-0.48, 0.48]) {
        for (const dz of [-1.08, 1.08]) legs.push([desk + dx, 0.36, z + dz, 0.07, 0.72, 0.07, 0, 0])
      }
      monitors.push([desk + wall * 0.3, 1.06, z, 0.08, 0.52, 0.84, 0, 0])
      displays[tables.length % 2]?.push([desk + wall * 0.255, 1.06, z, 0.74, 0.46, 1, facing, 0])
      tables.push({ x: desk, z, wall })
    }
  }
  // The shop front behind the core, and a window in the wall behind the camera.
  frames.push([0, 4.6, hall.back + 0.03, hall.halfWidth * 1.3 + 0.4, 6.4, 0.1, 0, 0])
  panes.push([0, 4.6, hall.back + 0.09, hall.halfWidth * 1.3, 6, 1, 0, 0])
  frames.push([0, 5, hall.front - 0.03, 8.4, 4.4, 0.1, 0, 0])
  panes.push([0, 5, hall.front - 0.09, 8, 4, 1, Math.PI, 0])

  // The ceiling: beams across, and light panels along the road.
  const beams: Placement[] = []
  const lamps: Placement[] = []
  for (let z = hall.front - 3; z > hall.back + 3; z -= 4.5) {
    for (const x of [-2.7, 2.7]) lamps.push([x, H - 0.06, z, 0.7, 2.6, 1, 0, Math.PI / 2])
  }
  for (let z = hall.front - 9; z > hall.back + 3; z -= 9) {
    beams.push([0, H - 0.3, z, hall.halfWidth * 2, 0.6, 0.45, 0, 0])
  }

  repeat(cube, matte(base.clone().lerp(light, 0.09), 0.85), walls)
  repeat(cube, matte(dark), posts)
  repeat(cube, matte(trim), frames)
  repeat(flat, lit(grey.setScalar(1).clone(), sky), panes)
  repeat(cube, matte(body), desks)
  repeat(cube, matte(trim), legs)
  repeat(cube, matte(dark), monitors)
  repeat(cube, matte(dark, 0.9), beams)
  repeat(flat, lit(lamp), lamps)

  // The kinds of business the product is built for, one to a board. All the
  // names are painted on a single texture and all the boards are a single
  // mesh, each quad showing its own cell of that texture.
  const trades = journeyState.industries
  if (trades.length > 0 && signs.length > 0) {
    const columns = 6
    const rows = Math.ceil(trades.length / columns)
    const cellW = mobile ? 170 : 340
    const cellH = mobile ? 128 : 256
    const sheet = painted(columns * cellW, rows * cellH, (ctx) => {
      const family = getComputedStyle(document.body).fontFamily
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      trades.forEach((trade, index) => {
        const x = (index % columns) * cellW
        const y = Math.floor(index / columns) * cellH
        ctx.fillStyle = css(deep)
        ctx.fillRect(x, y, cellW, cellH)
        ctx.strokeStyle = css(busy.clone().lerp(base, 0.5))
        ctx.lineWidth = cellW / 85
        ctx.strokeRect(x + cellW * 0.03, y + cellH * 0.04, cellW * 0.94, cellH * 0.92)
        ctx.font = `${cellH * 0.36}px ${family}`
        ctx.fillStyle = css(light)
        ctx.fillText(trade.icon, x + cellW / 2, y + cellH * 0.36)
        // A long name is set smaller, never cut.
        let size = cellH * 0.17
        ctx.font = `700 ${size}px ${family}`
        const wide = ctx.measureText(trade.label).width
        if (wide > cellW * 0.84) size *= (cellW * 0.84) / wide
        ctx.font = `700 ${size}px ${family}`
        ctx.fillText(trade.label, x + cellW / 2, y + cellH * 0.76)
      })
    })
    sheet.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const corners = new Float32Array(signs.length * 12)
    const cells = new Float32Array(signs.length * 8)
    const order: number[] = []
    signs.forEach((sign, index) => {
      const cell = index % trades.length
      const u = (cell % columns) / columns
      const v = 1 - Math.floor(cell / columns) / rows
      // Seen from inside the hall, a board reads from its own start to its end.
      const span = sign.wall * 1.8
      const points = [
        [sign.z - span, 4.95, u, v - 1 / rows],
        [sign.z + span, 4.95, u + 1 / columns, v - 1 / rows],
        [sign.z + span, 7.65, u + 1 / columns, v],
        [sign.z - span, 7.65, u, v],
      ]
      points.forEach(([z, y, cu, cv], corner) => {
        corners.set([sign.x, y ?? 0, z ?? 0], index * 12 + corner * 3)
        cells.set([cu ?? 0, cv ?? 0], index * 8 + corner * 2)
      })
      const first = index * 4
      order.push(first, first + 1, first + 2, first, first + 2, first + 3)
    })
    const wallBoards = new THREE.BufferGeometry()
    wallBoards.setAttribute('position', new THREE.BufferAttribute(corners, 3))
    wallBoards.setAttribute('uv', new THREE.BufferAttribute(cells, 2))
    wallBoards.setIndex(order)
    const boardMaterial = lit(grey.setScalar(0.8).clone(), sheet)
    boardMaterial.side = THREE.DoubleSide
    scene.add(new THREE.Mesh(wallBoards, boardMaterial))
  }

  // ── The printer ──
  const printer = new THREE.Group()
  printer.add(at(block(2.9, 0.95, 2.1, body, 0.14), 0, 0.5, 0))
  printer.add(at(block(2.6, 0.34, 1.5, body, 0.12), 0, 1.13, -0.2))
  printer.add(at(mouth(1.85), 0, PRINTER_SLOT - 0.03, 0.3))
  printer.add(at(block(2.3, 0.06, 0.9, dark, 0.03), 0, 0.2, 1.3))
  printer.add(at(block(1.1, 0.22, 0.05, dark, 0.02), -0.6, 0.62, 1.06))
  const feed = at(rod(0.12, 1.9, trim, 12), 0, PRINTER_SLOT - 0.16, 0.3)
  feed.rotation.z = Math.PI / 2
  printer.add(feed)
  const printerLamp = new THREE.MeshBasicMaterial({ color: busy })
  printer.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), printerLamp), 1.05, 0.62, 1.06))
  scene.add(printer)

  // ── People ──
  // Jointed figures: a thigh and a shin, an upper arm and a forearm, so a step
  // bends a knee and a carried sheet bends an elbow. Each faces -z.
  interface Figure {
    root: THREE.Group
    head: THREE.Group
    arms: THREE.Mesh[]
    fore: THREE.Mesh[]
    legs: THREE.Mesh[]
    shins: THREE.Mesh[]
  }
  type Look = 'robot' | 'woman' | 'man'
  const skin = warm.clone().lerp(light, 0.6)
  const hair = base.clone().lerp(warm, 0.22)
  const suits = [
    base.clone().lerp(light, 0.2),
    base.clone().lerp(busy, 0.3),
    base.clone().lerp(light, 0.42),
  ]
  const ball = (radius: number, color: THREE.Color) =>
    new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), matte(color, 0.5))
  /** A limb segment hinged at its top end. */
  const segment = (radius: number, length: number, color: THREE.Color) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), matte(color, 0.5))
    mesh.geometry.translate(0, -length / 2, 0)
    return mesh
  }

  const figure = (look: Look, tone: number): Figure => {
    const root = new THREE.Group()
    const robot = look === 'robot'
    const cloth = robot ? light : (suits[tone % suits.length] ?? dark)
    const legColor = robot ? light : look === 'woman' ? skin : cloth

    const legs: THREE.Mesh[] = []
    const shins: THREE.Mesh[] = []
    const arms: THREE.Mesh[] = []
    const fore: THREE.Mesh[] = []
    for (const half of [-1, 1]) {
      const thigh = segment(robot ? 0.1 : 0.095, 0.4, legColor)
      const shin = segment(0.08, 0.4, legColor)
      shin.position.y = -0.42
      shin.add(at(block(0.17, 0.11, 0.32, robot ? dark : base, 0.04), 0, -0.47, -0.07))
      if (robot) thigh.add(at(ball(0.105, dark), 0, -0.42, 0))
      thigh.add(shin)
      root.add(at(thigh, half * 0.13, 0.95, 0))
      legs.push(thigh)
      shins.push(shin)

      const upper = segment(robot ? 0.085 : 0.075, 0.28, cloth)
      const lower = segment(0.065, 0.26, cloth)
      lower.position.y = -0.3
      lower.add(at(ball(0.075, robot ? dark : skin), 0, -0.31, 0))
      if (robot) upper.add(at(ball(0.09, dark), 0, -0.3, 0))
      upper.add(lower)
      root.add(at(upper, half * (robot ? 0.42 : look === 'woman' ? 0.31 : 0.37), 1.58, 0))
      arms.push(upper)
      fore.push(lower)
    }

    const head = new THREE.Group()
    if (robot) {
      // White shell, dark joints, a visor with two lit eyes.
      root.add(at(block(0.66, 0.6, 0.42, light, 0.18), 0, 1.38, 0))
      root.add(at(block(0.4, 0.22, 0.3, dark, 0.08), 0, 1.0, 0))
      root.add(at(block(0.2, 0.08, 0.02, busy, 0.01), 0, 1.46, -0.215))
      head.add(block(0.52, 0.44, 0.48, light, 0.2))
      head.add(at(block(0.42, 0.2, 0.06, base, 0.06), 0, 0.02, -0.225))
      for (const half of [-1, 1]) {
        const eye = new THREE.Mesh(
          new THREE.CircleGeometry(0.045, 16),
          new THREE.MeshBasicMaterial({ color: busy }),
        )
        eye.rotation.y = Math.PI
        head.add(at(eye, half * 0.1, 0.02, -0.258))
        const ear = rod(0.09, 0.05, dark)
        ear.rotation.z = Math.PI / 2
        head.add(at(ear, half * 0.275, 0, 0))
      }
      root.add(at(rod(0.07, 0.12, dark), 0, 1.72, 0), at(head, 0, 1.98, 0))
    } else {
      if (look === 'woman') {
        // Blazer, fitted waist, knee-length skirt, hair in a bun.
        root.add(at(block(0.52, 0.42, 0.34, cloth, 0.15), 0, 1.45, 0))
        root.add(at(block(0.4, 0.26, 0.26, cloth, 0.1), 0, 1.15, 0))
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.31, 0.46, 18), matte(cloth))
        root.add(at(skirt, 0, 0.84, 0), at(block(0.14, 0.24, 0.02, light, 0.01), 0, 1.5, -0.175))
        head.add(at(ball(0.11, hair), 0, 0.2, 0.17))
      } else {
        // Suit jacket, shirt and tie.
        root.add(at(block(0.6, 0.68, 0.34, cloth, 0.12), 0, 1.32, 0))
        root.add(at(block(0.17, 0.42, 0.02, light, 0.01), 0, 1.4, -0.175))
        root.add(at(block(0.055, 0.34, 0.02, busy, 0.01), 0, 1.38, -0.19))
        head.add(at(block(0.3, 0.1, 0.2, hair, 0.05), 0, 0.2, -0.08))
      }
      head.add(ball(0.225, skin))
      const cap = ball(0.238, hair)
      cap.scale.set(1, 0.92, 1)
      head.add(at(cap, 0, 0.05, 0.05))
      root.add(at(rod(0.06, 0.1, skin), 0, 1.7, 0), at(head, 0, 1.9, 0))
    }
    root.add(shadow(0.62, 0.62))
    return { root, head, arms, fore, legs, shins }
  }

  /** Move a figure toward a pose: `stride` is the walk cycle, `carry` raises both forearms. */
  const pose = (who: Figure, stride: number, carry: number, rate: number) => {
    who.legs.forEach((leg, index) => {
      const swing = (index === 0 ? 1 : -1) * stride
      leg.rotation.x += (swing * 0.55 - leg.rotation.x) * rate
      const shin = who.shins[index]
      if (shin) shin.rotation.x += (-Math.max(0, -swing) * 0.85 - shin.rotation.x) * rate
    })
    who.arms.forEach((arm, index) => {
      const swing = (index === 0 ? -1 : 1) * stride * 0.45
      arm.rotation.x += (carry * 0.55 + (1 - carry) * swing - arm.rotation.x) * rate
      const lower = who.fore[index]
      const bend = carry * 1.05 + (1 - carry) * (0.18 + Math.max(0, swing) * 0.5)
      if (lower) lower.rotation.x += (bend - lower.rotation.x) * rate
    })
  }

  // The agent: a robot that carries the invoice from gate to gate in both hands.
  const agent = figure('robot', 0)
  scene.add(agent.root)

  // The staff. Not scattered: in groups of two at the tables along the walls
  // — one seated at the screen, a colleague standing beside, talking it over —
  // plus two people walking the hall.
  interface Person {
    who: Figure
    home: number
    role: 'walks' | 'sits' | 'talks'
  }
  const crowd: Person[] = []
  const groups = mobile ? 3 : 6
  for (let group = 0; group < groups; group++) {
    // Every third table, starting near the printer, on alternating walls.
    const table = tables.filter((each) => each.z < 4 && each.wall === (group % 2 === 0 ? 1 : -1))[
      Math.floor(group / 2) * 2
    ]
    if (!table) continue
    const seated = figure(group % 2 === 0 ? 'woman' : 'man', group)
    seated.legs.forEach((leg) => {
      leg.rotation.x = 1.45
    })
    seated.shins.forEach((shin) => {
      shin.rotation.x = -1.45
    })
    seated.root.rotation.y = (-table.wall * Math.PI) / 2
    scene.add(at(seated.root, table.x - table.wall * 0.98, -0.4, table.z))
    const stool = new THREE.Group()
    stool.add(
      at(block(0.5, 0.08, 0.5, dark, 0.04), 0, 0.5, 0),
      at(rod(0.04, 0.46, trim), 0, 0.25, 0),
    )
    stool.add(at(rod(0.26, 0.04, dark, 5), 0, 0.03, 0))
    scene.add(at(stool, table.x - table.wall * 1.02, 0, table.z))
    crowd.push({ who: seated, home: table.z, role: 'sits' })

    const beside = figure(group % 2 === 0 ? 'man' : 'woman', group + 3)
    beside.root.rotation.y = Math.atan2(-table.wall * 0.55, 0.85)
    scene.add(at(beside.root, table.x - table.wall * 1.25, 0, table.z + 1.35))
    crowd.push({ who: beside, home: table.z, role: 'talks' })
  }
  for (let index = 0; index < (mobile ? 1 : 2); index++) {
    const who = figure(index === 0 ? 'man' : 'woman', index + 1)
    const home = -14 - index * 3 * GAP
    scene.add(at(who.root, (index === 0 ? 1 : -1) * (side + 6.4), 0, home))
    crowd.push({ who, home, role: 'walks' })
  }
  // ── Where everything stands ──
  /** Where the sheet hovers over a stop, how high its slot is, which way it faces. */
  const stops = [
    { x: 0, z: 0.3, slot: PRINTER_SLOT, turn: 0 },
    ...Array.from({ length: stations }, (_, index) => {
      const x = (index % 2 === 0 ? flow : -flow) * side
      // Each machine is turned a little toward the road, so its face is seen.
      return { x, z: -(index + 1) * GAP, slot: MACHINE_SLOT, turn: -Math.sign(x) * 0.22 }
    }),
  ]
  const origin = stops[0] ?? { x: 0, z: 0.3, slot: PRINTER_SLOT, turn: 0 }
  /** Where the agent stands at a stop: on the road, beside the machine, clear of the camera. */
  const spots = stops.map((stop) => ({
    x: stop.x === 0 ? -2.2 * flow : stop.x - Math.sign(stop.x) * 2.5,
    z: stop.z + 1.3,
  }))
  /** How far along the walk to a station its gate stands. */
  const GATE_ALONG = 0.7

  // ── The machines ──
  interface Machine {
    group: THREE.Group
    screen: THREE.MeshBasicMaterial
    moving: THREE.Object3D
    kind: number
  }
  const machines: Machine[] = []
  const clerks: Figure[] = []
  /** The loading dock beside the stock rack; it runs on its own clock. */
  interface Dock {
    lift: THREE.Object3D
    carton: THREE.Object3D
    van: THREE.Group
    wheels: THREE.Mesh[]
    arm: THREE.Group
    puffs: THREE.Mesh[]
    smoke: THREE.MeshBasicMaterial[]
    clock: number
    /** +1 or −1: which way along x the dock leaves the hall. */
    out: number
  }
  let dock: Dock | null = null
  // One board per station. Its canvas is repainted only when what it shows changes.
  const palette: BoardPalette = {
    ground: css(deep),
    ink: css(light),
    faint: css(trim),
    accent: css(busy),
    good: css(done),
    warn: css(warm),
  }
  interface Board {
    model: ScreenModel
    ctx: CanvasRenderingContext2D | null
    texture: THREE.CanvasTexture
    /** What is painted on it now, so the same picture is never painted twice. */
    showing: number
  }
  const boards: Board[] = []
  const anisotropy = renderer.capabilities.getMaxAnisotropy()
  for (let index = 0; index < stations; index++) {
    const group = new THREE.Group()
    const kind = index % 5
    const place = stops[index + 1] ?? origin
    const out = Math.sign(place.x) || 1
    const screen = lit(line.clone(), chip)
    let moving: THREE.Object3D = new THREE.Group()

    // What every machine shares is only the intake: a counter with a mouth.
    group.add(at(block(2.6, 1.1, 1.7, body, 0.12), 0, 0.55, 0))
    group.add(at(mouth(1.8), 0, MACHINE_SLOT - 0.03, 0))
    group.add(at(block(2.7, 0.08, 1.8, dark, 0.03), 0, 0.05, 0))

    if (kind === 0) {
      // Payment terminal: a handset on a stem, tilted screen, keypad, card.
      const head = new THREE.Group()
      head.add(block(1, 1.5, 0.22, dark, 0.1))
      head.add(at(glow(0.8, 0.5, screen), 0, 0.38, 0.115))
      for (let keypad = 0; keypad < 12; keypad++) {
        const cap = block(0.17, 0.12, 0.05, trim, 0.02)
        head.add(at(cap, -0.25 + (keypad % 3) * 0.25, -0.02 - Math.floor(keypad / 3) * 0.16, 0.12))
      }
      head.rotation.x = -0.5
      group.add(at(rod(0.09, 0.7, trim), 0.7, 1.45, -0.45), at(head, 0.7, 2.25, -0.3))
      moving = at(block(0.62, 0.02, 0.4, busy, 0.01), -0.85, 1.14, 0.55)
      group.add(moving)
    } else if (kind === 1) {
      // Cash register: sloped keyboard, a customer display on a pole, and a
      // drawer of coins and notes that opens when the money is counted in.
      const keys = at(block(1.5, 0.12, 0.8, dark, 0.04), -0.35, 1.3, 0.5)
      keys.rotation.x = 0.35
      group.add(keys, at(block(1.5, 0.5, 0.5, body, 0.08), -0.35, 1.36, -0.45))
      group.add(at(glow(1.2, 0.32, screen), -0.35, 1.4, -0.19))
      group.add(at(rod(0.05, 0.9, trim), 0.95, 1.55, -0.5))
      group.add(at(block(0.7, 0.4, 0.1, dark, 0.04), 0.95, 2.1, -0.5))
      group.add(at(glow(0.56, 0.26, screen), 0.95, 2.1, -0.445))
      const drawer = new THREE.Group()
      drawer.add(block(2.3, 0.3, 1.4, dark, 0.04))
      for (let tray = 0; tray < 4; tray++) {
        for (let coin = 0; coin < 3; coin++) {
          drawer.add(at(rod(0.13, 0.04, warm), -0.8 + tray * 0.5, 0.17 + coin * 0.045, 0.4))
        }
        drawer.add(at(block(0.4, 0.05, 0.7, done, 0.01), -0.8 + tray * 0.5, 0.17, -0.15))
      }
      moving = at(drawer, 0, 0.42, 0.1)
      group.add(moving)
    } else if (kind === 2) {
      // Stock rack: steel uprights, three decks of cartons, one carton that
      // leaves the rack with the sale.
      for (const x of [-1.25, 1.25]) {
        for (const z of [-1.5, -0.7]) group.add(at(block(0.09, 3.3, 0.09, trim, 0.02), x, 1.65, z))
      }
      const carton = warm.clone().lerp(base, 0.35)
      for (let deck = 0; deck < 3; deck++) {
        const y = 1.25 + deck * 0.95
        group.add(at(block(2.6, 0.07, 0.95, trim, 0.02), 0, y, -1.1))
        for (let column = 0; column < 3; column++) {
          const box = new THREE.Group()
          box.add(block(0.62, 0.55, 0.62, carton, 0.03))
          box.add(at(block(0.64, 0.04, 0.14, trim, 0.01), 0, 0.26, 0))
          at(box, -0.8 + column * 0.8, y + 0.32, -1.1)
          if (deck === 1 && column === 1) moving = box
          group.add(box)
        }
      }
      group.add(at(glow(0.9, 0.3, screen), 0, 0.72, 0.86))
      // The loading dock. A lift takes the sold carton down from its shelf, it
      // is pushed into the van, the barrier rises and the van drives off down
      // its own road, leaving exhaust behind.
      const yard = new THREE.Group()
      yard.scale.x = out
      group.add(yard)
      yard.add(at(block(0.24, 3.5, 0.24, trim, 0.04), 1.75, 1.75, -1.72))
      yard.add(at(block(1.2, 0.1, 1.2, dark, 0.03), 1.75, 0.05, -1.1))
      const lift = new THREE.Group()
      lift.add(block(1, 0.08, 1, busy.clone().lerp(base, 0.35), 0.02))
      lift.add(at(block(0.3, 0.3, 0.3, dark, 0.05), 0, 0.02, -0.62))
      yard.add(at(lift, 1.75, 2.2, -1.1))

      const road = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.8), matte(dark, 0.9))
      road.rotation.x = -Math.PI / 2
      yard.add(at(road, 19.5, 0.02, -1.1))
      for (let dash = 0; dash < 10; dash++) {
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.1), matte(trim, 0.9))
        mark.rotation.x = -Math.PI / 2
        yard.add(at(mark, 5.5 + dash * 3.2, 0.03, -1.1))
      }

      const truck = new THREE.Group()
      truck.add(at(block(2.5, 1.55, 1.6, light, 0.1), -0.45, 1.3, 0))
      truck.add(at(block(1.05, 1.15, 1.6, busy, 0.16), 1.4, 1.1, 0))
      truck.add(at(block(0.05, 0.42, 1.3, dark, 0.02), 1.93, 1.32, 0))
      truck.add(at(block(3.6, 0.16, 1.5, dark, 0.04), 0.1, 0.5, 0))
      const wheels: THREE.Mesh[] = []
      for (const x of [-1.05, 1.25]) {
        for (const z of [-0.78, 0.78]) {
          const wheel = rod(0.34, 0.22, dark, 8)
          wheel.rotation.x = Math.PI / 2
          truck.add(at(wheel, x, 0.34, z))
          wheels.push(wheel)
        }
      }
      yard.add(at(truck, 4.6, 0, -1.1))

      // The barrier: a booth on an island, and a striped arm across the road.
      yard.add(at(block(1.5, 0.16, 1.3, trim, 0.05), 7.8, 0.08, -3.2))
      yard.add(at(block(1, 2, 1, light, 0.06), 7.8, 1.16, -3.3))
      yard.add(at(block(0.72, 0.62, 0.03, dark, 0.01), 7.8, 1.55, -2.79))
      yard.add(at(block(1.25, 0.12, 1.25, dark, 0.04), 7.8, 2.22, -3.3))
      yard.add(at(block(0.24, 1, 0.24, warm, 0.05), 7.8, 0.5, -2.45))
      const arm = new THREE.Group()
      for (let stripe = 0; stripe < 7; stripe++) {
        arm.add(
          at(
            block(0.1, 0.1, 0.4, stripe % 2 === 0 ? alert : light, 0.02),
            0,
            0,
            0.2 + stripe * 0.4,
          ),
        )
      }
      yard.add(at(arm, 7.8, 1.02, -2.45))

      const smoke: THREE.MeshBasicMaterial[] = []
      const puffs = Array.from({ length: 6 }, () => {
        const material = new THREE.MeshBasicMaterial({ color: trim, transparent: true, opacity: 0 })
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), material)
        puff.visible = false
        smoke.push(material)
        yard.add(puff)
        return puff
      })
      dock = { lift, carton: moving, van: truck, wheels, arm, puffs, smoke, clock: 0, out }
    } else if (kind === 3) {
      // Ledger: a thick book lying open on a lectern, with a ribbon.
      const lectern = at(block(2.4, 0.12, 1.5, dark, 0.04), 0, 1.75, -0.55)
      lectern.rotation.x = 0.5
      group.add(at(rod(0.1, 0.8, trim), 0, 1.4, -0.75), lectern)
      const book = new THREE.Group()
      for (const half of [-1, 1]) {
        book.add(at(block(1.08, 0.16, 1.3, light, 0.03), half * 0.56, 0.1, 0))
        const page = at(glow(0.96, 1.16, screen), half * 0.56, 0.185, 0)
        page.rotation.x = -Math.PI / 2
        book.add(page)
      }
      book.add(block(2.36, 0.05, 1.4, busy.clone().lerp(base, 0.5), 0.02))
      book.add(at(block(0.07, 0.02, 1.5, busy, 0.01), 0, 0.2, 0.1))
      book.rotation.x = 0.5
      group.add(at(book, 0, 1.86, -0.52))
    } else {
      // Report desk: a monitor on a stand with a keyboard; the chart fills in
      // once the sale has reached it.
      group.add(at(block(0.9, 0.06, 0.5, trim, 0.02), 0, 1.14, -0.5))
      group.add(at(rod(0.07, 0.75, trim), 0, 1.5, -0.55))
      group.add(at(block(2.7, 1.65, 0.12, dark, 0.06), 0, 2.6, -0.5))
      group.add(at(glow(2.5, 1.45, lit(deep)), 0, 2.6, -0.435))
      group.add(at(block(1.5, 0.05, 0.5, dark, 0.02), 0, 1.15, 0.5))
      moving = new THREE.Group()
      for (let bar = 0; bar < 6; bar++) {
        const column = glow(0.26, 1, screen)
        column.geometry.translate(0, 0.5, 0)
        column.scale.y = 0.25 + ((bar * 3) % 5) * 0.2
        moving.add(at(column, -0.95 + bar * 0.38, 0, 0))
      }
      group.add(at(moving, 0, 2.02, -0.43))
    }

    // The station's arch: two posts behind the machine carrying its board,
    // high enough that the sheet working at the slot never covers it.
    for (const x of [-2.05, 2.05]) group.add(at(block(0.18, 6.4, 0.18, trim, 0.04), x, 3.2, -1.95))
    group.add(at(block(4.3, 0.2, 0.24, dark, 0.05), 0, 6.4, -1.95))
    const model = journeyState.screens[index]
    // What this station's clerk sees on the small screen: the same board.
    let own: THREE.Texture = chip
    if (model) {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 320
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = anisotropy
      const frame = new THREE.Group()
      frame.add(block(3.92, 2.5, 0.14, dark, 0.06))
      frame.add(at(glow(3.68, 2.3, lit(grey.setScalar(1).clone(), texture)), 0, 0, 0.075))
      // Tipped toward the road, as a board hung above head height is.
      frame.rotation.x = 0.12
      group.add(at(frame, 0, 5.02, -1.86))
      boards.push({ model, ctx: canvas.getContext('2d'), texture, showing: -1 })
      own = texture
    }

    // Someone works this station, seated at a side desk of their own: a chair
    // with a seat, a back and a foot, a keyboard under the hands and a small
    // screen to look at — so the typing has something to type on.
    const clerk = figure(index % 2 === 0 ? 'man' : 'woman', index + 1)
    clerk.root.rotation.y = Math.PI
    clerk.legs.forEach((leg) => {
      leg.rotation.x = 1.45
    })
    clerk.shins.forEach((shin) => {
      shin.rotation.x = -1.45
    })
    // Leaning a little into the work, feet under the desk.
    clerk.root.rotation.x = 0.1
    group.add(at(clerk.root, -1.86, -0.4, -1.0))
    group.add(at(block(0.62, 0.09, 0.6, dark, 0.04), -1.86, 0.5, -1.02))
    group.add(at(block(0.6, 0.78, 0.09, dark, 0.05), -1.86, 0.98, -1.36))
    group.add(at(rod(0.045, 0.42, trim), -1.86, 0.26, -1.02))
    group.add(at(rod(0.3, 0.05, dark, 5), -1.86, 0.04, -1.02))
    group.add(at(block(1.1, 0.06, 0.7, body, 0.03), -1.86, 0.86, -0.3))
    group.add(at(block(0.06, 0.86, 0.6, body, 0.02), -2.38, 0.43, -0.3))
    group.add(at(block(0.5, 0.03, 0.2, dark, 0.01), -1.86, 0.905, -0.42))
    group.add(at(block(0.62, 0.42, 0.05, dark, 0.03), -1.86, 1.2, -0.05))
    const small = glow(0.54, 0.34, lit(grey.setScalar(1).clone(), own))
    small.rotation.y = Math.PI
    group.add(at(small, -1.86, 1.2, -0.08))
    clerks.push(clerk)

    group.add(shadow(1.9, 1.4))
    group.position.set(place.x, 0, place.z)
    group.rotation.y = place.turn
    scene.add(group)
    machines.push({ group, screen, moving, kind })
  }

  // The screens on the tables along the walls: two finished boards of the same
  // sale, painted once and shared by every table.
  displays.forEach((placements, half) => {
    const shown = journeyState.screens[half === 0 ? 0 : journeyState.screens.length - 1]
    if (!shown || placements.length === 0) return
    const still = painted(512, 320, (ctx) =>
      paintBoard(ctx, shown, shown.rows.length, 'done', journeyState.recorded, palette),
    )
    still.anisotropy = anisotropy
    repeat(flat, lit(grey.setScalar(0.9).clone(), still), placements)
  })

  // ── The gates ──
  // Before every station the road passes a gate: two pedestals, two glass
  // leaves hinged on them, a light on top. Amber while shut ahead of the sale,
  // green once it opens for the agent and after the station has recorded.
  interface Gate {
    leaves: THREE.Group[]
    lamp: THREE.MeshBasicMaterial
    open: number
  }
  const glass = new THREE.MeshStandardMaterial({
    color: busy.clone().lerp(lamp, 0.5),
    transparent: true,
    opacity: 0.4,
    roughness: 0.15,
    metalness: 0.2,
  })
  const gates: Gate[] = machines.map((_, index) => {
    const from = spots[index] ?? { x: 0, z: 0 }
    const to = spots[index + 1] ?? from
    const group = new THREE.Group()
    const gateLamp = lit(warm.clone())
    const leaves = [-1, 1].map((half) => {
      group.add(at(block(0.34, 1.15, 1.5, body, 0.08), half * 1.12, 0.575, 0))
      group.add(at(block(0.2, 0.04, 1.2, base, 0.02), half * 1.12, 1.16, 0))
      const top = at(glow(0.16, 1.1, gateLamp), half * 1.12, 1.185, 0)
      top.rotation.x = -Math.PI / 2
      group.add(top)
      group.add(at(block(0.03, 0.3, 0.3, dark, 0.01), half * 0.945, 0.85, 0.45))
      const hinge = new THREE.Group()
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.78, 0.04), glass)
      hinge.add(at(leaf, -half * 0.47, 0, 0))
      group.add(at(hinge, half * 0.95, 0.72, 0))
      return hinge
    })
    const strip = glow(1.9, 0.12, gateLamp)
    strip.rotation.x = -Math.PI / 2
    group.add(at(strip, 0, 0.022, 0))
    group.position.set(
      from.x + (to.x - from.x) * GATE_ALONG,
      0,
      from.z + (to.z - from.z) * GATE_ALONG,
    )
    scene.add(group)
    return { leaves, lamp: gateLamp, open: 0 }
  })

  // Where each clerk's head is, for turning it to the agent and for the bubble.
  scene.updateMatrixWorld(true)
  const heads = clerks.map((clerk) => clerk.head.getWorldPosition(new THREE.Vector3()))
  // An arrow over the head of whoever is speaking, so the bubble is plainly theirs.
  const pointerShape = new THREE.ConeGeometry(0.17, 0.36, 14)
  const pointerMaterial = lit(busy.clone())
  const pointers = heads.map((head) => {
    const pointer = new THREE.Mesh(pointerShape, pointerMaterial)
    pointer.rotation.x = Math.PI
    pointer.visible = false
    scene.add(at(pointer, head.x, head.y + 0.72, head.z))
    return pointer
  })

  // ── The sun at the end ──
  const end = new THREE.Vector3(0, 3.8, -(stations + 1) * GAP - 5)
  // The core. Not a disc: a lit heart in a wire cage, three gyroscope rings
  // turning on different axes, and a ring of housing blocks around them. It
  // brightens with every stop that has recorded the invoice.
  const sunMaterial = new THREE.MeshBasicMaterial({ color: line, transparent: true, fog: false })
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: busy,
    transparent: true,
    opacity: 0.14,
    fog: false,
    depthWrite: false,
  })
  const sun = new THREE.Group()
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), sunMaterial)
  // Every part of the core can fade: when it bursts, the parts fly a little
  // way out and are gone, leaving only a glow behind the invitation.
  const cageMaterial = new THREE.LineBasicMaterial({ color: light, transparent: true, fog: false })
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.55, 1)),
    cageMaterial,
  )
  const halo = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 18), haloMaterial)
  sun.add(heart, cage, halo)
  const shell = [busy, trim, dark].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.6,
        transparent: true,
        fog: false,
      }),
  )
  const rings = [2.1, 2.65, 3.2].map((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.1, 10, 72),
      shell[index === 1 ? 0 : 1],
    )
    sun.add(ring)
    return ring
  })
  const fins = Array.from({ length: 12 }, (_, fin) => {
    const angle = (fin / 12) * Math.PI * 2
    const piece = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.2, 0.55, 3, 0.05), shell[2])
    piece.rotation.z = angle
    sun.add(piece)
    return { piece, x: Math.cos(angle) * 3.85, y: Math.sin(angle) * 3.85 }
  })
  scene.add(at(sun, end.x, end.y, end.z))

  const sparks = runtime.mode === 'mobile' ? 160 : 420
  const directions = new Float32Array(sparks * 3)
  let seed = 11
  const next = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let index = 0; index < sparks; index++) {
    const angle = next() * Math.PI * 2
    const lift = (next() - 0.5) * 2
    const reach = 0.4 + next() * 0.6
    directions[index * 3] = Math.cos(angle) * Math.sqrt(1 - lift * lift) * reach
    directions[index * 3 + 1] = lift * reach
    directions[index * 3 + 2] = Math.sin(angle) * Math.sqrt(1 - lift * lift) * reach
  }
  const sparkPositions = new THREE.BufferAttribute(new Float32Array(sparks * 3), 3)
  const sparkGeometry = new THREE.BufferGeometry()
  sparkGeometry.setAttribute('position', sparkPositions)
  const sparkMaterial = new THREE.PointsMaterial({
    color: busy,
    size: 0.22,
    transparent: true,
    opacity: 0,
    fog: false,
  })
  const burst = at(new THREE.Points(sparkGeometry, sparkMaterial), end.x, end.y, end.z)
  burst.frustumCulled = false
  scene.add(burst)

  // ── The invoice ──
  // Everything below `cut` is not drawn: that is how the sheet goes INTO a slot.
  const cut = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FAR_BELOW)
  const clip = { clippingPlanes: [cut], side: THREE.DoubleSide }
  const paperColor = lightIsPaper ? light : base
  const inkColor = lightIsPaper ? base : light
  const sheetMaterial = new THREE.MeshBasicMaterial({ color: paperColor, ...clip })
  if (journeyState.invoice) {
    sheetMaterial.map = drawInvoice(
      journeyState.invoice,
      `#${paperColor.getHexString()}`,
      `#${inkColor.getHexString()}`,
      `#${trim.getHexString()}`,
    )
    sheetMaterial.color.setScalar(1)
    sheetMaterial.map.anisotropy = renderer.capabilities.getMaxAnisotropy()
  }
  const invoice = new THREE.Group()
  invoice.add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, SHEET_HALF * 2), sheetMaterial))
  // One green mark for every machine that has recorded it.
  const marks = machines.map((_, index) => {
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 20),
      new THREE.MeshBasicMaterial({ color: done, ...clip }),
    )
    mark.visible = false
    invoice.add(at(mark, -0.56 + index * 0.25, -SHEET_HALF - 0.16, 0.01))
    return mark
  })
  const stamp = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.26, 28),
    new THREE.MeshBasicMaterial({ color: done, ...clip }),
  )
  stamp.visible = false
  invoice.add(at(stamp, 0.42, -0.62, 0.012))
  scene.add(invoice)

  const HAND = 2.25
  const REACH = 0.58
  const H_CLEAR = hall.height - 1.2

  const snap = newJourneySnapshot(stations)
  const framing: CameraPose = { yaw: 0, pitch: 0, distance: 0 }
  const offset: Offset = { x: 0, y: 0, z: 0 }
  const here = new THREE.Vector3()
  const eye = new THREE.Vector3()
  const aim = new THREE.Vector3()
  const wantEye = new THREE.Vector3()
  const wantAim = new THREE.Vector3()
  const focus = new THREE.Vector3()
  const anchor = new THREE.Vector3()
  const shade = new THREE.Color()
  /** The projection as it was last set, so it is set again only when it changes. */
  const view = { width: 0, height: 0, shift: 0, lift: 0 }
  const bubble = { on: false, x: -1, y: -1 }
  let story = -1
  let before = 0
  /** +1 while the visitor moves on through the story, −1 while they go back. */
  let going = 1

  // The page font may arrive after the scene; every board is painted again in it.
  void document.fonts?.ready.then(() => {
    boards.forEach((board) => {
      board.showing = -1
    })
  })

  return ({ progress, time }) => {
    // Ease toward the scroll position. Under reduced motion (time stays 0)
    // there is no easing: the picture is simply where the page is.
    const step = Math.min(0.1, Math.max(0, time - before))
    before = time
    const first = story < 0 || time === 0
    if (story >= 0 && Math.abs(progress - story) > 0.0008) going = progress > story ? 1 : -1
    story = first ? progress : story + (progress - story) * (1 - Math.exp(-step * 5))
    const drift = first ? 1 : 1 - Math.exp(-step * 3.5)

    // The one question: where is the story? Everything below reads the answer.
    journeyInto(story, stations, snap)
    const beat = snap.beat
    const t = snap.local
    const recorded = snap.recorded
    let turn = 0
    let lean = 0
    let size = 1
    cut.constant = -FAR_BELOW

    const start = spots[0] ?? { x: -2.2, z: 1.6 }
    let ax = start.x
    let az = start.z
    let face = Math.atan2(-(0 - ax), -(0.3 - az))
    let walking = false
    let carry = 0
    // The sheet is held in front of the agent, whichever way the agent faces.
    const heading = agent.root.rotation.y
    const fx = -Math.sin(heading) * REACH
    const fz = -Math.cos(heading) * REACH

    if (beat === 0) {
      // Printing: the sheet feeds up out of the printer's mouth, the agent waits.
      const out = ease(t)
      const inside = PRINTER_SLOT - SHEET_HALF
      here.set(0, inside + out * (HOVER - inside), 0.3)
      cut.constant = -PRINTER_SLOT
    } else if (beat <= stations) {
      const from = stops[beat - 1] ?? origin
      const to = stops[beat] ?? from
      const a = spots[beat - 1] ?? start
      const b = spots[beat] ?? a
      const inside = to.slot - SHEET_HALF - 0.04
      if (t < ENTER_AT) {
        // The agent takes the sheet from the last slot, walks it through the
        // gate to the next station and holds it up to that one.
        const fly = ease(t / ENTER_AT)
        const take = 1 - ease(clamp01(fly / 0.2))
        const give = ease(clamp01((fly - 0.8) / 0.2))
        ax = a.x + (b.x - a.x) * fly
        az = a.z + (b.z - a.z) * fly
        carry = 1 - take - give
        const hx = ax + fx
        const hz = az + fz
        here.set(
          hx + (from.x - hx) * take + (to.x - hx) * give,
          HAND + (HOVER - HAND) * (take + give),
          hz + (from.z - hz) * take + (to.z - hz) * give,
        )
        turn = from.turn * take + to.turn * give + heading * carry
        lean = -0.1 * carry
        walking = fly > 0.03 && fly < 0.97
        face = Math.atan2(-(b.x - a.x), -(b.z - a.z))
      } else {
        ax = b.x
        az = b.z
        face = Math.atan2(-(to.x - ax), -(to.z - az))
        turn = to.turn
        cut.constant = -to.slot
        if (t < RECORDED_AT) {
          const sink = ease((t - ENTER_AT) / (RECORDED_AT - ENTER_AT))
          here.set(to.x, HOVER - sink * (HOVER - inside), to.z)
        } else {
          const rise = ease(clamp01((t - LEAVE_AT) / (1 - LEAVE_AT)))
          here.set(to.x, inside + rise * (HOVER - inside), to.z)
        }
      }
    } else {
      // The agent carries it toward the core and lets it go; then the core bursts.
      const from = stops[stations] ?? origin
      const a = spots[stations] ?? start
      const fly = ease(clamp01(t / BURST_AT))
      const take = 1 - ease(clamp01(fly / 0.2))
      const release = ease(clamp01((fly - 0.55) / 0.45))
      // The agent steps to the side of the road, out of the camera's way.
      ax = a.x + (-2.6 * flow - a.x) * fly
      az = a.z - fly * 7
      carry = (1 - take) * (1 - release)
      const hx = ax + fx
      const hz = az + fz
      here.set(hx + (from.x - hx) * take, HAND + (HOVER - HAND) * take, hz + (from.z - hz) * take)
      here.lerp(end, release)
      turn = from.turn * take + heading * carry
      lean = -0.5 * Math.sin(release * Math.PI)
      size = 1 - release * 0.92
      walking = fly > 0.03 && fly < 0.97
      face = Math.atan2(-(-2.6 * flow - a.x), 7)
    }

    // Going back, the agent turns round and walks back — it does not moonwalk.
    if (walking && going < 0) face += Math.PI
    const stride = walking ? Math.sin(time * 9) : 0
    agent.root.position.set(ax, Math.abs(stride) * 0.04, az)
    agent.root.rotation.y += (face - agent.root.rotation.y) * drift
    pose(agent, stride, carry, drift)
    agent.head.rotation.y = Math.sin(time * 0.6) * 0.12 * (1 - carry)

    // The clerk of the station being worked at looks up at the agent, and
    // raises a hand while speaking; the others keep typing.
    clerks.forEach((clerk, index) => {
      const mine = snap.station === index
      const head = heads[index]
      let look = Math.sin(time * 0.45 + index * 1.3) * 0.22
      if (mine && t >= GATE_AT && head) {
        const toward = Math.atan2(ax - head.x, az - head.z) - (stops[index + 1]?.turn ?? 0)
        look = Math.max(-1.1, Math.min(1.1, toward))
      }
      clerk.head.rotation.y += (look - clerk.head.rotation.y) * drift
      const speaking = mine && t >= RECORDED_AT
      const pointer = pointers[index]
      if (pointer && head) {
        pointer.visible = speaking
        pointer.position.y = head.y + 0.72 + Math.sin(time * 4) * 0.06
      }
      clerk.arms.forEach((arm, hand) => {
        arm.rotation.x = speaking && hand === 0 ? 1.5 : 0.45
      })
      clerk.fore.forEach((lower, hand) => {
        lower.rotation.x =
          speaking && hand === 0
            ? 1 + Math.sin(time * 5) * 0.3
            : 1.05 + Math.sin(time * 11 + index * 2 + hand * 1.7) * 0.09
      })
    })

    crowd.forEach(({ who, home, role }, index) => {
      if (role === 'walks') {
        // Walks a stretch of the hall and turns back.
        const phase = time * 0.22 + index * 1.7
        who.root.position.z = home + Math.sin(phase) * 4
        who.root.rotation.y = Math.cos(phase) > 0 ? Math.PI : 0
        pose(who, Math.sin(time * 6.5 + index), 0, drift)
        who.root.position.y = Math.abs(Math.sin(time * 6.5 + index)) * 0.03
      } else if (role === 'sits') {
        // Types, and now and then turns to the colleague.
        who.arms.forEach((arm) => {
          arm.rotation.x = 0.5
        })
        who.fore.forEach((lower, hand) => {
          lower.rotation.x = 1 + Math.sin(time * 10 + index * 2 + hand * 1.7) * 0.1
        })
        who.head.rotation.y = Math.max(0, Math.sin(time * 0.35 + index)) * 0.7
      } else {
        // Stands beside, talks with one hand, nods.
        pose(who, 0, 0, drift)
        const arm = who.arms[0]
        const lower = who.fore[0]
        if (arm && lower) {
          arm.rotation.x = 0.5 + Math.sin(time * 2.6 + index) * 0.14
          lower.rotation.x = 1.1 + Math.sin(time * 3.1 + index) * 0.35
        }
        who.head.rotation.x = Math.sin(time * 1.3 + index) * 0.07
        who.head.rotation.y = Math.sin(time * 0.5 + index) * 0.2
        who.root.position.y = Math.sin(time * 1.6 + index) * 0.008
      }
    })
    invoice.position.copy(here)
    invoice.rotation.set(lean, turn + Math.sin(time * 0.8) * 0.03, 0)
    invoice.scale.setScalar(size)
    marks.forEach((mark, index) => {
      mark.visible = index < recorded
    })
    stamp.visible = recorded > 0
    feed.rotation.x = beat === 0 ? t * 30 : 0
    if (beat === 0 && t < 0.98) {
      printerLamp.color.copy(busy).lerp(line, 0.5 + 0.5 * Math.sin(time * 14))
    } else {
      printerLamp.color.copy(done)
    }

    machines.forEach((machine, index) => {
      const taking = snap.station === index && t >= ENTER_AT && t < RECORDED_AT
      const finished = index < recorded
      const into = taking ? (t - ENTER_AT) / (RECORDED_AT - ENTER_AT) : 0
      shade.copy(finished ? done : taking ? busy : line)
      if (taking) shade.lerp(line, 0.5 + 0.5 * Math.sin(time * 14))
      machine.screen.color.copy(shade)
      const amount = finished ? 1 : ease(into)
      if (machine.kind === 0) machine.moving.position.z = 0.55 - amount * 0.5
      else if (machine.kind === 1) machine.moving.position.z = 0.1 + amount * 1.05
      else if (machine.kind === 2 && dock) {
        // The dock is not scrubbed by the scroll: once the sale reaches the
        // rack it plays through in real time, so it moves like machinery.
        // Scrolled back before this stop: the van backs in, the barrier comes
        // down and the carton goes back on its shelf — the same machinery,
        // unwinding, not a jump cut.
        if (taking || finished) dock.clock = time === 0 ? 8 : Math.min(8, dock.clock + step)
        else dock.clock = time === 0 ? 0 : Math.max(0, dock.clock - step * 3)
        const clock = dock.clock
        const onto = ease(clamp01(clock / 0.9))
        const down = ease(clamp01((clock - 0.9) / 1.6))
        const load = ease(clamp01((clock - 2.5) / 1))
        const raise = ease(clamp01((clock - 3.3) / 0.9))
        const go = clamp01((clock - 4.1) / 3.4)
        // Pulls away slowly, then gathers speed.
        const run = go * go * 30
        const height = 2.2 - down * 1.52
        dock.lift.position.y = height
        dock.carton.position.set(dock.out * (onto * 1.75 + load * 2.3), height + 0.32, -1.1)
        dock.carton.visible = load < 0.97
        dock.arm.rotation.x = -raise * 1.32
        dock.van.position.x = 4.6 + run
        dock.van.position.y = go > 0 && go < 1 ? Math.sin(time * 30) * 0.008 : 0
        dock.wheels.forEach((wheel) => {
          wheel.rotation.y = -run * 2.9
        })
        dock.puffs.forEach((puff, cloud) => {
          const life = (clock * 1.4 + cloud / dock.puffs.length) % 1
          puff.visible = go > 0 && go < 1
          puff.position.set(2.7 + run - life * 1.7, 0.45 + life * 1, -0.55)
          puff.scale.setScalar(0.5 + life * 1.8)
          const material = dock.smoke[cloud]
          if (material) material.opacity = (1 - life) * 0.45
        })
      } else if (machine.kind === 4) machine.moving.scale.y = 0.2 + amount * 0.8

      // The board fills in row by row while the sale goes in. It is repainted
      // only when the number of rows or its state changes — never every frame.
      const board = boards[index]
      if (board?.ctx) {
        const rows = board.model.rows.length
        const shown = finished ? rows : Math.min(rows, Math.floor(into * (rows + 1)))
        const code = (finished ? 48 : taking ? 32 : snap.station === index ? 16 : 0) + shown
        if (code !== board.showing) {
          paintBoard(
            board.ctx,
            board.model,
            shown,
            finished ? 'done' : taking ? 'working' : snap.station === index ? 'next' : 'idle',
            journeyState.recorded,
            palette,
          )
          board.texture.needsUpdate = true
          board.showing = code
        }
      }
    })

    // A gate opens as the agent comes to it and shuts behind; its light is the
    // machine's answer about that station, nothing the gate decides itself.
    const swing = first ? 1 : 1 - Math.exp(-step * 9)
    gates.forEach((gate, index) => {
      const state = snap.gates[index]
      const wanted = state === 'open' && t < ARRIVE_AT ? 1 : 0
      gate.open += (wanted - gate.open) * swing
      gate.leaves.forEach((hinge, half) => {
        hinge.rotation.y = (half === 0 ? 1 : -1) * gate.open * 1.5
      })
      gate.lamp.color.copy(state === 'closed' ? warm : done)
    })

    const blast = beat > stations ? clamp01((t - BURST_AT) / (FINALE_AT - BURST_AT)) : 0
    const hum = 1 + Math.sin(time * 2.4) * 0.04
    sunMaterial.color.copy(line).lerp(busy, recorded / stations)
    // The burst: a flash, the parts drift outward and fade, sparks fly and
    // die. What is left is a quiet glow — nothing that crosses the invitation.
    const gone = 1 - blast
    const flash = Math.sin(blast * Math.PI)
    sunMaterial.opacity = gone
    cageMaterial.opacity = gone
    shell.forEach((material) => {
      material.opacity = gone
    })
    haloMaterial.opacity = (0.05 + (recorded / stations) * 0.12) * gone + blast * 0.2
    heart.scale.setScalar(hum * (1 + flash * 0.8))
    heart.rotation.set(time * 0.4, time * 0.6, 0)
    cage.rotation.set(-time * 0.3, time * 0.2, 0)
    cage.scale.setScalar(1 + blast * 1.1)
    halo.scale.setScalar(hum + blast * 0.9)
    rings.forEach((ring, index) => {
      // Each ring turns on its own axis, faster the more stops have fed it.
      const turnBy = time * (0.3 + index * 0.2 + (recorded / stations) * 0.8) * (1 + flash * 3)
      ring.rotation.set(
        index === 0 ? turnBy : 1.1 * index,
        index === 1 ? turnBy : 0.5,
        index === 2 ? turnBy : 0,
      )
      ring.scale.setScalar(1 + blast * (0.5 + index * 0.25))
    })
    fins.forEach(({ piece, x, y }) => {
      piece.position.set(x * (1 + blast * 1.4), y * (1 + blast * 1.4), 0)
    })
    sparkMaterial.opacity = flash
    for (let index = 0; index < sparks * 3; index++) {
      sparkPositions.array[index] = (directions[index] ?? 0) * blast * 15
    }
    sparkPositions.needsUpdate = true

    // The pool of light stands over whatever the story is about now.
    const under = beat > stations ? null : (stops[beat] ?? origin)
    if (under) focus.set(under.x, 1.4, under.z)
    else focus.copy(end)
    pool.target.position.lerp(focus, drift)
    pool.position.set(pool.target.position.x, hall.height - 0.6, pool.target.position.z + 3)
    spill.position.x = pool.target.position.x
    spill.position.z = pool.target.position.z
    rim.position.set(ax, 2.7, az + 1.4)

    // ── Camera ──
    // Each beat has an authored shot. The frame is fitted to the part of the
    // screen the page's text leaves free, and the picture is shifted so the
    // subject sits in the middle of THAT, not of the whole screen.
    const canvas = renderer.domElement
    const width = canvas.clientWidth || 1
    const height = canvas.clientHeight || 1
    const aspect = width / height
    const portrait = aspect < 0.8
    const free = journeyState.free
    const room = free.bottom - free.top
    let middle = (free.top + free.bottom) / 2
    if (beat === 0) {
      shotPose(OPENING_SHOT, t, portrait, framing)
      const back = Math.max(framing.distance, fitDistance(4.4, 3.6, camera.fov, aspect, room))
      eyeOffset(framing, Math.min(MAX_DISTANCE, back), flow, offset)
      wantAim.set(0, 1.8, 0.3)
    } else if (beat <= stations) {
      const stop = stops[beat] ?? origin
      const id = JOURNEY_STATIONS[(beat - 1) % JOURNEY_STATIONS.length]
      const shot = id ? STATION_SHOTS[id] : OPENING_SHOT
      const road = -Math.sign(stop.x) || 1
      if (t < GATE_AT) {
        // On the way: the camera walks with the agent.
        // From the side away from the station just left, so that machine is not in the way.
        framing.yaw = -shot.yaw * 0.3
        framing.pitch = 5
        const back = fitDistance(3.6, 5, camera.fov, aspect, room) * 1.1
        eyeOffset(framing, Math.min(MAX_DISTANCE, back), road, offset)
        wantAim.set(ax, 2.5, az - 2.5)
      } else {
        shotPose(shot, (t - GATE_AT) / (RECORDED_AT - GATE_AT), portrait, framing)
        const wide = fitDistance(mobile ? 4.3 : 5.4, 5.3, camera.fov, aspect, room)
        eyeOffset(framing, Math.min(MAX_DISTANCE, Math.max(framing.distance, wide)), road, offset)
        wantAim.set(stop.x, 3.75, stop.z - 0.7)
      }
    } else {
      // The core has a shot of its own: straight on, close, nothing between
      // it and the camera, pushing in until it bursts.
      offset.x = 0
      offset.y = -0.4
      offset.z = 15 - ease(clamp01(t / FINALE_AT)) * 3.5
      wantAim.copy(end)
      middle = 0.5
    }
    // Never through a wall or the ceiling.
    const reachX = hall.halfWidth - 1.2
    wantEye.set(
      Math.min(reachX, Math.max(-reachX, wantAim.x + offset.x)),
      Math.min(H_CLEAR, Math.max(1.2, wantAim.y + offset.y)),
      Math.min(hall.front - 1.2, wantAim.z + offset.z),
    )
    eye.lerp(wantEye, drift)
    aim.lerp(wantAim, drift)
    camera.position.copy(eye)
    camera.lookAt(aim)

    view.lift += (0.5 - middle - view.lift) * drift
    const shift = Math.round(view.lift * height)
    if (shift !== view.shift || width !== view.width || height !== view.height) {
      camera.setViewOffset(width, height, 0, shift, width, height)
      view.shift = shift
      view.width = width
      view.height = height
    }

    // The speech bubble stands over the head of whoever is speaking.
    const element = journeyState.bubble
    if (element) {
      const speaker = snap.station !== null && t >= RECORDED_AT ? heads[snap.station] : undefined
      if (speaker) {
        camera.updateMatrixWorld()
        anchor.copy(speaker)
        anchor.y += 1.05
        anchor.project(camera)
        const x = Math.round(Math.min(width - 180, Math.max(180, (anchor.x * 0.5 + 0.5) * width)))
        const y = Math.round(
          Math.min(height * 0.62, Math.max(170, (-anchor.y * 0.5 + 0.5) * height)),
        )
        if (!bubble.on || x !== bubble.x || y !== bubble.y) {
          element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
          element.style.opacity = '1'
          bubble.on = true
          bubble.x = x
          bubble.y = y
        }
      } else if (bubble.on) {
        element.style.opacity = '0'
        bubble.on = false
      }
    }
  }
}

export default setup
