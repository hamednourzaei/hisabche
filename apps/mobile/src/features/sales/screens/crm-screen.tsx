// ============================================
// CRM — sales follow-up tasks (canonical Web: packages/ui/crm).
//
// Web anatomy:
//   Header: «پیگیری فروش» (nav.followUp) + Handshake icon
//   Tabs:   تعاملات (interactions) / آمار تعاملات (stats)
//   Interactions tab:
//     · «وظیفه جدید» form: employee select, multi-customer picker, type,
//       subject, notes, Create
//     · interaction table: employee · customer count · phone · subject ·
//       type · date · status badge
//     · tapping a row opens the task detail modal: subject, status badge,
//       employee/type, notes, selected customers, status history,
//       manual status change, share link
//   Stats tab:
//     · 4 KPI cards: total / in_progress / pending / completed
//     · per-employee bar chart (native simplified)
//
// Mobile is a dedicated native screen — CRM is NOT the customers list; it is
// the sales follow-up surface. The table becomes cards, the modal a bottom
// sheet, the employee/type selects native action sheets, and the customers
// multi-picker reuses the shared customers query with a multi-select sheet.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import {
  useCustomers,
  useEmployees,
  useInteractions,
  useCreateInteraction,
  useUpdateInteractionStatus,
  type Interaction,
  type InteractionCustomer,
  type TaskStatus,
} from '@hisabche/api'
import type { Customer } from '@hisabche/validation'
import {
  ActionSheet,
  Button,
  EmptyState,
  MobileCard,
  SearchBar,
  Skeleton,
  StatusChip,
  Text,
  useTheme,
  type ActionSheetItem,
  type BadgeTone,
} from '@hisabche/mobile-ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { formatDate } from '../../../shared/lib/format'

type CrmTab = 'interactions' | 'stats'
type InteractionType = 'call' | 'meeting' | 'email' | 'note'

const INTERACTION_TYPES: readonly InteractionType[] = ['call', 'meeting', 'email', 'note']

const STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
}

const STATUS_ICON: Record<TaskStatus, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  in_progress: 'play-circle-outline',
  completed: 'checkmark-circle',
}

/** Employees from the shared HR source — same data web uses, mapped to id+name. */
function useEmployeeOptions(): { id: string; name: string }[] {
  const { data } = useEmployees({ limit: 200 })
  return useMemo(
    () =>
      (data?.employees ?? []).map((e: Record<string, unknown>) => {
        const first = e.first_name as string | undefined
        const last = e.last_name as string | undefined
        const code = e.employee_code as string | undefined
        return { id: String(e.id), name: [first, last].filter(Boolean).join(' ') || code || '' }
      }),
    [data],
  )
}

export function CrmScreen() {
  const { t } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { spacing, colors, radius } = useTheme()
  const insets = useSafeAreaInsets()

  const [tab, setTab] = useState<CrmTab>('interactions')

  // Task list
  const interactionsQuery = useInteractions()
  const interactions: Interaction[] = interactionsQuery.data ?? []

  // New-task form state (mirrors web's CrmView form)
  const [formOpen, setFormOpen] = useState(false)
  const employees = useEmployeeOptions()
  const [employeeId, setEmployeeId] = useState('')
  const [customers, setCustomers] = useState<InteractionCustomer[]>([])
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [type, setType] = useState<InteractionType>('call')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')

  const createInteraction = useCreateInteraction()
  const updateStatus = useUpdateInteractionStatus()

  // Selected task → bottom-sheet detail
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = useMemo(
    () => interactions.find((i) => i.id === selectedTaskId) ?? null,
    [interactions, selectedTaskId],
  )

  const onCreate = useCallback(async () => {
    if (customers.length === 0 || !subject.trim() || !employeeId) return
    const employee = employees.find((e) => e.id === employeeId)
    await createInteraction.mutateAsync({
      customerId: customers[0]!.id,
      customerIds: customers.map((c) => c.id),
      employeeId,
      employeeName: employee?.name ?? '',
      type,
      subject: subject.trim(),
      content: content.trim(),
    })
    setCustomers([])
    setEmployeeId('')
    setType('call')
    setSubject('')
    setContent('')
    setFormOpen(false)
  }, [content, createInteraction, customers, employeeId, employees, subject, type])

  const onUpdateStatus = useCallback(
    async (status: TaskStatus) => {
      if (!selectedTask) return
      await updateStatus.mutateAsync({ id: selectedTask.id, status })
    },
    [selectedTask, updateStatus],
  )

  // Stats — same aggregates derived from status as web's CrmView.
  const stats = useMemo(() => {
    let pending = 0
    let inProgress = 0
    let completed = 0
    for (const task of interactions) {
      if (task.status === 'pending') pending++
      else if (task.status === 'in_progress') inProgress++
      else if (task.status === 'completed') completed++
    }
    return {
      total: interactions.length,
      pending,
      inProgress,
      completed,
    }
  }, [interactions])

  const isSubmitting = createInteraction.isPending || updateStatus.isPending

  return (
    <AppScreen>
      <NavScreenHeader id="follow-up" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — nav.followUp «پیگیری فروش» */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
          <Text variant="heading">{tCommon('nav.followUp', 'پیگیری فروش')}</Text>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.borderDefault,
          }}
        >
          {(
            [
              ['interactions', tCommon('crm.tabs.interactions', 'تعاملات')],
              ['stats', tCommon('crm.tabs.stats', 'آمار تعاملات')],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderBottomWidth: 2,
                  borderBottomColor: active ? colors.primary : 'transparent',
                }}
              >
                <Text
                  variant="label"
                  style={{ color: active ? colors.primary : colors.fgTertiary }}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {tab === 'interactions' ? (
          <>
            {/* New-task toggle */}
            <Button
              testID="new-interaction-toggle"
              label={
                formOpen
                  ? t('common.cancel', 'انصراف')
                  : tCommon('crm.interactions.new', 'وظیفه جدید')
              }
              variant={formOpen ? 'subtle' : 'primary'}
              fullWidth
              onPress={() => setFormOpen((v) => !v)}
            />

            {formOpen ? (
              <MobileCard padding="lg">
                <View style={{ gap: spacing.md }}>
                  {/* Employee */}
                  <EmployeeSelect
                    employeeId={employeeId}
                    employees={employees}
                    placeholder={tCommon('crm.pickEmployeePlaceholder', 'انتخاب پرسنل...')}
                    onSelect={setEmployeeId}
                  />
                  {/* Customers multi-select */}
                  <Button
                    testID="pick-customers"
                    label={
                      customers.length === 0
                        ? tCommon('crm.pickCustomersPlaceholder', 'انتخاب مشتری‌ها...')
                        : tCommon('crm.selectedCustomers', 'مشتری‌های انتخاب‌شده') +
                          ` (${customers.length})`
                    }
                    variant="secondary"
                    fullWidth
                    onPress={() => setCustomerSheetOpen(true)}
                  />
                  {customers.length > 0 ? (
                    <View style={{ gap: spacing.xs }}>
                      {customers.map((c) => (
                        <View
                          key={c.id}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                        >
                          <Ionicons name="person-outline" size={14} color={colors.fgTertiary} />
                          <Text variant="caption" style={{ flex: 1 }}>
                            {c.name}
                          </Text>
                          {c.phone ? (
                            <Text variant="legal" tone="tertiary">
                              {c.phone}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {/* Type */}
                  <TypeSelect type={type} onSelect={setType} />
                  {/* Subject + notes */}
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="label" tone="secondary">
                      {tCommon('crm.interactions.subject', 'موضوع')}
                    </Text>
                    <TextInput
                      testID="interaction-subject"
                      value={subject}
                      onChangeText={setSubject}
                      placeholder={tCommon('crm.interactions.subject', 'موضوع')}
                      placeholderTextColor={colors.fgTertiary}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                        borderRadius: 12,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 10,
                        color: colors.fgPrimary,
                        fontSize: 15,
                      }}
                    />
                    <TextInput
                      value={content}
                      onChangeText={setContent}
                      placeholder={tCommon(
                        'crm.interactions.contentPlaceholder',
                        'توضیحات (اختیاری)',
                      )}
                      placeholderTextColor={colors.fgTertiary}
                      multiline
                      numberOfLines={3}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                        borderRadius: 12,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 10,
                        color: colors.fgPrimary,
                        fontSize: 15,
                        minHeight: 72,
                      }}
                    />
                  </View>
                  <Button
                    testID="create-interaction"
                    label={tCommon('crm.interactions.create', 'ثبت وظیفه')}
                    fullWidth
                    loading={createInteraction.isPending}
                    disabled={customers.length === 0 || !subject.trim() || !employeeId}
                    onPress={() => void onCreate()}
                  />
                </View>
              </MobileCard>
            ) : null}

            {/* Error state */}
            {interactionsQuery.isError && (
              <View
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.destructiveSoft,
                  backgroundColor: colors.destructiveSoft,
                  padding: spacing.md,
                }}
              >
                <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
                  {t('common.error')}
                </Text>
              </View>
            )}

            {/* Interactions list */}
            {interactionsQuery.isLoading ? (
              <View style={{ gap: spacing.sm }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={72} />
                ))}
              </View>
            ) : interactions.length === 0 ? (
              <EmptyState title={tCommon('crm.interactions.empty', 'هیچ وظیفه‌ای ثبت نشده')} />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {interactions.map((task) => (
                  <InteractionCard
                    key={task.id}
                    task={task}
                    tCommon={tCommon}
                    onPress={() => setSelectedTaskId(task.id)}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <StatsTab stats={stats} interactions={interactions} tCommon={tCommon} />
        )}
      </ScrollView>

      {/* Multi-customer picker sheet */}
      <CustomerMultiSheet
        visible={customerSheetOpen}
        onClose={() => setCustomerSheetOpen(false)}
        selected={customers}
        onToggle={(customer) =>
          setCustomers((prev) =>
            prev.some((c) => c.id === customer.id)
              ? prev.filter((c) => c.id !== customer.id)
              : [...prev, customer],
          )
        }
      />

      {/* Task detail bottom sheet */}
      {selectedTask ? (
        <TaskDetailSheet
          task={selectedTask}
          isUpdating={isSubmitting}
          onClose={() => setSelectedTaskId(null)}
          onUpdateStatus={(s) => void onUpdateStatus(s)}
          tCommon={tCommon}
        />
      ) : null}
    </AppScreen>
  )
}

/* ─── Interaction card — maps the web table row to a native card ─────────── */

function InteractionCard({
  task,
  tCommon,
  onPress,
}: {
  task: Interaction
  tCommon: ReturnType<typeof useCommonT>
  onPress: () => void
}) {
  const { spacing, colors } = useTheme()
  const custs = task.customers ?? []
  const first = custs[0]
  const extra = custs.length - 1

  return (
    <MobileCard onPress={onPress} padding="md">
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {task.subject}
            </Text>
          </View>
          <StatusChip
            label={tCommon(
              `crm.status.${task.status}`,
              task.status === 'in_progress' ? 'در حال انجام' : task.status,
            )}
            tone={STATUS_TONE[task.status]}
          />
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {task.employeeName || '-'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={13} color={colors.fgTertiary} />
            <Text variant="legal" tone="tertiary">
              {custs.length}
            </Text>
          </View>
          <Text variant="legal" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {first?.phone ?? '-'}
            {extra > 0 ? ` +${extra}` : ''}
          </Text>
          <Text variant="legal" tone="tertiary">
            {tCommon(`crm.interactions.type.${task.type}`, task.type)}
          </Text>
          <Text variant="legal" tone="tertiary">
            {formatDate(task.interactionDate)}
          </Text>
        </View>
      </View>
    </MobileCard>
  )
}

/* ─── Stats tab — 4 KPI cards + per-employee summary ────────────────────── */

function StatsTab({
  stats,
  interactions,
  tCommon,
}: {
  stats: { total: number; pending: number; inProgress: number; completed: number }
  interactions: Interaction[]
  tCommon: ReturnType<typeof useCommonT>
}) {
  const { spacing, colors } = useTheme()

  const kpis: { id: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: number }[] =
    [
      {
        id: 'total',
        icon: 'clipboard-outline',
        label: tCommon('crm.stats.total', 'مجموع وظایف'),
        value: stats.total,
      },
      {
        id: 'in-progress',
        icon: 'play-circle-outline',
        label: tCommon('crm.status.inProgress', 'در حال انجام'),
        value: stats.inProgress,
      },
      {
        id: 'pending',
        icon: 'time-outline',
        label: tCommon('crm.status.pending', 'در حال انتظار'),
        value: stats.pending,
      },
      {
        id: 'completed',
        icon: 'checkmark-circle-outline',
        label: tCommon('crm.status.completed', 'کامل شد'),
        value: stats.completed,
      },
    ]

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={{ flexBasis: '47%', flexGrow: 1, minWidth: 140 }}>
            <MobileCard padding="md">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name={kpi.icon} size={15} color={colors.primary} />
                <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                  {kpi.label}
                </Text>
              </View>
              <Text variant="heading" style={{ marginTop: spacing.sm }}>
                {kpi.value}
              </Text>
            </MobileCard>
          </View>
        ))}
      </View>

      {/* Per-employee summary — native replacement for web's bar chart. */}
      <EmployeeSummary interactions={interactions} tCommon={tCommon} />
    </View>
  )
}

function EmployeeSummary({
  interactions,
  tCommon,
}: {
  interactions: Interaction[]
  tCommon: ReturnType<typeof useCommonT>
}) {
  const { spacing, colors } = useTheme()
  const byEmployee = useMemo(() => {
    const map = new Map<string, { pending: number; in_progress: number; completed: number }>()
    for (const task of interactions) {
      const name = task.employeeName || tCommon('crm.unassigned', 'بدون تخصیص')
      const entry = map.get(name) ?? { pending: 0, in_progress: 0, completed: 0 }
      entry[task.status]++
      map.set(name, entry)
    }
    return Array.from(map.entries())
  }, [interactions, tCommon])

  if (byEmployee.length === 0) {
    return (
      <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
        {tCommon('crm.opportunities.empty', 'هیچ وظیفه‌ای ثبت نشده')}
      </Text>
    )
  }

  const max = Math.max(...byEmployee.map(([, s]) => s.pending + s.in_progress + s.completed), 1)

  return (
    <MobileCard padding="lg">
      <View style={{ gap: spacing.md }}>
        {byEmployee.map(([name, s]) => {
          const total = s.pending + s.in_progress + s.completed
          return (
            <View key={name} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                  {name}
                </Text>
                <Text variant="legal" tone="tertiary">
                  {total}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2, height: 10 }}>
                <View
                  style={{ flex: s.pending, backgroundColor: colors.warning, borderRadius: 2 }}
                />
                <View
                  style={{ flex: s.in_progress, backgroundColor: colors.info, borderRadius: 2 }}
                />
                <View
                  style={{ flex: s.completed, backgroundColor: colors.success, borderRadius: 2 }}
                />
              </View>
              <Text variant="legal" tone="tertiary">
                {tCommon('crm.status.pending', 'در حال انتظار')} {s.pending} ·{' '}
                {tCommon('crm.status.inProgress', 'در حال انجام')} {s.in_progress} ·{' '}
                {tCommon('crm.status.completed', 'کامل شد')} {s.completed}
              </Text>
            </View>
          )
        })}
      </View>
    </MobileCard>
  )
}

/* ─── Task detail bottom sheet — maps the web TaskDetailModal ────────────── */

function TaskDetailSheet({
  task,
  isUpdating,
  onClose,
  onUpdateStatus,
  tCommon,
}: {
  task: Interaction
  isUpdating: boolean
  onClose: () => void
  onUpdateStatus: (status: TaskStatus) => void
  tCommon: ReturnType<typeof useCommonT>
}) {
  const { spacing, colors, radius } = useTheme()
  const insets = useSafeAreaInsets()
  const history = task.statusHistory ?? []
  const customers = task.customers ?? []

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} />
      <View
        style={{
          height: '80%',
          backgroundColor: colors.surfaceBase,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          paddingBottom: insets.bottom + spacing.lg,
        }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="heading">{task.subject}</Text>
              <StatusChip
                label={tCommon(
                  `crm.status.${task.status}`,
                  task.status === 'in_progress' ? 'در حال انجام' : task.status,
                )}
                tone={STATUS_TONE[task.status]}
              />
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.fgTertiary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="legal" tone="tertiary">
                {tCommon('crm.employee', 'نام پرسنل')}
              </Text>
              <Text variant="bodyStrong">{task.employeeName || '-'}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="legal" tone="tertiary">
                {tCommon('crm.interactions.type', 'نوع')}
              </Text>
              <Text variant="bodyStrong">
                {tCommon(`crm.interactions.type.${task.type}`, task.type)}
              </Text>
            </View>
          </View>

          {task.content ? (
            <View style={{ gap: 2 }}>
              <Text variant="legal" tone="tertiary">
                {tCommon('crm.interactions.contentPlaceholder', 'توضیحات')}
              </Text>
              <Text variant="body">{task.content}</Text>
            </View>
          ) : null}

          {/* Customers */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="legal" tone="tertiary">
              {tCommon('crm.selectedCustomers', 'مشتری‌های انتخاب‌شده')} ({customers.length})
            </Text>
            {customers.length === 0 ? (
              <Text variant="caption" tone="tertiary">
                -
              </Text>
            ) : (
              customers.map((c) => (
                <View
                  key={c.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                >
                  <Ionicons name="person-outline" size={13} color={colors.fgTertiary} />
                  <Text variant="caption" style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                  {c.phone ? (
                    <Text variant="legal" tone="tertiary">
                      {c.phone}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>

          {/* Status history */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="legal" tone="tertiary">
              {tCommon('crm.statusTimeline', 'تاریخچه وضعیت')}
            </Text>
            {history.length === 0 ? (
              <Text variant="caption" tone="tertiary">
                -
              </Text>
            ) : (
              history.map((event, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                >
                  <Ionicons
                    name={STATUS_ICON[event.status]}
                    size={14}
                    color={event.status === 'completed' ? colors.success : colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption">
                      {tCommon(`crm.status.${event.status}`, event.status)}
                    </Text>
                    <Text variant="legal" tone="tertiary">
                      {formatDate(event.changedAt)}
                      {event.changedBy
                        ? ` · ${
                            event.changedBy === 'employee'
                              ? tCommon('crm.byEmployee', 'توسط پرسنل')
                              : tCommon('crm.byOwner', 'توسط شما')
                          }`
                        : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Manual status change */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.borderDefault,
              paddingTop: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text variant="legal" tone="tertiary">
              {tCommon('crm.changeStatus', 'تغییر دستی وضعیت')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(Object.keys(STATUS_TONE) as TaskStatus[]).map((s) => {
                const active = task.status === s
                return (
                  <Button
                    key={s}
                    label={tCommon(`crm.status.${s}`, s === 'in_progress' ? 'در حال انجام' : s)}
                    size="sm"
                    variant={active ? 'primary' : 'secondary'}
                    loading={isUpdating && !active}
                    disabled={active || isUpdating}
                    onPress={() => onUpdateStatus(s)}
                  />
                )
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

/* ─── Employee select — native action sheet ─────────────────────────────── */

function EmployeeSelect({
  employeeId,
  employees,
  placeholder,
  onSelect,
}: {
  employeeId: string
  employees: { id: string; name: string }[]
  placeholder: string
  onSelect: (id: string) => void
}) {
  const { colors, spacing } = useTheme()
  const [open, setOpen] = useState(false)
  const selectedName = employees.find((e) => e.id === employeeId)?.name

  const items: ActionSheetItem[] = employees.map((e) => ({
    key: e.id,
    label: e.name,
    onPress: () => onSelect(e.id),
  }))

  return (
    <>
      <Button
        testID="select-employee"
        label={selectedName || placeholder}
        variant="secondary"
        fullWidth
        onPress={() => setOpen(true)}
      />
      <ActionSheet visible={open} onClose={() => setOpen(false)} items={items} />
    </>
  )
}

/* ─── Type select — native action sheet ─────────────────────────────────── */

function TypeSelect({
  type,
  onSelect,
}: {
  type: InteractionType
  onSelect: (type: InteractionType) => void
}) {
  const tCommon = useCommonT()
  const [open, setOpen] = useState(false)
  const items: ActionSheetItem[] = INTERACTION_TYPES.map((it) => ({
    key: it,
    label: tCommon(`crm.interactions.type.${it}`, it),
    onPress: () => onSelect(it),
  }))

  return (
    <>
      <Button
        testID="select-type"
        label={tCommon(`crm.interactions.type.${type}`, type)}
        variant="secondary"
        fullWidth
        onPress={() => setOpen(true)}
      />
      <ActionSheet visible={open} onClose={() => setOpen(false)} items={items} />
    </>
  )
}

/* ─── Multi-customer sheet — reuses the shared customers query ───────────── */

function CustomerMultiSheet({
  visible,
  onClose,
  selected,
  onToggle,
}: {
  visible: boolean
  onClose: () => void
  selected: InteractionCustomer[]
  onToggle: (c: InteractionCustomer) => void
}) {
  const { t } = useTranslation('mobile')
  const tC = useCommonT()
  const { colors, spacing, radius } = useTheme()
  const [search, setSearch] = useState('')

  const query = useCustomers(
    useMemo(() => ({ page: 1, limit: 30, sortDirection: 'desc' as const, search }), [search]),
  )

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} />
      <View
        style={{
          height: '70%',
          backgroundColor: colors.surfaceBase,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          paddingTop: spacing.sm,
        }}
      >
        <View style={{ paddingHorizontal: spacing.md }}>
          <Text variant="heading">{tC('crm.pickCustomersPlaceholder', 'انتخاب مشتری‌ها...')}</Text>
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('common.search')}
          clearAccessibilityLabel={t('common.clear')}
        />
        {query.isLoading ? (
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <Skeleton height={48} />
            <Skeleton height={48} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
            {(query.data?.customers ?? ([] as Customer[])).map((customer: Customer) => {
              const picked = selected.some((c) => c.id === customer.id)
              return (
                <MobileCard
                  key={customer.id}
                  padding="sm"
                  selected={picked}
                  onPress={() =>
                    onToggle({
                      id: customer.id ?? '',
                      name: customer.fullName,
                      phone: customer.phone ?? null,
                    })
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons
                      name={picked ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={picked ? colors.primary : colors.fgTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{customer.fullName}</Text>
                      {customer.phone ? (
                        <Text variant="caption" tone="secondary">
                          {customer.phone}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </MobileCard>
              )
            })}
            <Button
              label={t('common.done', 'انجام شد')}
              variant="ghost"
              fullWidth
              onPress={onClose}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}
