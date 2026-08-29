'use client'

import { useTranslations } from 'next-intl'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

import type { AdminMember } from '@/hooks/use-admin-members'

/**
 * Confirmation for removing a membership.
 *
 * The consequence line is the point of this dialog. "Remove member" in an admin
 * console reads like "delete this person", and an operator who believes that is
 * either too frightened to use it or about to do something they think is
 * irreversible. It is not: the backend deletes the `workspace_members` row and
 * nothing else — never `auth.users`, never a financial record — and
 * `admin-membership.test.ts` asserts exactly that. The dialog says so because
 * the operator cannot see the server to know it.
 */
export function RemoveMemberDialog({
  member,
  workspaceName,
  pending,
  onCancel,
  onConfirm,
}: {
  /** Null closes the dialog. Non-null is the member awaiting confirmation. */
  member: AdminMember | null
  workspaceName: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTranslations()

  const displayName = member?.name ?? member?.email ?? t('admin.member.unknown')

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        // A request in flight must not be dismissed by Escape or a backdrop
        // click — the mutation would still land, with the confirmation gone.
        if (!open && !pending) onCancel()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.removeDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.removeDialog.body', { name: displayName, workspace: workspaceName })}
          </DialogDescription>
        </DialogHeader>

        {member?.email && (
          <p className="truncate text-sm text-muted-foreground" dir="ltr">
            {member.email}
          </p>
        )}

        <p className="rounded-md bg-muted p-3 text-sm">{t('admin.removeDialog.consequence')}</p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="h-11" disabled={pending} onClick={onCancel}>
            {t('admin.removeDialog.cancel')}
          </Button>
          <Button variant="destructive" className="h-11" disabled={pending} onClick={onConfirm}>
            {pending ? t('app.loading') : t('admin.removeDialog.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
