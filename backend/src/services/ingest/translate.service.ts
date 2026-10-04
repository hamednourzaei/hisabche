// ============================================
// backend/src/services/ingest/translate.service.ts
//
// Capability #20 — translating the text of a financial document.
//
// The RULES are the domain's (`translateDocument`): every figure is taken out
// of the text before the model sees it and put back from the SOURCE afterwards,
// and a translation whose figure markers did not all come back is refused.
// This file only supplies the provider and the bookkeeping:
//
//   · the provider is the ONE configured AI provider (`AiSettingsService`),
//     called through the one client (`callProvider`). There is no second
//     vendor, key or setting for translation.
//   · NOT CONFIGURED IS AN ANSWER, not an error to dress up: `AI_NOT_CONFIGURED`.
//   · a translation spends the same monthly allowance as a question, and is
//     checked BEFORE the provider is called.
//
// ⚠️ THE DOCUMENT IS NOT STORED. The usage row says that a translation was
// made, between which languages and how long the text was — not what it said.
// The AI log is read by the platform owner; a shop's invoice text is not theirs.
//
// ⚠️ NOTHING IS READ FROM THE DATABASE FOR THE MODEL. The text is what the
// person sent, and the result goes back to that person and nowhere else.
// ============================================

import { supabase } from '../../db'
import { ValidationError } from '../../errors/validation.error'
import { AiQuotaService, type QuotaStatus } from '../ai/ai-quota.service'
import { AiSettingsService, type AiProviderConfig } from '../ai/ai-settings.service'
import { callProvider } from '../ai/provider-client'
import type { TenancyContext } from '../tenancy.service'
import {
  translateDocument,
  type SupportedLocale,
  type TextTranslator,
  type TranslateVerdict,
} from './translate.domain'

const LANGUAGE_NAME: Record<SupportedLocale, string> = {
  fa: 'Persian (Iran)',
  af: 'Dari (Afghanistan)',
  en: 'English',
}

/**
 * What the model is told. The markers are named so it leaves them alone; the
 * post-condition in the domain is what actually enforces it.
 */
export function translationPrompt(from: SupportedLocale, to: SupportedLocale): string {
  return [
    `Translate the business document below from ${LANGUAGE_NAME[from]} to ${LANGUAGE_NAME[to]}.`,
    'Rules:',
    '1. Markers of the form ⟦fig-0⟧, ⟦fig-1⟧ … stand for numbers. Copy every marker exactly as it is, once for each time it appears. Never translate, remove, renumber or add one.',
    '2. Keep product codes, SKUs, names of people and companies, and line breaks as they are.',
    '3. Reply with the translation only — no notes, no quotation marks, no explanation.',
  ].join('\n')
}

export interface TranslateProvider {
  getConfig(): Promise<AiProviderConfig | null>
}
export interface TranslateQuota {
  status(ctx: TenancyContext): Promise<QuotaStatus>
}
export type ProviderCall = typeof callProvider

export class DocumentTranslateService {
  constructor(
    private readonly settings: TranslateProvider = new AiSettingsService(),
    private readonly quota: TranslateQuota = new AiQuotaService(),
    private readonly call: ProviderCall = callProvider,
  ) {}

  async translate(
    ctx: TenancyContext,
    input: { text: string; from: SupportedLocale; to: SupportedLocale },
  ): Promise<{ verdict: TranslateVerdict; quota: QuotaStatus }> {
    const config = await this.settings.getConfig()
    if (!config) throw new ValidationError('AI_NOT_CONFIGURED')

    const quota = await this.quota.status(ctx)
    if (quota.remaining <= 0) throw new ValidationError('AI_QUOTA_EXCEEDED')

    const started = Date.now()
    let providerCalled = false
    const translator: TextTranslator = {
      translate: async ({ text, from, to }) => {
        providerCalled = true
        return this.call(config, {
          system: translationPrompt(from, to),
          user: text,
          // A translation is about as long as its source; the default 2048
          // would cut a full-length document off mid-sentence.
          maxTokens: 4096,
        })
      },
    }

    const verdict = await translateDocument(input.text, input.from, input.to, translator)

    // A refusal made BEFORE the provider was asked cost nothing and is not
    // counted; one made after (the figures came back altered) was paid for.
    if (providerCalled) {
      await this.log(ctx, config, {
        from: input.from,
        to: input.to,
        characters: input.text.length,
        outcome: verdict.kind === 'translated' ? 'translated' : verdict.reason,
        latencyMs: Date.now() - started,
      })
    }

    return { verdict, quota: providerCalled ? await this.quota.status(ctx) : quota }
  }

  /**
   * One row in the AI log — which is also the allowance counter. A logging
   * failure does not fail the translation, but it is not silent: a lost row is
   * a free call.
   */
  private async log(
    ctx: TenancyContext,
    config: AiProviderConfig,
    entry: {
      from: SupportedLocale
      to: SupportedLocale
      characters: number
      outcome: string
      latencyMs: number
    },
  ): Promise<void> {
    const { error } = await supabase.from('ai_query_log').insert({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.userId,
      question_text: `[document translation ${entry.from} → ${entry.to}, ${entry.characters} characters]`,
      answer_text: `[${entry.outcome}]`,
      // No view or function was read: the text came from the person.
      resolved_views_or_functions: [],
      model_provider: config.provider,
      model_name: config.model,
      latency_ms: entry.latencyMs,
    })
    if (error) console.error('[DocumentTranslateService] failed to write ai_query_log:', error)
  }
}

export const documentTranslateService = new DocumentTranslateService()
