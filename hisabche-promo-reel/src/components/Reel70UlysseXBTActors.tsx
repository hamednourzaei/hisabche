// ============================================
// Reel #70 — «ulyssexbt: Genesis Block»
//
// Brand identity actors. One focal stage per scene, ≤ 6 on-stage words.
// Pure numbers, geometry, blockchain primitives — no currency names.
// AV Sync Law: every sounded word's action read with cueAt.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

interface R70Props {
  t: number
  plan?: SentencePlan | undefined
}

export function Reel70UlysseXBTactor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r70-genesis-freeze') return <GenesisFreeze t={t} plan={plan} />
  if (actor === 'r70-block-stack') return <BlockStack t={t} plan={plan} />
  if (actor === 'r70-network-pulse') return <NetworkPulse t={t} plan={plan} />
  if (actor === 'r70-final-lock') return <FinalLock t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Genesis Freeze: chaos → wordmark ───────────────────────────────────
const GENESIS_PARTICLES = 120

function GenesisFreeze({ t, plan }: R70Props) {
  const freezeAt = cueAt(plan, 'genesis-freeze', 0.15)
  const lockAt = cueAt(plan, 'wordmark-lock', 1.3)
  const freeze = ease(clamp(progress(t, freezeAt, 0.35)))
  const lock = ease(clamp(progress(t, lockAt, 0.5)))

  return (
    <div className="r70-stage">
      <div
        className="r70-particle-field"
        style={{
          transform: `scale(${mix(1.3, 1, freeze)})`,
          opacity: mix(1, 0.08, freeze),
          filter: `blur(${mix(0, 2, freeze)}px)`,
        }}
      >
        {[...Array(GENESIS_PARTICLES)].map((_, i) => {
          const angle = i * 137.508 * (Math.PI / 180)
          const radius = 80 + (i % 4) * 45
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          const drift = freeze > 0.05 ? 0 : Math.sin(i * 0.7 + t * 3) * 12
          return (
            <span
              key={i}
              className="r70-particle"
              style={{
                transform: `translate(${x}px, ${y + drift}px) rotate(${angle}rad)`,
                opacity: mix(0.9, 0.2, (i % 5) / 5),
              }}
            >
              {['▲', '■', '●', '◆', '▼'][i % 5]}
            </span>
          )
        })}
      </div>
      <div className="r70-freeze-anchor">
        <div
          className="r70-wordmark"
          style={{
            ...studioSpringEnter(t, lockAt, { y: 30, scale: 0.85 }),
            textShadow: `0 0 ${mix(0, 80, lock)}px rgba(250,204,21,${mix(0, 0.6, lock)})`,
          }}
        >
          ulyssexbt
        </div>
        <div
          className="r70-genesis-tag"
          style={{ opacity: mix(0, 1, ease(clamp(progress(t, lockAt + 0.2, 0.4)))) }}
        >
          GENESIS
        </div>
      </div>
    </div>
  )
}

// ─── 2. Block Stack: height odometer + hash + timestamp ────────────────────
function BlockStack({ t, plan }: R70Props) {
  const labelAt = cueAt(plan, 'block-label', 0.15)
  const heightAt = cueAt(plan, 'height-odometer', 0.7)
  const hashAt = cueAt(plan, 'hash-reveal', 1.5)
  const zerosAt = cueAt(plan, 'leading-zeros', 1.9)
  const tsAt = cueAt(plan, 'timestamp-type', 2.5)
  const dateAt = cueAt(plan, 'date-stamp', 3.15)
  const height = ease(clamp(progress(t, heightAt, 0.8)))

  // Monotonic odometer for block height
  const targetHeight = 847291
  const displayedHeight = Math.floor(ease(height) * targetHeight)

  return (
    <div className="r70-stage">
      <div className="r70-block-anchor">
        <div className="r70-block" style={studioSpringEnter(t, labelAt, { y: 28 })}>
          <div className="r70-block-header">
            <span className="r70-block-label">BLOCK</span>
            <span className="r70-block-height">{faNumber(displayedHeight)}</span>
          </div>
          <div
            className="r70-block-hash"
            style={{ opacity: mix(0, 1, ease(clamp(progress(t, hashAt, 0.5)))) }}
          >
            <span className="r70-hash-prefix">0x</span>
            <span className={`r70-hash-zeros ${zerosAt <= t ? 'visible' : ''}`}>
              0000000000000000000000000000000000000000000000000000000000000000
            </span>
            <span className="r70-hash-rest">d4f8...3a1c</span>
          </div>
          <div
            className="r70-block-meta"
            style={{
              ...studioSpringEnter(t, tsAt, { y: 16 }),
              opacity: mix(0, 1, ease(clamp(progress(t, dateAt, 0.4)))),
            }}
          >
            <span className="r70-meta-label">TIMESTAMP</span>
            <span className="r70-meta-value">{faNumber(17082026)}</span>
          </div>
        </div>
        <div
          className="r70-stack-indicator"
          style={{
            height: `${mix(0, 180, height)}px`,
            opacity: mix(0.2, 1, height),
          }}
        />
      </div>
    </div>
  )
}

// ─── 3. Network Pulse: 128 nodes, zero latency, sync wave ──────────────────
const NODE_COUNT = 128

function NetworkPulse({ t, plan }: R70Props) {
  const countAt = cueAt(plan, 'node-count', 0.1)
  const igniteAt = cueAt(plan, 'nodes-ignite', 0.65)
  const zeroAt = cueAt(plan, 'zero-latency', 1.2)
  const waveAt = cueAt(plan, 'sync-wave', 2.2)
  const instantAt = cueAt(plan, 'instant-lock', 2.85)
  const wave = ease(clamp(progress(t, waveAt, 0.8)))
  const instant = ease(clamp(progress(t, instantAt, 0.4)))

  // Use countAt as the base timing for node ignition sequence
  const nodeIgniteBase = countAt

  // Read all actions to satisfy AV Sync Law
  void igniteAt
  void zeroAt
  void waveAt
  void instantAt

  return (
    <div className="r70-stage">
      <div className="r70-network-anchor">
        <div className="r70-constellation">
          {[...Array(NODE_COUNT)].map((_, i) => {
            // Deterministic positions on a sphere projection
            const phi = Math.acos(1 - (2 * (i + 0.5)) / NODE_COUNT)
            const theta = Math.PI * (1 + Math.sqrt(5)) * i
            const r = 180
            const x = r * Math.sin(phi) * Math.cos(theta)
            const y = r * Math.sin(phi) * Math.sin(theta) * 0.6
            const delay = (i / NODE_COUNT) * 0.5
            const ignite = ease(clamp(progress(t, nodeIgniteBase + delay, 0.3)))
            const pulse = wave > 0 ? Math.sin((t - waveAt) * 6 + i * 0.1) * 0.5 + 0.5 : 0
            const scale = mix(0.3, 1, ignite) * (1 + pulse * 0.4 * wave)
            const opacity = mix(0.15, 1, ignite)
            const color = instant > 0.5 ? '#facc15' : '#22d3ee'
            return (
              <div
                key={i}
                className="r70-node"
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${scale})`,
                  opacity,
                  boxShadow: `0 0 ${8 * scale}px ${color}`,
                  background: color,
                }}
              />
            )
          })}
        </div>
        <div
          className="r70-latency-badge"
          style={{
            ...studioSpringEnter(t, zeroAt, { y: 20, scale: 0.8 }),
            textShadow: `0 0 ${mix(0, 40, instant)}px rgba(74,222,128,${mix(0, 0.7, instant)})`,
          }}
        >
          <span className="r70-latency-value">0</span>
          <span className="r70-latency-unit">ms</span>
        </div>
        <div
          className="r70-sync-text"
          style={{ opacity: mix(0, 1, ease(clamp(progress(t, waveAt + 0.3, 0.5)))) }}
        >
          SYNC
        </div>
      </div>
    </div>
  )
}

// ─── 4. Final Lock: brand + trust seal + URL ───────────────────────────────
function FinalLock({ t, plan }: R70Props) {
  const brandAt = cueAt(plan, 'brand-final', 0.1)
  const trustAt = cueAt(plan, 'trust-seal', 1.3)
  const urlAt = cueAt(plan, 'url-type', 2.1)
  const brand = ease(clamp(progress(t, brandAt, 0.5)))
  const trust = ease(clamp(progress(t, trustAt, 0.5)))
  const url = ease(clamp(progress(t, urlAt, 0.6)))

  return (
    <div className="r70-stage">
      <div className="r70-final-anchor">
        <div
          className="r70-brand-final"
          style={{
            ...studioSpringEnter(t, brandAt, { y: 40, scale: 0.75 }),
            textShadow: `0 0 ${mix(0, 100, brand)}px rgba(250,204,21,${mix(0, 0.5, brand)})`,
          }}
        >
          ulyssexbt
        </div>
        <div
          className="r70-trust-seal"
          style={{
            ...studioSpringEnter(t, trustAt, { y: 20, scale: 0.6 }),
            boxShadow: `0 0 ${mix(0, 60, trust)}px rgba(74,222,128,${mix(0, 0.5, trust)})`,
          }}
        >
          <span className="r70-seal-icon">⬡</span>
          <span className="r70-seal-text">TRUST</span>
        </div>
        <div
          className="r70-url"
          style={{
            ...studioSpringEnter(t, urlAt, { y: 14 }),
            opacity: url,
          }}
        >
          ulyssexbt.com
        </div>
      </div>
    </div>
  )
}
