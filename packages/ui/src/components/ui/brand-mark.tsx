'use client'

// ============================================
// packages/ui/src/components/ui/brand-mark.tsx
//
// The product mark, and the one path it is loaded from.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THE LOGO WAS MISSING IN THE WINDOWS BUILD
//
// Both the header and the sidebar asked for `/logo-icon.png` — a ROOT-absolute
// URL. On the web that is correct: the origin's root is where the file is.
//
// The packaged desktop renderer is not served over http. Electron loads it
// with `loadFile()`, so the document's URL is
//
//     file:///C:/Users/…/resources/app.asar/out/renderer/index.html
//
// and a root-absolute path resolves against the root of the DRIVE:
//
//     file:///C:/logo-icon.png          ← nothing there, ever
//
// The file is shipped, at `out/renderer/logo-icon.png`, right beside the HTML.
// The build was never wrong; the URL was. Everything else in that build works
// because electron-vite emits `./assets/…` for the bundles — relative — and
// only this one hand-written path was absolute.
//
// The header appeared to survive it because its mark falls back to the «ح»
// tile on error, so a missing logo looked like a design choice. The sidebar
// had no fallback and rendered the broken-image glyph, which is what was
// reported.
// ============================================

import { memo, useState } from 'react'

import { cn } from '../../lib/utils'

/**
 * Where the mark lives, for the document that is asking.
 *
 * ⚠️ DECIDED BY PROTOCOL, NOT BY PLATFORM. «Am I Electron» is the wrong
 * question — the desktop DEV server serves over http, where the root-absolute
 * path is right, and only the packaged build reads from disk. The protocol is
 * the thing that actually changes what `/` means.
 *
 * ⚠️ AND IT IS HYDRATION-SAFE. Server-side there is no `window`, so this is
 * `/logo-icon.png`; in the browser it is `/logo-icon.png` too. The two agree,
 * which is what keeps React from discarding the tree. Only `file:` differs,
 * and nothing server-renders there.
 */
export const LOGO_SRC =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? './logo-icon.png'
    : '/logo-icon.png'

/**
 * The product mark, with a real fallback.
 *
 * Two different marks for one product read as two products, so the header and
 * the sidebar render this same component rather than each drawing their own.
 */
export const BrandMark = memo(function BrandMark({
  alt,
  className,
}: {
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)]',
          className ?? 'size-8',
        )}
      >
        <span className="text-xs font-bold text-white">ح</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn('shrink-0 object-contain', className ?? 'size-8')}
    />
  )
})
BrandMark.displayName = 'BrandMark'
