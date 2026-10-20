'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Button,
  Input,
  Textarea,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import {
  useWorkspace360,
  useManageUser,
  useCreateSupportSession,
  useAddWorkspaceNote,
} from '@/hooks/use-admin-customers'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'

interface Workspace360SheetProps {
  workspaceId: string | null
  onClose: () => void
}

export function Workspace360Sheet({ workspaceId, onClose }: Workspace360SheetProps) {
  const t = useTranslations()
  const { data, isLoading, isError } = useWorkspace360(workspaceId)
  const { mutateAsync: manageUser } = useManageUser()
  const { mutateAsync: createSupportSession } = useCreateSupportSession()
  const { mutateAsync: addNote, isPending: isAddingNote } = useAddWorkspaceNote()

  const [activeTab, setActiveTab] = useState('overview')
  const [newNote, setNewNote] = useState('')
  const [newTags, setNewTags] = useState('')

  // User action step-up state
  const [userActionTarget, setUserActionTarget] = useState<{
    userId: string
    action: 'suspend' | 'reactivate' | 'revoke_sessions' | 'reset_mfa' | 'force_signout'
  } | null>(null)

  // Support session step-up state
  const [supportPromptOpen, setSupportPromptOpen] = useState(false)

  const handleUserActionConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!userActionTarget) return
    await manageUser({
      userId: userActionTarget.userId,
      action: userActionTarget.action,
      stepUpTimestamp,
    })
    setUserActionTarget(null)
  }

  const handleSupportSessionConfirm = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (!workspaceId || !reason) return
    await createSupportSession({
      workspaceId,
      reason,
      stepUpTimestamp,
    })
    setSupportPromptOpen(false)
  }

  const handleAddNote = async () => {
    if (!workspaceId || !newNote.trim()) return
    const tags = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await addNote({ workspaceId, note: newNote.trim(), tags })
    setNewNote('')
    setNewTags('')
  }

  const ws = data?.workspace

  return (
    <Sheet open={Boolean(workspaceId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="end" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-start pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">
              {isLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <>
                  <span>{ws?.name ?? t('admin.customers.workspace360')}</span>
                  <Badge variant="outline" className="ms-2 font-mono text-xs">
                    {workspaceId?.slice(0, 8)}...
                  </Badge>
                </>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-4 py-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {isError && !isLoading && (
          <div className="py-12">
            <EmptyState
              title={t('admin.customers.loadError')}
              description={t('admin.customers.loadErrorHint')}
            />
          </div>
        )}

        {data && !isLoading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid grid-cols-5 w-full text-xs">
              <TabsTrigger value="overview">{t('admin.customers.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="members">{t('admin.customers.tabs.members')}</TabsTrigger>
              <TabsTrigger value="notes">{t('admin.customers.tabs.notes')}</TabsTrigger>
              <TabsTrigger value="support">{t('admin.customers.tabs.support')}</TabsTrigger>
              <TabsTrigger value="compliance">{t('admin.customers.tabs.compliance')}</TabsTrigger>
            </TabsList>

            {/* TAB: OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 mt-4 text-xs">
              <div className="p-4 rounded-xl bg-muted/40 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">
                    {t('admin.customers.workspaceName')}:
                  </span>
                  <span className="font-semibold text-foreground">{ws?.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">{t('admin.customers.workspaceId')}:</span>
                  <span dir="ltr" className="font-mono text-muted-foreground">
                    {ws?.id}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">{t('admin.customers.createdAt')}:</span>
                  <span className="tabular-nums text-muted-foreground">
                    {ws?.created_at ? new Date(ws.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>

              {/* Honest Entitlements / Subscription State */}
              <div className="p-4 rounded-xl border border-border space-y-2">
                <div className="font-bold text-sm text-foreground">
                  {t('admin.customers.subscriptionsSection')}
                </div>
                {data.subscriptions.length === 0 ? (
                  <p className="text-muted-foreground">{t('admin.customers.noActiveSub')}</p>
                ) : (
                  <div className="space-y-1">
                    {data.subscriptions.map((subItem, i) => {
                      const sub = subItem as { plan?: string; status?: string }
                      return (
                        <div
                          key={i}
                          className="flex justify-between font-mono bg-muted/50 p-2 rounded"
                        >
                          <span>{sub.plan ?? 'PLAN'}</span>
                          <span>{sub.status ?? 'active'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB: MEMBERS & USER MANAGEMENT */}
            <TabsContent value="members" className="space-y-4 mt-4 text-xs">
              {data.members.length === 0 ? (
                <EmptyState title={t('admin.customers.noMembers')} />
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {data.members.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30"
                    >
                      <div>
                        <div className="font-mono font-medium text-foreground">
                          {m.email ?? m.user_id}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {m.role}
                          </Badge>
                          <span className="text-muted-foreground tabular-nums text-[10px]">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            setUserActionTarget({ userId: m.user_id, action: 'revoke_sessions' })
                          }
                        >
                          {t('admin.customers.revokeSessions')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            setUserActionTarget({ userId: m.user_id, action: 'reset_mfa' })
                          }
                        >
                          {t('admin.customers.resetMfa')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            setUserActionTarget({ userId: m.user_id, action: 'suspend' })
                          }
                        >
                          {t('admin.customers.suspendUser')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB: NOTES & TAGS */}
            <TabsContent value="notes" className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl border border-border bg-card space-y-2">
                <div className="font-medium text-foreground">
                  {t('admin.customers.newNoteTitle')}
                </div>
                <Textarea
                  placeholder={t('admin.customers.notePlaceholder')}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                />
                <Input
                  placeholder={t('admin.customers.tagsPlaceholder')}
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => void handleAddNote()}
                  disabled={isAddingNote || !newNote.trim()}
                >
                  {isAddingNote ? t('app.loading') : t('admin.customers.saveNote')}
                </Button>
              </div>

              {data.notes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {t('admin.customers.noNotes')}
                </p>
              ) : (
                <div className="space-y-2">
                  {data.notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-foreground">{n.admin_email}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{n.note}</p>
                      {n.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {n.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB: SUPPORT SESSIONS */}
            <TabsContent value="support" className="space-y-4 mt-4 text-xs">
              <div className="flex justify-between items-center">
                <p className="text-muted-foreground">{t('admin.customers.supportNotice')}</p>
                <Button size="sm" onClick={() => setSupportPromptOpen(true)}>
                  {t('admin.customers.openSupportSession')}
                </Button>
              </div>

              {data.supportSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {t('admin.customers.noSupportSessions')}
                </p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {data.supportSessions.map((s) => (
                    <div key={s.id} className="p-3 space-y-1">
                      <div className="flex justify-between font-medium">
                        <span>{s.admin_email}</span>
                        <Badge
                          variant={s.is_revoked ? 'destructive' : 'default'}
                          className="text-[10px]"
                        >
                          {s.is_revoked
                            ? t('admin.customers.revoked')
                            : t('admin.customers.activeSession')}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">{s.reason}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {t('admin.customers.expiresAt')} {new Date(s.expires_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB: DATA REQUESTS & COMPLIANCE */}
            <TabsContent value="compliance" className="space-y-4 mt-4 text-xs">
              {data.dataRequests.length === 0 ? (
                <EmptyState
                  title={t('admin.customers.noDataRequests')}
                  description={t('admin.customers.noDataRequestsHint')}
                />
              ) : (
                <div className="space-y-2">
                  {data.dataRequests.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl border border-border bg-card space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {r.request_type}
                        </Badge>
                        <Badge
                          variant={r.status === 'COMPLETED' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {t('admin.customers.slaDue')} {new Date(r.sla_due_at).toLocaleDateString()}
                      </div>
                      {r.legal_hold && (
                        <div className="text-destructive font-medium text-[11px]">
                          ⚠️ {t('admin.customers.legalHoldActive')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Step-up for User Actions */}
        <StepUpDialog
          open={Boolean(userActionTarget)}
          onOpenChange={(open) => !open && setUserActionTarget(null)}
          title={t('admin.customers.userActionTitle')}
          description={t('admin.customers.userActionDesc', {
            action: userActionTarget?.action ?? '',
          })}
          destructive={userActionTarget?.action === 'suspend'}
          onConfirm={handleUserActionConfirm}
        />

        {/* Step-up for Support Session */}
        <StepUpDialog
          open={supportPromptOpen}
          onOpenChange={setSupportPromptOpen}
          title={t('admin.customers.createSupportTitle')}
          description={t('admin.customers.createSupportDesc')}
          requireReason
          reasonLabel={t('admin.customers.supportReasonLabel')}
          confirmLabel={t('admin.customers.createSupportConfirm')}
          onConfirm={handleSupportSessionConfirm}
        />
      </SheetContent>
    </Sheet>
  )
}
