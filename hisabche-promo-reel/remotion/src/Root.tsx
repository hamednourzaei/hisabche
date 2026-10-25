import { Composition } from 'remotion'
import { REELS } from '../../src/reels'
import audioManifest from './audio-manifest.json'
import { ReelComposition } from './ReelComposition'

// A reel only points at a track that scripts/build-remotion-audio.mjs really
// generated (remotion/public/audio). Without an entry the film is silent —
// never a broken <Audio> path.
const AUDIO = audioManifest as Record<string, string>

export const RemotionRoot = () => {
  return (
    <>
      {REELS.map((reel) => (
        <Composition
          key={reel.id}
          id={`reel-${reel.id}`}
          component={ReelComposition}
          durationInFrames={Math.max(1, Math.ceil(reel.duration * 30))}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ reelId: reel.id, audioFile: AUDIO[reel.id] ?? null }}
        />
      ))}
    </>
  )
}
