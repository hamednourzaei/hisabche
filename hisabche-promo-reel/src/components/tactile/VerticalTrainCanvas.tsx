import React from 'react'
import { clamp, ease, mix, progress } from '../../engine/math'
import { DashedConnectorArrow } from './DashedConnectorArrow'

export interface TrainStation {
  id: string
  title?: string
  y: number // Y position in canvas coordinates (e.g. 0, 1000, 2000...)
  startAt: number
  dur: number
  render: (t: number) => React.ReactNode
  connectorToNext?: {
    x1?: number
    x2?: number
    curveOffset?: number
  }
}

export interface VerticalTrainCanvasProps {
  stations: TrainStation[]
  t: number
  totalDur?: number
  macroZoomStart?: number
  macroZoomEnd?: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Vertical Train-Scroll Canvas (Infinite Vertical Strip Rig)
 * Glides smoothly down stations on warm #F4F2EA grid paper, connected by
 * dashed bezier arrows, with a signature Macro Zoom-Out before the CTA!
 */
export const VerticalTrainCanvas: React.FC<VerticalTrainCanvasProps> = ({
  stations,
  t,
  totalDur = 60,
  macroZoomStart,
  macroZoomEnd,
  style,
  className = '',
}) => {
  const n = stations.length
  const lastStation = stations[n - 1]
  const maxY = lastStation ? lastStation.y : 6000

  // Macro Zoom-Out Beat window: defaults to 82% to 89% of the timeline
  const zoomInAt = macroZoomStart ?? totalDur * 0.82
  const zoomOutAt = macroZoomEnd ?? totalDur * 0.89
  const isZoomingOut = t >= zoomInAt && t <= zoomOutAt
  const isAfterZoom = t > zoomOutAt

  // 1. Determine active station and continuous camera target Y
  let currentStationIdx = 0
  for (let i = 0; i < n; i++) {
    const s = stations[i]
    if (s && t >= s.startAt) {
      currentStationIdx = i
    }
  }

  // Calculate smooth interpolated train camera Y
  let cameraTargetY = 0
  const curr = stations[currentStationIdx] || stations[0]
  if (curr) {
    const next = stations[currentStationIdx + 1]
    const stationProgress = clamp((t - curr.startAt) / Math.max(0.1, curr.dur))
    // Lead into next station during last 25% of current station
    if (next && stationProgress > 0.75) {
      const transitP = ease((stationProgress - 0.75) / 0.25)
      cameraTargetY = mix(curr.y, next.y, transitP)
    } else {
      cameraTargetY = curr.y
    }
  }

  // 2. Macro Zoom-Out calculation
  let cameraScale = 1
  let cameraY = cameraTargetY

  if (isZoomingOut) {
    const durIn = 0.8
    const durOut = 0.8
    const inP = ease(clamp(progress(t, zoomInAt, durIn)))
    const outP = ease(clamp(progress(t, zoomOutAt - durOut, durOut)))

    // Overview scale to see all stations simultaneously in 960px frame
    const overviewScale = Math.max(0.12, Math.min(0.18, 900 / (maxY + 960)))
    const overviewY = maxY * 0.5

    if (t < zoomOutAt - durOut) {
      cameraScale = mix(1, overviewScale, inP)
      cameraY = mix(cameraTargetY, overviewY, inP)
    } else {
      // Rapid zoom in to the final CTA station
      const finalY = lastStation ? lastStation.y : cameraTargetY
      cameraScale = mix(overviewScale, 1, outP)
      cameraY = mix(overviewY, finalY, outP)
    }
  } else if (isAfterZoom) {
    cameraScale = 1
    cameraY = lastStation ? lastStation.y : cameraTargetY
  }

  return (
    <div
      className={`vertical-train-canvas ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#070a12',
        direction: 'rtl',
        ...style,
      }}
    >
      {/* 1. Infinite Grid-Paper Backdrop */}
      <div
        className="train-grid-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          backgroundPosition: `center ${-cameraY % 80}px`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* 2. Dark Obsidian Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.8) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* 3. The Continuous Vertical Train Canvas Stage */}
      <div
        className="train-stage"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 540,
          height: maxY + 1200,
          transformOrigin: '270px 480px',
          transform: `translateY(${-cameraY}px) scale(${cameraScale})`,
          transition: 'none',
          zIndex: 3,
        }}
      >
        {/* Render Animated Dashed Connectors between Stations */}
        {stations.map((s, idx) => {
          if (idx >= n - 1) return null
          const next = stations[idx + 1]
          if (!next) return null

          const cfg = s.connectorToNext || {}
          const x1 = cfg.x1 ?? 270
          const x2 = cfg.x2 ?? 270
          const y1 = s.y + 700
          const y2 = next.y + 120

          // Connectors start animating when reaching transition window
          const startConnAt = s.startAt + s.dur * 0.65

          return (
            <DashedConnectorArrow
              key={`conn-${s.id}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              curveOffset={cfg.curveOffset ?? (idx % 2 === 0 ? 90 : -90)}
              strokeColor="#121D35"
              t={t}
              startAt={startConnAt}
              dur={s.dur * 0.35}
            />
          )
        })}

        {/* Render Vertical Stations */}
        {stations.map((station, idx) => {
          const localStationT = Math.max(0, t - station.startAt)
          return (
            <div
              key={station.id}
              className={`train-station station-${idx + 1}`}
              style={{
                position: 'absolute',
                top: station.y,
                left: 0,
                width: 540,
                height: 960,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                padding: '40px 24px',
              }}
            >
              {station.render(localStationT)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
