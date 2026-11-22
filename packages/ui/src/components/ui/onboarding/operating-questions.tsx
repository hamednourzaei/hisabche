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
// V65 · V64 §6.2: a BRANCH and a WAREHOUSE are two different facts. This used
// to ask one question (`locations`) that meant both, and every answer label was
// the branch wording. They are now asked separately, and a warehouse can be
// answered «none» — a service business has no warehouse and must not be nudged
// to create one.
//
// ⚠️ The answers SUGGEST a menu and defaults. They grant or remove no
// permission and change no recorded document.
// ============================================

import {
  operatingQuestionsFor,
  type OperatingAnswers,
  type OperatingQuestion,
  type YesNoQuestion,
} from '@hisabche/validation'
import { useTerminology } from '../../../hooks/use-terminology'
import { SegmentedControl } from '../segmented-control'

interface AnswerOption {
  readonly value: string
  readonly labelKey: string
}

const optionsOf = (values: readonly string[], prefix: string): readonly AnswerOption[] =>
  values.map((value) => ({ value, labelKey: `${prefix}.${value}` }))

const YES_NO = optionsOf(['yes', 'no', 'unknown'], 'onboarding.operating.answers')
// ⚠️ The catalog names these answers with UNDERSCORES (`branch_single`,
// `warehouse_none`) in all three locales. The component used to build dotted
// keys (`branch.single`) that exist nowhere, so every branch/warehouse answer
// rendered its raw English value in the Persian/Dari wizard (forensic audit
// F-073, measured 22 Nov 2026). One key shape, the one the catalogs carry.
const BRANCHES: readonly AnswerOption[] = ['single', 'multiple', 'unknown'].map((value) => ({
  value,
  labelKey: `onboarding.operating.answers.branch_${value}`,
}))
const WAREHOUSES: readonly AnswerOption[] = ['none', 'single', 'multiple', 'unknown'].map(
  (value) => ({ value, labelKey: `onboarding.operating.answers.warehouse_${value}` }),
)
const STAFF_ARRANGEMENTS = optionsOf(
  ['fixed_salary', 'hourly', 'commission', 'shift', 'mixed', 'unknown'],
  'onboarding.operating.answers',
)

function optionsFor(question: OperatingQuestion): readonly AnswerOption[] {
  // `locations` is the legacy name of `branches`; a stored answer still reads.
  switch (question) {
    case 'branches':
    case 'locations':
      return BRANCHES
    case 'warehouses':
      return WAREHOUSES
    case 'staffArrangement':
      return STAFF_ARRANGEMENTS
    default: {
      // Exhaustiveness guard (F-080): a NEW question type that is not yes/no
      // fails to compile here instead of silently rendering wrong options.
      const yesNo: YesNoQuestion = question
      void yesNo
      return YES_NO
    }
  }
}

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
        const options = optionsFor(question)
        const current = (answers[question] ?? 'unknown') as string
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
              {t(`onboarding.operating.questions.${question}`)}
              {terminologySuffix}
            </span>
            <SegmentedControl
              label={t(`onboarding.operating.questions.${question}`)}
              options={options.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
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
