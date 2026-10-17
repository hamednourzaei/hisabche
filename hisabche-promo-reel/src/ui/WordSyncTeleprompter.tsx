// ============================================
// Hisabche Studio — WordSyncTeleprompter
//
// Renders live, word-synchronized teleprompter subtitles.
// Highlights active words as the playhead passes their exact
// timestamps, with spring scale and luminous glow.
// Discloses exact alignment lifecycle status (provisional vs verified).
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { spring, clamp } from '../engine/anim'

interface WordSyncTeleprompterProps {
  sentence: SentencePlan
  t: number
  className?: string
  showMetadata?: boolean
}

export function WordSyncTeleprompter({
  sentence,
  t,
  className = '',
  showMetadata = true,
}: WordSyncTeleprompterProps) {
  const { words, alignmentStatus, intent } = sentence

  let statusBadgeText = 'ریتم هجاهای فارسی (تخمینی)'
  let statusBadgeClass = 'status-provisional'
  if (alignmentStatus === 'REAL_WORD_ALIGNMENT_READY') {
    statusBadgeText = 'همگام با گفتار واقعی'
    statusBadgeClass = 'status-verified'
  } else if (alignmentStatus === 'MANUAL_REVIEW_ACCEPTED') {
    statusBadgeText = 'انطباق بازبینی‌شده دستی'
    statusBadgeClass = 'status-manual-review'
  }

  return (
    <div className={`word-sync-teleprompter ${className}`}>
      {/* Clutter-free toggle: Metadata is hidden on production video canvas */}
      {showMetadata && (
        <div className="teleprompter-header-row">
          <span className={`status-badge ${statusBadgeClass}`}>{statusBadgeText}</span>
          {intent && <span className="teleprompter-intent-pill">{intent}</span>}
        </div>
      )}

      <div className="teleprompter-speech-line">
        {words.map((w, idx) => {
          const isActive = t >= w.start && t < w.end
          const isSpoken = t >= w.end

          // Kinetic spring pop upon activation
          const s = isActive ? spring(t - w.start) : 1
          const scale = isActive ? 1 + (s - 1) * 0.15 : 1

          let wordStatus = 'upcoming'
          if (isActive) wordStatus = 'active'
          else if (isSpoken) wordStatus = 'spoken'

          return (
            <span
              key={idx}
              className={`teleprompter-word ${wordStatus} ${w.emphasis ? 'emphasis' : ''}`}
              style={{
                transform: `scale(${clamp(scale, 0.95, 1.25)})`,
              }}
            >
              {w.word}
            </span>
          )
        })}
      </div>
    </div>
  )
}
