// Facts about this browser, for `useSyncExternalStore(noSubscription, fact, serverValue)`
// (13 Nov 2026). They do not change while the page is open, so there is nothing to
// subscribe to; the server snapshot covers SSR and the hydration render, and the
// browser is asked only after that — never copied into state from an effect.

/** A subscription that never fires: the fact is fixed for this page. */
export const noSubscription = (): (() => void) => () => undefined

/**
 * Where a shareable public link lives. The public page is on the website; a packaged
 * desktop app runs from file://, so the public site is the link's home there.
 */
export function linkOrigin(): string {
  return window.location.protocol.startsWith('http')
    ? window.location.origin
    : 'https://hisabche.com'
}

/** Whether this device offers a share sheet. */
export function canShareNow(): boolean {
  return typeof navigator.share === 'function'
}
