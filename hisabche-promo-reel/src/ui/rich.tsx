// ============================================
// Highlighted words inside a sentence, written in the script itself:
//   «نرم\u200cافزار [c:ابری] می\u200cخواد یا [p:سنتی]؟»
// c = cyan, p = purple, g = gradient-accent, r = red, w = white weight.
//
// Rebuilt: emphasis is a weight/ink change, not a pill or a neon glow. Class
// names are preserved for existing styles; inline tokens carry the new look.
// Rules: 11-15, 28.
// ============================================

import type { CSSProperties, ReactNode } from 'react'

import { ACCENT, MATERIAL } from './art-direction'

const STYLE: Record<string, string> = {
  c: 'hl-cyan',
  p: 'hl-purple',
  g: 'hl-gradient',
  r: 'hl-red',
  w: 'hl-white',
}

const INK: Record<string, CSSProperties> = {
  c: { color: ACCENT.cyan.solid, fontWeight: 900, textShadow: 'none' },
  p: { color: ACCENT.purple.solid, fontWeight: 900, textShadow: 'none' },
  g: { color: ACCENT.cyan.solid, fontWeight: 900, textShadow: 'none' },
  r: { color: ACCENT.red.solid, fontWeight: 900, textShadow: 'none' },
  w: { color: MATERIAL.ink, fontWeight: 900, textShadow: 'none' },
}

export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const re = /\[([cpgrw]):([^\]]+)\]/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const kind = match[1]!
    parts.push(
      <span key={key++} className={STYLE[kind]} data-mg-em={kind} style={INK[kind]}>
        {match[2]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
