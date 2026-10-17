import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_EVIDENCE_MATRIX,
  CUSTOMER_PROOF_FILMS,
  evaluateStoryGates,
} from '../engine/story-model'
import { film01, film02, film03, film04, film05 } from '../reels/customer-films'

describe('Story Model & Customer Conversion Proof Films', () => {
  it('defines 5 complete customer proof film specifications', () => {
    expect(CUSTOMER_PROOF_FILMS).toHaveLength(5)
    for (const film of CUSTOMER_PROOF_FILMS) {
      expect(film.filmNumber).toBeGreaterThanOrEqual(1)
      expect(film.filmNumber).toBeLessThanOrEqual(5)
      expect(film.hookQuestion).toBeTruthy()
      expect(film.corePain).toBeTruthy()
      expect(film.truthSafeguards.length).toBeGreaterThanOrEqual(2)
      expect(film.stages.length).toBeGreaterThanOrEqual(5)
      expect(film.callToAction.primaryText).toBeTruthy()
      expect(film.callToAction.subText).toBeTruthy()
    }
  })

  it('all 5 films pass the Creative Quality Gates A through H', () => {
    for (const film of CUSTOMER_PROOF_FILMS) {
      const evaluation = evaluateStoryGates(film)
      expect(evaluation).toHaveLength(8)
      for (const gate of evaluation) {
        expect(
          gate.passed,
          `Film ${film.filmNumber} failed Gate ${gate.gate} (${gate.name}): ${gate.rationale}`,
        ).toBe(true)
      }
    }
  })

  it('capability evidence matrix strictly classifies all 5 core workflows', () => {
    const requiredKeys = [
      'offline-pos',
      'unified-invoice-ledger',
      'fifo-avco-profit-report',
      'multi-warehouse-transfer',
      'counter-vs-accountant',
    ]

    for (const key of requiredKeys) {
      const evidence = CAPABILITY_EVIDENCE_MATRIX[key]
      expect(evidence).toBeDefined()
      expect(['VERIFIED', 'PARTIALLY_VERIFIED']).toContain(evidence.status)
      expect(evidence.truthSafeguards.length).toBeGreaterThanOrEqual(2)
      expect(evidence.allowedClaims.length).toBeGreaterThanOrEqual(2)
      expect(evidence.forbiddenClaims.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('verifies the 5 implemented reels correspond to the story specifications', () => {
    const films = [film01, film02, film03, film04, film05]
    expect(films).toHaveLength(5)

    const expectedThemes = [
      'obsidian-cinematic',
      'financial-intelligence',
      'procedural-spatial',
      'swiss-editorial',
      'kinetic-manifesto',
    ]

    for (let i = 0; i < films.length; i++) {
      const f = films[i]
      expect(f.theme).toBe(expectedThemes[i])
      expect(f.duration).toBeGreaterThanOrEqual(45)
      expect(f.duration).toBeLessThanOrEqual(60)
      expect(f.scenes.length).toBeGreaterThanOrEqual(4)

      // Ensure every scene in the film has positive duration and valid boundaries
      for (const scene of f.scenes) {
        expect(scene.end).toBeGreaterThan(scene.start)
        expect(scene.vo).toBeTruthy()
      }
    }
  })

  it('strictly adheres to the dark theme constraint for all 5 proof films', () => {
    const films = [film01, film02, film03, film04, film05]
    for (const f of films) {
      expect(f.theme).not.toBe('light-editorial')
      expect(f.theme).not.toBe('alabaster-daylight')
    }
  })
})
