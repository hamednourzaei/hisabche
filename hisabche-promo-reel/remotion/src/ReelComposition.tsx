import React from 'react'
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { REELS } from '../../src/reels'
import { ReelFrame } from '../../src/ReelFrame'

type ReelCompositionProps = {
  reelId: string
  /** Path under public/ of the soundtrack the exporter designed for this reel. */
  audioFile: string | null
}

export const ReelComposition: React.FC<ReelCompositionProps> = ({ reelId, audioFile }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const reel = REELS.find((r) => r.id === reelId) ?? REELS[0]!
  const t = frame / fps

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
      <div
        style={{
          width: 540,
          height: 960,
          transform: 'scale(2)',
          transformOrigin: 'center center',
        }}
      >
        <ReelFrame reel={reel} t={t} />
      </div>
    </AbsoluteFill>
  )
}
