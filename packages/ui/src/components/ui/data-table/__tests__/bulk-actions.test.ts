// ============================================
// Bulk actions run N single-item mutations because the API has no bulk
// endpoint. That makes partial failure the normal case, so these tests pin the
// behaviour that matters: nothing is silently reported as done, and a stale
// selection can never be submitted.
// ============================================

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useBulkAction } from '../use-bulk-action'
import { useRowSelection } from '../use-row-selection'

describe('useRowSelection', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useRowSelection())
    expect(result.current.selectedCount).toBe(0)
  })

  it('toggles a row on and off', () => {
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleRow('a'))
    expect(result.current.isSelected('a')).toBe(true)

    act(() => result.current.toggleRow('a'))
    expect(result.current.isSelected('a')).toBe(false)
  })

  it('selects every id when toggling all from a partial selection', () => {
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleRow('a'))
    act(() => result.current.toggleAll(['a', 'b', 'c']))

    expect(result.current.selectedCount).toBe(3)
  })

  it('clears them when toggling all while everything is already selected', () => {
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleAll(['a', 'b']))
    expect(result.current.selectedCount).toBe(2)

    act(() => result.current.toggleAll(['a', 'b']))
    expect(result.current.selectedCount).toBe(0)
  })

  it('leaves rows outside the current page selected when toggling all', () => {
    // "Select all" applies to what is visible; it must not silently drop a
    // selection the user made on another page.
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleRow('offscreen'))
    act(() => result.current.toggleAll(['a', 'b']))
    act(() => result.current.toggleAll(['a', 'b']))

    expect(result.current.isSelected('offscreen')).toBe(true)
    expect(result.current.selectedCount).toBe(1)
  })

  it('treats toggling an empty page as a no-op rather than a clear', () => {
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleRow('a'))
    act(() => result.current.toggleAll([]))

    expect(result.current.isSelected('a')).toBe(true)
  })

  it('prunes ids that are no longer listed', () => {
    // After a delete or a filter change, a stale id must not survive into the
    // next bulk action.
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleAll(['a', 'b', 'c']))
    act(() => result.current.prune(['a', 'c']))

    expect(result.current.selectedCount).toBe(2)
    expect(result.current.isSelected('b')).toBe(false)
  })

  it('keeps the selection identity stable when pruning drops nothing', () => {
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleAll(['a', 'b']))
    const before = result.current.selectedIds

    act(() => result.current.prune(['a', 'b', 'c']))

    expect(result.current.selectedIds).toBe(before)
  })

  it('clears everything', () => {
    const { result } = renderHook(() => useRowSelection())

    act(() => result.current.toggleAll(['a', 'b']))
    act(() => result.current.clear())

    expect(result.current.selectedCount).toBe(0)
  })
})

describe('useBulkAction', () => {
  it('reports every id as succeeded when all calls resolve', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useBulkAction(mutate))

    let outcome!: Awaited<ReturnType<typeof result.current.run>>
    await act(async () => {
      outcome = await result.current.run(['a', 'b', 'c'])
    })

    expect(outcome.succeeded).toEqual(['a', 'b', 'c'])
    expect(outcome.failed).toEqual([])
    expect(mutate).toHaveBeenCalledTimes(3)
  })

  it('keeps going after one call rejects', async () => {
    // Nine deletes succeeding and one failing must not read as "failed" — the
    // nine really are gone.
    const mutate = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('nope')
    })
    const { result } = renderHook(() => useBulkAction(mutate))

    let outcome!: Awaited<ReturnType<typeof result.current.run>>
    await act(async () => {
      outcome = await result.current.run(['a', 'b', 'c'])
    })

    expect(outcome.succeeded).toEqual(['a', 'c'])
    expect(outcome.failed).toEqual(['b'])
  })

  it('attempts every id even when they all fail', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useBulkAction(mutate))

    let outcome!: Awaited<ReturnType<typeof result.current.run>>
    await act(async () => {
      outcome = await result.current.run(['a', 'b'])
    })

    expect(outcome.failed).toEqual(['a', 'b'])
    expect(outcome.succeeded).toEqual([])
    expect(mutate).toHaveBeenCalledTimes(2)
  })

  it('processes more ids than one batch holds', async () => {
    const seen: string[] = []
    const mutate = vi.fn(async (id: string) => {
      seen.push(id)
    })
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`)

    const { result } = renderHook(() => useBulkAction(mutate))

    let outcome!: Awaited<ReturnType<typeof result.current.run>>
    await act(async () => {
      outcome = await result.current.run(ids)
    })

    expect(seen).toHaveLength(12)
    expect(outcome.succeeded).toHaveLength(12)
  })

  it('clears busy once the run settles, including on failure', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useBulkAction(mutate))

    await act(async () => {
      await result.current.run(['a'])
    })

    expect(result.current.busy).toBe(false)
  })

  it('exposes the last result and can reset it', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useBulkAction(mutate))

    await act(async () => {
      await result.current.run(['a'])
    })
    expect(result.current.result?.succeeded).toEqual(['a'])

    act(() => result.current.reset())
    expect(result.current.result).toBeNull()
  })

  it('does nothing for an empty selection', async () => {
    const mutate = vi.fn()
    const { result } = renderHook(() => useBulkAction(mutate))

    let outcome!: Awaited<ReturnType<typeof result.current.run>>
    await act(async () => {
      outcome = await result.current.run([])
    })

    expect(mutate).not.toHaveBeenCalled()
    expect(outcome).toEqual({ succeeded: [], failed: [] })
  })
})
