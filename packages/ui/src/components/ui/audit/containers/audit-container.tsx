// packages/ui/src/components/ui/audit/containers/audit-container.tsx
'use client'

// ============================================
// G4 — «سابقه تغییرات», the audit tab on /activities.
//
// ---------------------------------------------------------------------------
// 🔴 WHAT WAS BROKEN — this tab returned 403 for every ordinary member
//
// It called `useAuditLogs` → `GET /api/audit/logs`, which is behind
// `platformAdminGuard`. That guard is correct and deliberate: `list()` on the
// audit service crosses workspaces for platform support, and letting a seller
// reach it would hand them every business's financial actions.
//
// But it meant the tab in the product could never load for the people it was
// built for. It rendered an error, not a trail.
//
// It now calls `GET /api/audit/workspace`, which G4 added: workspace-scoped,
// filtered on the verified request context, guarded with
// `report.operational.read`. The platform route is untouched.
//
// ---------------------------------------------------------------------------
// WHY THE TABLE CHANGED TOO
//
// The old `AuditView` had no columns for ROLE, BRANCH, or BEFORE/AFTER — the
// three the architecture names as the point of an audit table. `AuditTrailTab`
// has them, and makes the record id clickable through to the record (H6).
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { asList, useAuditTrail, useBranches, useWorkspaceMembers } from '@hisabche/api'
import { useWorkspaceStore } from '@hisabche/store'
import { resolveIntlLocale, type UiLanguage } from '@hisabche/formatting'

import { AuditTrailTab, type AuditRow } from '../../activity/audit-trail-tab'
import { routeForEntity } from '../../../../lib/entity-route'

/** The entity types the audit trail actually records, for the filter. */
const ENTITY_TYPES = [
  { value: 'invoice', labelKey: 'audit.entities.invoice', fallback: 'فاکتور' },
  { value: 'payment', labelKey: 'audit.entities.payment', fallback: 'پرداخت' },
  { value: 'customer', labelKey: 'audit.entities.customer', fallback: 'مشتری' },
  { value: 'product', labelKey: 'audit.entities.product', fallback: 'کالا' },
  { value: 'employee', labelKey: 'audit.entities.employee', fallback: 'کارمند' },
  { value: 'workspace', labelKey: 'audit.entities.workspace', fallback: 'کسب‌وکار' },
]

export const AuditContainer = memo(function AuditContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )

  const router = useRouter()
  const locale = resolveIntlLocale(useLocale() as UiLanguage)

  const [entityType, setEntityType] = useState('')
  const [branchId, setBranchId] = useState('')
  const [actorId, setActorId] = useState('')

  const { data, isLoading, error } = useAuditTrail({
    ...(entityType ? { entityType } : {}),
    ...(branchId ? { branchId } : {}),
    ...(actorId ? { userId: actorId } : {}),
    limit: 50,
  })

  // Branches and MEMBERS name the ids the audit rows carry.
  //
  // ⚠️ Names came from the employees list: the owner, and anyone with a login
  // but no employee record, showed as an 8-character id with role «—». Every
  // person who can write an audit row is a workspace MEMBER — that list has
  // the name and the role.
  const { data: branches = [] } = useBranches()
  const workspaceId = useWorkspaceStore((state) => state.workspaceId)
  const { data: membersData } = useWorkspaceMembers(workspaceId ?? '')
  const members = useMemo(
    () => asList<{ user_id: string; role: string; full_name: string | null }>(membersData),
    [membersData],
  )

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.name]))
    return (id: string | null | undefined) => (id ? (map.get(id) ?? '—') : '—')
  }, [branches])

  const actorName = useMemo(() => {
    const map = new Map<string, string>(
      members.filter((m) => m.full_name).map((m) => [m.user_id, m.full_name as string]),
    )
    // Someone no longer a member keeps their short id — honest, not guessed.
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : '—')
  }, [members])

  const actorRole = useMemo(() => {
    const map = new Map<string, string>(members.map((m) => [m.user_id, m.role]))
    return (id: string | null | undefined) => {
      const role = id ? map.get(id) : undefined
      return role ? t(`role.${role}`, role) : '—'
    }
  }, [members, t])

  const formatDate = useCallback(
    (iso: string) => {
      if (!iso) return '—'
      // ⚠️ `format` THROWS «RangeError: Invalid time value» on a malformed
      // timestamp, which takes the whole audit page into the error boundary.
      // Postgres may spell the offset «+00» (no minutes) and use a space for
      // «T»; V8 rejects both, which rendered every time as «—».
      const parsed = new Date(iso.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
      if (Number.isNaN(parsed.getTime())) return '—'
      // An explicit locale, not the browser's — the same defect the accounting
      // tabs had, where two people in one shop saw two different renderings.
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(parsed)
    },
    [locale],
  )

  const handleOpenRecord = useCallback(
    (type: string, id: string) => {
      const route = routeForEntity(type, id)
      if (route) router.push(route)
    },
    [router],
  )

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
    [branches],
  )

  const actorOptions = useMemo(
    () =>
      members
        .filter((m) => m.full_name)
        .map((m) => ({ value: m.user_id, label: m.full_name as string })),
    [members],
  )

  const entityTypeOptions = useMemo(
    () => ENTITY_TYPES.map((e) => ({ value: e.value, label: t(e.labelKey, e.fallback) })),
    [t],
  )

  return (
    <AuditTrailTab
      t={t}
      rows={(data?.data ?? []) as AuditRow[]}
      total={data?.total ?? 0}
      isLoading={isLoading}
      error={error ? ((error as Error).message ?? null) : null}
      entityType={entityType}
      branchId={branchId}
      actorId={actorId}
      onEntityTypeChange={setEntityType}
      onBranchChange={setBranchId}
      onActorChange={setActorId}
      entityTypes={entityTypeOptions}
      branches={branchOptions}
      actors={actorOptions}
      onOpenRecord={handleOpenRecord}
      formatDate={formatDate}
      labelForActor={actorName}
      labelForBranch={branchName}
      labelForRole={actorRole}
    />
  )
})

AuditContainer.displayName = 'AuditContainer'
