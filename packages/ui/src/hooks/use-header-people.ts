// Who is in this workspace, and who is online right now — the list in the
// header's identity menu. ONE implementation for web, desktop and mobile.
//
// ⚠️ WHO IS ONLINE COMES FROM PRESENCE, NOT FROM THE EMPLOYEE LIST.
//
// The web header used to list the employees table with a presence flag on
// each row, and the desktop/mobile shell listed nobody. The owner has no
// employee record and a login need not be linked to one — so two people
// signed in to the same workspace each saw only themselves (reported 26 Sep
// 2026), while presence itself knew both. Now: me, then everyone presence
// reports (online), then employees with a login who are not connected
// (offline).
//
// ⚠️ EVERYONE ANNOUNCES, ONLY THE PERMITTED SEE. `usePresence` joins the
// roster unconditionally and returns nothing to a caller without
// `people.presence.read` (decided by the server). `can()` is undefined while
// loading, so the menu says «loading» rather than «not allowed».
'use client'

import { useCallback, useMemo } from 'react'
import { asList, useEmployees, useMyCapabilities, usePresence } from '@hisabche/api'

import type { HeaderPerson } from '../components/ui/dashboard-header'

/** The roles every locale has a word for. `t()` throws on a missing key. */
const TRANSLATED_ROLES = ['owner', 'admin', 'member', 'viewer']

export interface HeaderPeopleUser {
  id: string
  fullName?: string | null | undefined
  email?: string | null | undefined
  role?: string | null | undefined
}

export function useHeaderPeople(
  user: HeaderPeopleUser | null | undefined,
  t: (key: string) => string,
): { people: HeaderPerson[]; canSeePeople: boolean; isLoadingPeople: boolean } {
  const { can } = useMyCapabilities()
  const canSeePeople = can('people.presence.read')

  const roleLabelOf = useCallback(
    (role: string | null | undefined) =>
      role && TRANSLATED_ROLES.includes(role)
        ? t(`team.role${role.charAt(0).toUpperCase()}${role.slice(1)}`)
        : undefined,
    [t],
  )

  const presence = usePresence(
    user?.id
      ? {
          userId: user.id,
          name: user.fullName || user.email || '',
          // Spread, not assigned: `exactOptionalPropertyTypes` refuses null.
          ...(user.email ? { email: user.email } : {}),
          ...(user.role ? { role: user.role } : {}),
        }
      : null,
    { canSee: canSeePeople === true },
  )

  // Employees are fetched only for someone allowed to see the list.
  const { data: employeesData, isLoading: isLoadingEmployees } = useEmployees(
    canSeePeople === true ? { page: 1, limit: 100 } : {},
  )

  const people = useMemo<HeaderPerson[]>(() => {
    if (canSeePeople !== true || !user?.id) return []

    const myRole = roleLabelOf(user.role)
    const me: HeaderPerson = {
      userId: user.id,
      name: user.fullName || user.email || t('nav.account'),
      ...(user.email ? { email: user.email } : {}),
      ...(myRole ? { roleLabel: myRole } : {}),
      isOnline: true,
    }

    const online = presence.members
      .filter((member) => member.userId !== user.id)
      .map((member) => {
        const roleLabel = roleLabelOf(member.role)
        return {
          userId: member.userId,
          name: member.name || member.email || '',
          ...(member.email ? { email: member.email } : {}),
          ...(roleLabel ? { roleLabel } : {}),
          isOnline: true,
        } satisfies HeaderPerson
      })

    const rows = asList<{
      user_id?: string | null
      first_name?: string | null
      last_name?: string | null
      email?: string | null
      position?: string | null
    }>((employeesData as { employees?: unknown } | undefined)?.employees)

    const offline = rows
      .filter(
        (row) => row.user_id && row.user_id !== user.id && !presence.onlineIds.has(row.user_id),
      )
      .map((row) => {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
        return {
          userId: row.user_id as string,
          name: name || row.email || '',
          ...(row.email ? { email: row.email } : {}),
          ...(row.position ? { roleLabel: row.position } : {}),
          isOnline: false,
        } satisfies HeaderPerson
      })

    return [me, ...online, ...offline]
  }, [canSeePeople, employeesData, presence.members, presence.onlineIds, roleLabelOf, t, user])

  return {
    people,
    canSeePeople: canSeePeople === true,
    isLoadingPeople: canSeePeople === undefined || isLoadingEmployees,
  }
}
