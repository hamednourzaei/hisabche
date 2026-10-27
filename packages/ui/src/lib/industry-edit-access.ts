// ============================================
// packages/ui/src/lib/industry-edit-access.ts
//
// Whether Settings should let the person edit the industry.
//
// `user.role` in the auth store is DISPLAY-ONLY (see `AuthUser.role` in
// `@hisabche/auth-core`): it is `null` when the person belongs to several
// workspaces (a production business plus a sandbox is enough) or when the role
// is not known yet. `null` means «not unambiguous», never «not an owner».
//
// Reading `role === 'owner'` as the edit gate locked every owner who has two
// workspaces out of the selector: the boxes were disabled and the page told the
// owner that only the owner may change the industry.
//
// The server is the authority (`PATCH /api/auth/profile` answers 403
// INDUSTRY_OWNER_ONLY to a non-owner). The screen only hides the editor for a
// role it KNOWS cannot write, and otherwise lets the server decide.
// ============================================

export function industryEditable(role: string | null | undefined): boolean {
  if (role === null || role === undefined || role === '') return true
  return role === 'owner'
}
