// ============================================
// packages/ui/src/lib/role-tone.ts
//
// ONE palette for workspace roles, and one rule for an unknown one.
//
// ---------------------------------------------------------------------------
// WHY IT LIVES HERE
//
// The colours were defined inside `dashboard-header.tsx`, where only the
// header could reach them. The moment a second surface had to show a role —
// the recent-activities feed on the dashboard — the choice was to copy the map
// or to move it. A copied palette drifts: one surface gets a new role colour,
// the other keeps the old one, and the same person is two colours on one
// screen.
//
// ---------------------------------------------------------------------------
// ⚠️ AN UNKNOWN ROLE IS UNCOLOURED, NOT «viewer»
//
// `roleTone(null)` is neutral on purpose. Falling back to the lowest role
// would state something about a real person that may be false — an owner shown
// as view-only while their role loads, or someone who has LEFT the workspace
// described as a member because a row still carries their name. No colour, and
// a label that says «unknown», is the truth.
// ============================================

/** The client role vocabulary — what `workspace_members.role` is written with. */
export const ROLE_NAMES = ['owner', 'admin', 'member', 'viewer'] as const
export type RoleName = (typeof ROLE_NAMES)[number]

/** The neutral tone. Used for an unknown role and nothing else. */
export const ROLE_TONE_UNKNOWN = 'text-[hsl(var(--fg-tertiary))] bg-[hsl(var(--surface-muted))]'

export const ROLE_TONE: Record<RoleName, string> = {
  owner: 'text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.10)]',
  admin: 'text-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning)/0.12)]',
  member: 'text-[hsl(var(--color-info))] bg-[hsl(var(--color-info)/0.12)]',
  viewer: ROLE_TONE_UNKNOWN,
}

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === 'string' && (ROLE_NAMES as readonly string[]).includes(value)
}

/** The classes for a role, or the neutral tone when it is not known. */
export function roleTone(role: string | null | undefined): string {
  return isRoleName(role) ? ROLE_TONE[role] : ROLE_TONE_UNKNOWN
}

/** The message key for a role's label, or the «unknown» key. */
export function roleLabelKey(role: string | null | undefined): string {
  if (!isRoleName(role)) return 'team.roleUnknown'
  const suffix = role.charAt(0).toUpperCase() + role.slice(1)
  return `team.role${suffix}`
}
