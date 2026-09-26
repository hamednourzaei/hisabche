// Reported 26 Sep 2026: the owner and a staff member signed in to the same
// workspace from two browsers; each saw only themselves online. Presence knew
// both — the list was built from the employee table (the owner has no employee
// row) with presence only as a flag.
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  members: [] as Array<{ userId: string; name: string; role?: string; onlineSince: string }>,
  employees: [] as Array<Record<string, unknown>>,
  canSee: true as boolean | undefined,
}))

vi.mock('@hisabche/api', () => ({
  asList: <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []),
  useMyCapabilities: () => ({ can: () => state.canSee }),
  usePresence: () => ({
    members: state.members,
    onlineIds: new Set(state.members.map((m) => m.userId)),
  }),
  useEmployees: () => ({ data: { employees: state.employees }, isLoading: false }),
}))

const { useHeaderPeople } = await import('../hooks/use-header-people')

const t = (key: string) => key
const OWNER = { id: 'owner-1', fullName: 'haji hamid', email: 'o@x.com', role: 'owner' }
const STAFF = { id: 'staff-1', fullName: 'Ali', email: 's@x.com', role: 'member' }

beforeEach(() => {
  state.members = []
  state.employees = []
  state.canSee = true
})

describe('the online list comes from presence', () => {
  it('⚠️ owner sees the staff member who is online — with NO employee rows at all', () => {
    state.members = [
      {
        userId: OWNER.id,
        name: OWNER.fullName,
        role: 'owner',
        onlineSince: '2026-09-26T10:00:00Z',
      },
      {
        userId: STAFF.id,
        name: STAFF.fullName,
        role: 'member',
        onlineSince: '2026-09-26T10:01:00Z',
      },
    ]
    const { result } = renderHook(() => useHeaderPeople(OWNER, t))
    expect(result.current.people.map((p) => [p.userId, p.isOnline])).toEqual([
      [OWNER.id, true],
      [STAFF.id, true],
    ])
  })

  it('and the staff member sees the owner', () => {
    state.members = [
      {
        userId: OWNER.id,
        name: OWNER.fullName,
        role: 'owner',
        onlineSince: '2026-09-26T10:00:00Z',
      },
      {
        userId: STAFF.id,
        name: STAFF.fullName,
        role: 'member',
        onlineSince: '2026-09-26T10:01:00Z',
      },
    ]
    const { result } = renderHook(() => useHeaderPeople(STAFF, t))
    const owner = result.current.people.find((p) => p.userId === OWNER.id)
    expect(owner).toMatchObject({ name: 'haji hamid', isOnline: true, roleLabel: 'team.roleOwner' })
  })

  it('an employee with a login who is not connected is listed offline, once', () => {
    state.members = [
      { userId: OWNER.id, name: OWNER.fullName, onlineSince: '2026-09-26T10:00:00Z' },
    ]
    state.employees = [
      { user_id: STAFF.id, first_name: 'Ali', last_name: 'R' },
      { user_id: OWNER.id, first_name: 'haji', last_name: 'hamid' },
    ]
    const { result } = renderHook(() => useHeaderPeople(OWNER, t))
    expect(result.current.people.map((p) => [p.userId, p.isOnline])).toEqual([
      [OWNER.id, true],
      [STAFF.id, false],
    ])
  })

  it('without people.presence.read: nothing is listed', () => {
    state.canSee = false
    state.members = [{ userId: STAFF.id, name: 'Ali', onlineSince: '2026-09-26T10:00:00Z' }]
    const { result } = renderHook(() => useHeaderPeople(OWNER, t))
    expect(result.current.people).toEqual([])
    expect(result.current.canSeePeople).toBe(false)
  })
})
