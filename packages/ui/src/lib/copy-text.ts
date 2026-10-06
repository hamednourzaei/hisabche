// ============================================
// Put a piece of text on the clipboard — and say whether it got there.
//
// `navigator.clipboard` exists only in a secure context and can be refused
// (permissions, an embedded WebView, an unfocused document). Calling it as
// `navigator.clipboard?.writeText(...)` and stopping there means «copy» does
// nothing at all where it is missing — no error, no text. A value shown ONCE
// (an API key, a client secret) cannot afford that, so there is a second way:
// a temporary field, selected and copied the old way.
//
// Resolves true only when the text is on the clipboard.
// ============================================

export async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Refused: fall through to the second way.
    }
  }
  if (typeof document === 'undefined') return false

  const field = document.createElement('textarea')
  field.value = value
  // Out of sight, but still selectable: `display: none` cannot be selected.
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  field.style.top = '0'
  field.style.insetInlineStart = '0'
  document.body.appendChild(field)
  try {
    field.select()
    field.setSelectionRange(0, value.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
