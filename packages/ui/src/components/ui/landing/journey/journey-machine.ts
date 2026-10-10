// packages/ui/src/components/ui/landing/journey/journey-machine.ts
//
// The one place that decides WHERE THE STORY IS.
//
// Input: a single number, how far the visitor has scrolled through the journey
// (0 → 1), and the number of stations. Output: which beat is on screen, which
// station is active, what phase it is in, which gates have opened, how many
// stations have recorded the invoice. The caption, the route, the camera, the
// machines and the invoice all read this — none of them keeps a timer of its
// own, so scrubbing backward or jumping from the rail can never leave two of
// them in different moments.
//
// Pure: no React, no Three, no clock. The same input always gives the same
// answer, which is what makes it testable and makes a reverse scrub exact.

/** The stations a sale passes through, in order. The count of everything comes from here. */
export const JOURNEY_STATIONS = ['pay', 'cash', 'stock', 'post', 'report'] as const
export type JourneyStationId = (typeof JOURNEY_STATIONS)[number]

export type JourneyPhase =
  'approaching' | 'gate-opening' | 'arrived' | 'handoff' | 'speaking' | 'leaving'

/** Within one station's beat (0 → 1): when each phase begins. */
// The agent reaches the gate on the road a third of the way into the beat, so
// the gate has to start opening before that.
export const GATE_AT = 0.22
export const ARRIVE_AT = 0.46
/** The invoice starts going into the slot. */
export const ENTER_AT = 0.5
/** The machine has recorded it. */
export const RECORDED_AT = 0.68
/** The invoice comes back out. */
export const LEAVE_AT = 0.8

/** In the ending: the core bursts, and once it has, the invitation appears. */
export const BURST_AT = 0.42
export const FINALE_AT = 0.8

export type GateState = 'closed' | 'open' | 'passed'
export type ZoneState = 'visited' | 'current' | 'upcoming'

export interface JourneySnapshot {
  /** 0 is the opening (the printer), 1…n the stations, n + 1 the ending. */
  beat: number
  beats: number
  /** Progress inside the beat, 0 → 1. */
  local: number
  /** Index of the active station, or null in the opening and the ending. */
  station: number | null
  phase: JourneyPhase
  /** How many stations have recorded the invoice so far. */
  recorded: number
  gates: GateState[]
  zones: ZoneState[]
  finished: boolean
  /** The core has burst: the closing invitation may show. */
  invited: boolean
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

function phaseAt(local: number): JourneyPhase {
  if (local < GATE_AT) return 'approaching'
  if (local < ARRIVE_AT) return 'gate-opening'
  if (local < ENTER_AT) return 'arrived'
  if (local < RECORDED_AT) return 'handoff'
  if (local < LEAVE_AT) return 'speaking'
  return 'leaving'
}

function blank(stations: number): JourneySnapshot {
  return {
    beat: 0,
    beats: stations + 2,
    local: 0,
    station: null,
    phase: 'approaching',
    recorded: 0,
    gates: Array.from({ length: stations }, (): GateState => 'closed'),
    zones: Array.from({ length: stations }, (): ZoneState => 'upcoming'),
    finished: false,
    invited: false,
  }
}

/**
 * The same answer as `journeyAt`, written into a snapshot that already exists.
 * The 3D scene asks sixty times a second; it must not make garbage to do so.
 */
export function journeyInto(
  progress: number,
  stations: number,
  out: JourneySnapshot,
): JourneySnapshot {
  const beats = stations + 2
  const position = Math.min(beats - 1e-6, clamp01(progress) * beats)
  const beat = Math.floor(position)
  const local = position - beat
  const station = beat >= 1 && beat <= stations ? beat - 1 : null
  const recorded =
    beat === 0 ? 0 : beat > stations ? stations : beat - 1 + (local >= RECORDED_AT ? 1 : 0)

  out.beat = beat
  out.beats = beats
  out.local = local
  out.station = station
  out.phase = station === null ? (beat === 0 ? 'approaching' : 'leaving') : phaseAt(local)
  out.recorded = recorded
  out.finished = beat > stations
  out.invited = beat > stations && local >= FINALE_AT
  out.gates.length = stations
  out.zones.length = stations
  for (let index = 0; index < stations; index++) {
    out.gates[index] =
      index < recorded ? 'passed' : index === station && local >= GATE_AT ? 'open' : 'closed'
    out.zones[index] = index < recorded ? 'visited' : index === station ? 'current' : 'upcoming'
  }
  return out
}

export function journeyAt(progress: number, stations: number): JourneySnapshot {
  return journeyInto(progress, stations, blank(stations))
}

export const newJourneySnapshot = blank
/**
 * Where to scroll so that beat `beat` is on screen with its machine already
 * showing the result — what a click on the route asks for.
 */
export function progressForBeat(beat: number, stations: number): number {
  const beats = stations + 2
  const wanted = Math.min(beats - 1, Math.max(0, Math.round(beat)))
  return (wanted + (wanted === 0 ? 0 : wanted === beats - 1 ? 0.99 : 0.9)) / beats
}

export type JourneyEvent =
  | { type: 'scroll'; progress: number }
  | { type: 'select'; beat: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'skip' }
  | { type: 'reset' }

/** The journey's only state is how far along it is; every event resolves to that. */
export function journeyReduce(progress: number, event: JourneyEvent, stations: number): number {
  const beat = journeyAt(progress, stations).beat
  switch (event.type) {
    case 'scroll':
      return clamp01(event.progress)
    case 'select':
      return progressForBeat(event.beat, stations)
    case 'next':
      return progressForBeat(beat + 1, stations)
    case 'previous':
      return progressForBeat(beat - 1, stations)
    case 'skip':
      return 1
    case 'reset':
      return 0
  }
}
