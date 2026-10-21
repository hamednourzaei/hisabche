// ============================================
// "You have changes that were never sent."
//
// Signing out with unsent work must not destroy it — and must not trap the
// person either: the dialog offers the way out AND the way to stay.
// ============================================

import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hisabche/ui'

import { Button } from '@/components/ui/primitives'
import { useAuthStore } from '@/features/auth/auth.store'

export function LogoutPendingDialog() {
  const { t } = useTranslation('desktop')
  const pending = useAuthStore((s) => s.pendingLogoutCount)
  const dismiss = useAuthStore((s) => s.dismissPendingLogout)
  const logout = useAuthStore((s) => s.logout)

  return (
    <Dialog
      open={pending > 0}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.logoutPendingTitle')}</DialogTitle>
          <DialogDescription>{t('auth.logoutPendingBody', { count: pending })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void logout({ force: true })}>
            {t('auth.logoutKeepData')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
