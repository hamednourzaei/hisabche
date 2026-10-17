// ============================================
// Highlighted words inside a sentence, written in the script itself:
//   «نرم‌افزار [c:ابری] می‌خواد یا [p:سنتی]؟»
// c = cyan, p = purple, g = cyan→purple gradient, r = red, w = white bold.
// ============================================

import type { ReactNode } from 'react'

const STYLE: Record<string, string> = {
  c: 'hl-cyan',
  p: 'hl-purple',
  g: 'hl-gradient',
  r: 'hl-red',
  w: 'hl-white',
}

export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const re = /\[([cpgrw]):([^\]]+)\]/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <span key={key++} className={STYLE[match[1]!]}>
        {match[2]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
