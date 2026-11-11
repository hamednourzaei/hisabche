'use client'

// ============================================
// «کسب‌وکارت چطور کار می‌کند؟» — the adaptive questions that decide the
// business's Operational DNA (V54 5.3).
//
// ONE component, two places: the onboarding wizard (first time) and
// Settings → «پروفایل کاری» (the business grows: a solo nail technician hires
// staff, a shop opens a second branch). Which questions appear comes from the
// shared `operatingQuestionsFor` — production and the counter are asked only of
// a business that keeps stock. Every answer can stay «نمی‌دانم»; the trade's
// own default then applies.
//
// ⚠️ The answers SUGGEST a menu and defaults. They grant or remove no
// permission and change no recorded document.
// ============================================

import {
  operatingQuestionsFor,
  type OperatingAnswers,
  type OperatingQuestion,
} from '@hisabche/validation'
import { useTerminology } from '../../../hooks/use-terminology'
import { SegmentedControl } from '../segmented-control'

const YES_NO = ['yes', 'no', 'unknown'] as const
const LOCATIONS = ['single', 'multiple', 'unknown'] as const
const STAFF_ARRANGEMENTS = [
  'fixed_salary',
  'hourly',
  'commission',
  'shift',
  'mixed',
  'unknown',
] as const

export interface OperatingQuestionsProps {
  /** The answers to show: the person's own, the trade's suggestions under them. */
  answers: OperatingAnswers
  onAnswer: (question: OperatingQuestion, answer: string) => void
  t: (key: string, fallback?: string) => string
}

export function OperatingQuestions({ answers, onAnswer, t }: OperatingQuestionsProps) {
  const { term, isUnresolved } = useTerminology()
  const questions = operatingQuestionsFor(answers)
  return (
    <ul
      className="space-y-3"
      data-operating-questions
      data-terminology-unresolved={isUnresolved ? 'true' : 'false'}
    >
      {questions.map((question) => {
        const values =
          question === 'locations'
            ? LOCATIONS
            : question === 'staffArrangement'
              ? STAFF_ARRANGEMENTS
              : YES_NO
        const current = (answers[question] ?? 'unknown') as (typeof values)[number]
        const terminologySuffix =
          question === 'staffArrangement'
            ? ` (${term('operatorLabelKey', t('common.staff', 'Staff'))})`
            : question === 'producesGoods'
              ? ` (${term('itemLabelKey', t('common.item', 'Item'))})`
              : ''
        return (
          <li
            key={question}
            className="flex flex-col gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
              {t(`onboarding.operating.questions.${question}`, question)}
              {terminologySuffix}
            </span>
            <SegmentedControl
              label={t(`onboarding.operating.questions.${question}`, question)}
              options={values.map((value) => ({
                value,
                label: t(`onboarding.operating.answers.${value}`, value),
              }))}
              value={current}
              onChange={(value) => onAnswer(question, value)}
            />
          </li>
        )
      })}
    </ul>
  )
}
