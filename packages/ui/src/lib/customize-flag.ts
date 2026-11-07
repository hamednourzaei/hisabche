// ============================================
// `?customize=1` — «open this page's wrench now».
//
// Settings → «صفحه‌ها و تب‌ها» links to a hub with this flag so the person
// lands on that hub with its customizer already open: the hub's tabs are listed
// by the hub itself (RegisterCustomizer), not by a second copy in settings.
//
// ⚠️ READ ONCE, THEN REMOVED. The web mounts two customizers (header and the
// phone row). Effects run one after another, so the first to read the flag
// removes it and the second finds nothing — one dialog, not two. Removing it
// also keeps a reload or a shared link from reopening the dialog.
//
// The desktop and mobile shells use a hash router, where the query lives inside
// `location.hash` (`#/warehouse?customize=1`); both places are read.
// ============================================

export const CUSTOMIZE_PARAM = 'customize'

/** The path a settings link opens: the page with its customizer open. */
export function customizeHref(path: string): string {
  return `${path}?${CUSTOMIZE_PARAM}=1`
}

function withoutFlag(query: string): string {
  const params = new URLSearchParams(query)
  params.delete(CUSTOMIZE_PARAM)
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

/** True once per arrival with the flag; the flag is removed from the address. */
export function consumeCustomizeFlag(): boolean {
  if (typeof window === 'undefined') return false
  const { search, hash, pathname } = window.location

  if (new URLSearchParams(search).get(CUSTOMIZE_PARAM) === '1') {
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${withoutFlag(search)}${hash}`,
    )
    return true
  }

  const hashQueryAt = hash.indexOf('?')
  if (hashQueryAt >= 0) {
    const hashQuery = hash.slice(hashQueryAt + 1)
    if (new URLSearchParams(hashQuery).get(CUSTOMIZE_PARAM) === '1') {
      const hashPath = hash.slice(0, hashQueryAt)
      window.history.replaceState(
        window.history.state,
        '',
        `${pathname}${search}${hashPath}${withoutFlag(hashQuery)}`,
      )
      return true
    }
  }
  return false
}
