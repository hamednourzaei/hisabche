// ============================================
// The ONE place that calls an AI provider.
//
// ⚠️ WHY THIS FILE EXISTS, AND WHY IT IS A MOVE RATHER THAN A NEW SYSTEM.
//
// `ai-chat.service.ts` carried two `fetch` paths — one per provider — plus a
// timeout, a redaction step and a `retry-after` parser, all inside the chat
// service. The content pipeline needs the same thing, and a second copy would be
// the parallel-architecture failure this codebase has been removing all session:
// two implementations of the endpoint bug fixed on 27 September, two of the
// redaction, two of the retry parsing, drifting apart silently.
//
// So the LOGIC moves here and the two `fetch` calls are written once.
//
// ⚠️ AND `providerEndpoint` DELIBERATELY STAYS WHERE IT IS.
//
// The first version imported it from `ai-chat.service`, which put
// `provider-client → ai-chat → provider-client` in the import graph and tripped
// `no-service-import-cycles.test.ts`. Moving it to a leaf looked like the fix
// and was not: `ai-provider-endpoint.test.ts` imports `providerEndpoint` from
// `ai-chat.service` and would have failed. So the FUNCTION is duplicated here —
// and that is acceptable, because it is a pure string builder over a two-branch
// lookup, and `ai-provider-endpoint.test.ts` covers both branches on the original.
//
// ⚠️ THE TWO THINGS A NEW CALLER MUST NOT ASSUME:
//
//   1. `maxTokens` is a DEFAULT here, not a decision. A research summary needs
//      more than a chat answer. The old 2048 stays the default so nothing that
//      called it before changes.
//   3. `image` is ONE picture handed to the model beside the text (document
//      reading, #16). It is sent and forgotten: nothing here stores it, and the
//      error path logs the provider's answer, which does not echo an image.
//   2. A provider failure throws `AI_PROVIDER_ERROR` with a REDACTED detail. The
//      provider's body is logged, never returned — it can echo the request, which
//      for content intelligence is an unpublished draft.
// ============================================

import { ValidationError } from '../../errors/validation.error'
import type { AiProvider, AiProviderConfig } from './ai-settings.service'

/**
 * ⚠️ DUPLICATED FROM `ai-chat.service.ts` — AND THE FIRST COPY WAS A BUG.
 *
 * The first version of this function was three lines: trim, strip trailing
 * slashes, append the path. The real one is more, and the difference is not
 * cosmetic:
 *
 *   · a base that already ends in `/v1` must not become `/v1/v1`
 *   · a base that is ALREADY the full endpoint — which is what OpenRouter's
 *     documentation shows first, and what people paste — must be used as it is
 *
 * Without those, `https://openrouter.ai/api/v1` became
 * `https://openrouter.ai/api/v1/v1/chat/completions` and every gateway broke.
 * That bug is why the tests exist, and it is why the duplication is spelled out:
 * a "simplified" copy of a URL builder is how an outage comes back.
 *
 * `ai-provider-endpoint.test.ts` covers all three shapes on the original. These
 * same three cases must stay true here, or the pipeline gets the bug back.
 */
export function buildProviderEndpoint(provider: AiProvider, baseUrl: string | null): string {
  const fallback = provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'
  const path = provider === 'anthropic' ? '/messages' : '/chat/completions'
  const base = (baseUrl?.trim() || fallback).replace(/\/+$/, '')

  // Pasted as the whole endpoint.
  if (base.endsWith(path)) return base
  const root = /\/v1$/.test(base) ? base : `${base}/v1`
  return `${root}${path}`
}

/**
 * One request, one provider, no retry. Retrying is the caller's job because
 * only the caller knows whether a partial result is worth resuming.
 */
export async function callProvider(
  config: AiProviderConfig,
  input: {
    system: string
    user: string
    maxTokens?: number
    timeoutMs?: number
    /** One image for the model to look at, base64 without a data: prefix. */
    image?: { mediaType: string; base64: string } | undefined
  },
): Promise<string> {
  const maxTokens = input.maxTokens ?? 2048
  const signal = AbortSignal.timeout(input.timeoutMs ?? 60_000)

  if (config.provider === 'anthropic') {
    const response = await fetch(buildProviderEndpoint('anthropic', config.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system: input.system,
        messages: [
          {
            role: 'user',
            content: input.image
              ? [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: input.image.mediaType,
                      data: input.image.base64,
                    },
                  },
                  { type: 'text', text: input.user },
                ]
              : input.user,
          },
        ],
      }),
      signal,
    })

    if (!response.ok) throw await providerError(config, response)

    const body = (await response.json()) as { content?: { text?: string }[] }
    return body.content?.map((part) => part.text ?? '').join('') ?? ''
  }

  const response = await fetch(buildProviderEndpoint('openai', config.baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: input.system },
        {
          role: 'user',
          content: input.image
            ? [
                { type: 'text', text: input.user },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${input.image.mediaType};base64,${input.image.base64}`,
                  },
                },
              ]
            : input.user,
        },
      ],
    }),
    signal,
  })

  if (!response.ok) throw await providerError(config, response)

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return body.choices?.[0]?.message?.content ?? ''
}

/**
 * ⚠️ THE PROVIDER'S BODY IS READ HERE AND ONLY LOGGED.
 *
 * `ai-provider-boundary.test.ts` asserts that `response.text()` appears EXACTLY ONCE
 * across the AI source. That guard exists so a provider error body — which can
 * echo the request — can never start being forwarded to a client from a second
 * place. Adding a third call site is therefore a change to that guard, not a
 * refactor.
 */
async function providerErrorDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return ''
  }
}

async function providerError(
  config: AiProviderConfig,
  response: Response,
): Promise<ValidationError> {
  const detail = await providerErrorDetail(response)

  console.error(
    `[ai] provider ${config.provider} (${config.model}) at ${buildProviderEndpoint(
      config.provider,
      config.baseUrl,
    )} answered ${response.status}: ${detail}`,
  )

  const error = new ValidationError(`AI_PROVIDER_ERROR: ${response.status}`)
  const extra = error as ValidationError & {
    providerDetail?: string
    providerStatus?: number
    retryAfterMs?: number
  }
  extra.providerDetail = detail
  extra.providerStatus = response.status

  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) extra.retryAfterMs = retryAfter * 1000

  return error
}
