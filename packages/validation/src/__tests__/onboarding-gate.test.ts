// PART 7 hard gate: completion is a SERVER decision from server-owned facts,
// never a flag set because a browser reached the last wizard screen.

import { describe, expect, it } from 'vitest'
import {
  evaluateOnboardingActivation,
  ONBOARDING_STATES,
  progressStateAllowsActivation,
  type OnboardingActivationFacts,
} from '../schemas/onboarding-gate.domain'

const complete: OnboardingActivationFacts = {
  profileFullName: 'Ahmad',
  profileBusinessName: 'Hisabche Shop',
  hasWorkspace: true,
  workspaceBusinessName: 'Hisabche Shop',
  defaultCurrency: 'AFN',
}

describe('server-authoritative onboarding activation (PART 7)', () => {
  it('a fully configured account may activate and is READY_TO_ACTIVATE', () => {
    const r = evaluateOnboardingActivation(complete)
    expect(r.canActivate).toBe(true)
    expect(r.state).toBe('READY_TO_ACTIVATE')
    expect(r.missing).toEqual([])
  })

  it('no identity and no workspace is NOT_STARTED and cannot activate', () => {
    const r = evaluateOnboardingActivation({
      profileFullName: null,
      profileBusinessName: null,
      hasWorkspace: false,
      workspaceBusinessName: null,
      defaultCurrency: null,
    })
    expect(r.canActivate).toBe(false)
    expect(r.state).toBe('NOT_STARTED')
    expect(r.missing).toEqual(['IDENTITY', 'WORKSPACE'])
  })

  it('each missing mandatory prerequisite is named and blocks activation', () => {
    expect(
      evaluateOnboardingActivation({
        ...complete,
        profileFullName: null,
        profileBusinessName: null,
      }).missing,
    ).toContain('IDENTITY')
    expect(evaluateOnboardingActivation({ ...complete, hasWorkspace: false }).missing).toContain(
      'WORKSPACE',
    )
    expect(
      evaluateOnboardingActivation({ ...complete, workspaceBusinessName: '  ' }).missing,
    ).toContain('WORKSPACE_PROFILE')
    expect(evaluateOnboardingActivation({ ...complete, defaultCurrency: '' }).missing).toContain(
      'DEFAULT_CURRENCY',
    )
  })

  it('a currency of zero-decimal AFN is a valid choice, never an invented empty', () => {
    expect(evaluateOnboardingActivation({ ...complete, defaultCurrency: 'AFN' }).canActivate).toBe(
      true,
    )
  })

  it('unreadable facts are reported and never silently satisfy a prerequisite', () => {
    const r = evaluateOnboardingActivation(complete, ['workspace_profile_read_failed'])
    expect(r.unreadable).toEqual(['workspace_profile_read_failed'])
    expect(r.canActivate).toBe(true) // caller decides policy; the fact is visible to it
  })

  it('reuses the existing progress-state vocabulary — no second state machine', () => {
    expect(ONBOARDING_STATES).toContain('READY_TO_ACTIVATE')
    expect(progressStateAllowsActivation('READY_TO_ACTIVATE')).toBe(true)
    expect(progressStateAllowsActivation('ACTIVE')).toBe(true)
    expect(progressStateAllowsActivation('IN_PROGRESS')).toBe(false)
    expect(progressStateAllowsActivation(null)).toBe(false)
  })
})
