// What the assistant says when a question could not be answered — one place
// for the popup launcher and the full /assistant page.
//
// ⚠️ A busy provider is not a broken assistant. OpenRouter's free models are
// a shared pool and answer 429 when it is full; the server retries, then
// answers AI_PROVIDER_BUSY (503). Saying «try again in a moment» is true;
// «I could not answer» made the owner think the setup was wrong.
//
// ⚠️ The server's code is in the RESPONSE BODY (QA-AI-DOWN, 9 Nov 2026). This
// read `error.code` — axios's own «ERR_BAD_RESPONSE» — so every refusal fell
// through to the generic «could not answer», and a server that was down said
// the same as a question it did not understand.

type Translate = (key: string, fallback: string) => string

type ErrorShape = {
  code?: unknown
  response?: { status?: number; data?: { code?: unknown } }
} | null

/** The server's code first; axios's own code only when there was no reply. */
export function aiErrorCode(error: unknown): string | null {
  const shape = error as ErrorShape
  const fromServer = shape?.response?.data?.code
  if (typeof fromServer === 'string') return fromServer
  return typeof shape?.code === 'string' ? shape.code : null
}

export function aiErrorText(error: unknown, tr: Translate): string {
  const code = aiErrorCode(error)
  const status = (error as ErrorShape)?.response?.status
  if (code === 'AI_PROVIDER_BUSY') {
    return tr('ai.busy', 'مدل هوش مصنوعی همین حالا شلوغ است. چند لحظه‌ی دیگر دوباره بپرسید.')
  }
  if (code === 'AI_READER_NOT_CONFIGURED' || code === 'AI_KEY_MISSING') {
    // A server setting, not the user's doing — said plainly, once.
    return tr(
      'ai.notReady',
      'دستیار روی سرور هنوز کامل راه‌اندازی نشده است. لطفاً به پشتیبانی خبر دهید.',
    )
  }
  // No reply at all, or the server itself failing: the assistant is down,
  // not confused by the question.
  if (!status || status >= 500 || code === 'ERR_NETWORK' || code === 'ECONNABORTED') {
    return tr(
      'ai.serverDown',
      'سرور دستیار همین حالا در دسترس نیست. اتصال را بررسی کنید و کمی بعد دوباره بپرسید.',
    )
  }
  return tr('ai.error', 'نتوانستم پاسخ بدهم. لطفاً دوباره تلاش کنید.')
}
