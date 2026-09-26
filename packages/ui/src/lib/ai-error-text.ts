// What the assistant says when a question could not be answered — one place
// for the popup launcher and the full /assistant page.
//
// ⚠️ A busy provider is not a broken assistant. OpenRouter's free models are
// a shared pool and answer 429 when it is full; the server retries, then
// answers AI_PROVIDER_BUSY (503). Saying «try again in a moment» is true;
// «I could not answer» made the owner think the setup was wrong.

type Translate = (key: string, fallback: string) => string

export function aiErrorText(error: unknown, tr: Translate): string {
  const code = (error as { code?: unknown; response?: { data?: { code?: unknown } } } | null)?.code
  if (code === 'AI_PROVIDER_BUSY') {
    return tr('ai.busy', 'مدل هوش مصنوعی همین حالا شلوغ است. چند لحظه‌ی دیگر دوباره بپرسید.')
  }
  if (code === 'AI_READER_NOT_CONFIGURED') {
    // A server setting, not the user's doing — said plainly, once.
    return tr(
      'ai.notReady',
      'دستیار روی سرور هنوز کامل راه‌اندازی نشده است. لطفاً به پشتیبانی خبر دهید.',
    )
  }
  return tr('ai.error', 'نتوانستم پاسخ بدهم. لطفاً دوباره تلاش کنید.')
}
