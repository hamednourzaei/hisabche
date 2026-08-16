// ============================================
// Invoice list — search, status filter chips, swipe actions.
// Server data is merged with the offline outbox so a freshly created
// offline invoice appears immediately.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, Share, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useInvoices, type InvoiceWithCustomer } from '@hisabche/api'
import { csvFilename } from '@hisabche/formatting'
import {
  INVOICE_EXPORT_COLUMNS,
  invoiceTypeLabelKey,
  resolveExportColumns,
} from '@hisabche/ui-contract'
import type { InvoiceStatus } from '@hisabche/validation'
import {
  FilterBar,
  FloatingButton,
  MetricCard,
  SearchBar,
  SwipeRow,
  Text,
  useLayout,
  useTheme,
  type FilterOption,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { SelectionBar } from '../../../shared/components/selection-bar'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { shareAsCSV } from '../../../shared/lib/export-csv'
import { currencySign, formatAmount } from '../../../shared/lib/format'
import { useSelectionMode } from '../../../shared/hooks/use-selection-mode'
import { useCurrency } from '../../settings/preferences.store'
import { usePendingInvoices } from '../../offline/use-outbox'
import { InvoiceRow } from '../components/invoice-row'

const PAGE_SIZE = 20

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue'

/** Mirrors the web list's filter — همه / فروش / خرید. */
type TypeFilter = 'all' | 'sale' | 'purchase'

function statusKey(status: InvoiceStatus): string {
  return `sales.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

// ─── Bento stats — same semantics as web's InvoicesView ───────────────────
// Web shows 4 cards computed from the *filtered* invoices (never paginated):
// مجموع مبلغ / تعداد فاکتورها / در انتظار پرداخت / تسویه‌شده, each with a
// month-over-month delta pill. Cancelled invoices are excluded everywhere.
// The compact formatter mirrors web's `compactAmount` thresholds.

const PAID_STATUSES = new Set(['paid', 'completed'])

function monthOffset(value: string | undefined, now: Date): number | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

function compactAmount(v: number): string {
  const abs = Math.abs(v)
  const n = (x: number, d = 0) =>
    x.toLocaleString('fa-AF', { minimumFractionDigits: d, maximumFractionDigits: d })
  if (abs >= 1e9) return `${n(v / 1e9, abs >= 1e10 ? 0 : 1)} میلیارد`
  if (abs >= 1e6) return `${n(v / 1e6, abs >= 1e7 ? 0 : 1)} میلیون`
  return n(v)
}

interface InvoiceStat {
  id: string
  icon: 'cash-outline' | 'document-text-outline' | 'time-outline' | 'checkmark-circle-outline'
  label: string
  value: string
  delta: number | null
  /** Web's `invertDelta` — an increase here is bad (pending amount). */
  invert: boolean
}

function useInvoiceStats(
  invoices: InvoiceWithCustomer[],
  tCommon: ReturnType<typeof useCommonT>,
): InvoiceStat[] {
  return React.useMemo<InvoiceStat[]>(() => {
    const now = new Date()
    const active = invoices.filter((inv) => inv.status !== 'cancelled')
    const inMonth = (offset: number) =>
      active.filter((inv) => monthOffset(inv.date ?? inv.createdAt, now) === offset)
    const sum = (list: InvoiceWithCustomer[]) =>
      list.reduce((acc, inv) => acc + (inv.total ?? 0), 0)
    const paid = (list: InvoiceWithCustomer[]) =>
      list.filter((inv) => PAID_STATUSES.has(inv.status ?? ''))
    const pending = (list: InvoiceWithCustomer[]) =>
      list.filter((inv) => !PAID_STATUSES.has(inv.status ?? ''))

    const cur = inMonth(0)
    const prev = inMonth(1)
    const currency = active[0]?.currency ?? 'AFN'
    const monthly = tCommon('common.vsLastMonth', 'نسبت به ماه قبل')

    // Same order as web: amount first, count second, pending before paid.
    return [
      {
        id: 'amount',
        icon: 'cash-outline',
        label: tCommon('invoices.totalAmount', 'مجموع مبلغ'),
        value: `${compactAmount(sum(active))} ${currency}`,
        delta: percentChange(sum(cur), sum(prev)),
        invert: false,
      },
      {
        id: 'count',
        icon: 'document-text-outline',
        label: tCommon('invoices.totalCount', 'تعداد فاکتورها'),
        value: compactAmount(active.length),
        delta: percentChange(cur.length, prev.length),
        invert: false,
      },
      {
        id: 'pending',
        icon: 'time-outline',
        label: tCommon('invoices.pendingAmount', 'در انتظار پرداخت'),
        value: `${compactAmount(sum(pending(active)))} ${currency}`,
        delta: percentChange(sum(pending(cur)), sum(pending(prev))),
        invert: true,
      },
      {
        id: 'paid',
        icon: 'checkmark-circle-outline',
        label: tCommon('invoices.paidAmount', 'تسویه‌شده'),
        value: `${compactAmount(sum(paid(active)))} ${currency}`,
        delta: percentChange(sum(paid(cur)), sum(paid(prev))),
        invert: false,
      },
    ]
  }, [invoices, tCommon])
}

export function InvoicesScreen() {
  const { t } = useTranslation('mobile')
  // Destination copy and export headings come from the shared catalog, so this
  // screen is titled with the same words the web page uses.
  const tCommon = useCommonT()
  const { colors, spacing } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')

  const filters = useMemo(
    () => ({
      page: 1,
      limit: PAGE_SIZE,
      sortDirection: 'desc' as const,
      search,
      ...(status === 'all' ? {} : { status: status as InvoiceStatus }),
      // Filter on the canonical `invoice.type`, never on display text — the
      // same field the web list and the backend query use.
      ...(type === 'all' ? {} : { type }),
    }),
    [search, status, type],
  )

  const query = useInvoices(filters)
  const pending = usePendingInvoices()
  const { isWide } = useLayout()

  const items = useMemo<InvoiceWithCustomer[]>(() => {
    // Queued invoices have not reached the server, so the server-side filter
    // cannot see them; apply the same predicate locally rather than dropping
    // them from a filtered view.
    const queued =
      status === 'all'
        ? pending.filter((invoice) => type === 'all' || (invoice.type ?? 'sale') === type)
        : []

    return [...queued, ...(query.data?.invoices ?? [])]
  }, [pending, query.data, status, type])

  // Web's BentoStats reads the *filtered* set (never paginated). The mobile
  // list is one fetch of the filtered page, so `items` is the closest match —
  // pending-queued rows included, exactly like web counts its own list.
  const stats = useInvoiceStats(items, tCommon)

  const options: readonly FilterOption<StatusFilter>[] = [
    { value: 'all', label: t('common.all'), count: items.length },
    { value: 'pending', label: t('sales.statusPending') },
    { value: 'paid', label: t('sales.statusPaid') },
    { value: 'overdue', label: t('sales.statusOverdue') },
  ]

  const typeOptions: readonly FilterOption<TypeFilter>[] = [
    { value: 'all', label: t('common.all') },
    { value: 'sale', label: t('sales.sale') },
    { value: 'purchase', label: t('sales.purchase') },
  ]

  // Native selection: long-press a row to enter selection mode, then tap to
  // toggle. No permanent checkbox column — that is a desktop table idiom and
  // would cost row space on a phone.
  const selection = useSelectionMode()

  const visibleIds = useMemo(
    () => items.map((invoice) => invoice.id).filter((id): id is string => Boolean(id)),
    [items],
  )

  useEffect(() => {
    selection.prune(visibleIds)
  }, [visibleIds, selection])

  const openDetail = useCallback(
    (id: string) => {
      // While selecting, a tap toggles instead of navigating away.
      if (selection.active) {
        selection.toggle(id)
        return
      }
      router.push(`/invoices/${id}`)
    },
    [router, selection],
  )

  const openCreate = useCallback(() => router.push('/(tabs)/quick-invoice'), [router])

  // Exports what is currently filtered — the same rule the web export follows,
  // so the user gets what they can see.
  const exportCsv = useCallback(async () => {
    const rows = items.map((invoice) => ({
      ...invoice,
      typeLabel: tCommon(invoiceTypeLabelKey(invoice.type)),
    }))

    const result = await shareAsCSV(
      rows,
      resolveExportColumns<(typeof rows)[number]>(INVOICE_EXPORT_COLUMNS, tCommon),
      csvFilename('invoices', new Date()),
    )

    if (result === 'empty') Alert.alert(t('sales.emptyTitle'))
    if (result === 'unavailable') Alert.alert(t('common.error'))
  }, [items, t, tCommon])

  const shareSelected = useCallback(() => {
    const chosen = items.filter((invoice) => invoice.id && selection.isSelected(invoice.id))
    const message = chosen
      .map(
        (invoice) =>
          `${invoice.invoiceNumber} — ${formatAmount(invoice.total ?? 0)} ${currencySign(currency)}`,
      )
      .join('\n')

    if (message) void Share.share({ message })
    selection.exit()
  }, [items, selection, currency])

  const shareInvoice = useCallback(
    (invoice: InvoiceWithCustomer) => {
      const line = `${invoice.invoiceNumber} — ${formatAmount(invoice.total ?? 0)} ${currencySign(currency)}`
      void Share.share({ message: line })
    },
    [currency],
  )

  return (
    <AppScreen>
      {selection.active ? (
        <SelectionBar
          count={selection.selectedCount}
          countLabel={t('common.selectedCount', {
            count: selection.selectedCount,
            defaultValue: `${selection.selectedCount}`,
          })}
          exitLabel={t('common.cancel')}
          onExit={selection.exit}
          actions={[
            {
              key: 'share',
              label: t('common.share'),
              icon: 'share-outline',
              onPress: shareSelected,
            },
          ]}
        />
      ) : (
        <NavScreenHeader
          id="get-paid"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tCommon('common.export', 'خروجی CSV')}
              testID="export-invoices"
              onPress={() => void exportCsv()}
              hitSlop={12}
            >
              <Ionicons name="download-outline" size={20} color={colors.fgSecondary} />
            </Pressable>
          }
        />
      )}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />
      <FilterBar options={typeOptions} value={type} onChange={setType} />
      <FilterBar options={options} value={status} onChange={setStatus} />

      {/* Bento stats — web renders its 4 cards between the toolbar and the
          table; mobile shows the same cards in a 2×2 (4-across on wide) grid.
          Each tile: icon chip + label, compact value, month-over-month pill. */}
      {items.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {stats.map((stat) => {
            const good = stat.delta === null || (stat.invert ? stat.delta < 0 : stat.delta >= 0)
            return (
              <View
                key={stat.id}
                style={{
                  flexBasis: isWide ? '22%' : '47%',
                  flexGrow: 1,
                  minWidth: isWide ? 0 : 150,
                }}
              >
                <MetricCard
                  label={stat.label}
                  amount={stat.value}
                  icon={<Ionicons name={stat.icon} size={15} color={colors.primary} />}
                  loading={false}
                />
                {stat.delta !== null ? (
                  <View style={{ marginTop: spacing.xs, paddingHorizontal: spacing.sm }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        alignSelf: 'flex-start',
                        gap: spacing.xs,
                        borderRadius: 999,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        backgroundColor: good ? colors.successSoft : colors.destructiveSoft,
                      }}
                    >
                      <Ionicons
                        name={stat.delta >= 0 ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={good ? colors.success : colors.destructive}
                      />
                      <Text
                        variant="legal"
                        style={{ color: good ? colors.success : colors.destructive }}
                      >
                        {Math.abs(stat.delta).toLocaleString('fa-AF', {
                          maximumFractionDigits: Math.abs(stat.delta) < 10 ? 1 : 0,
                        })}
                        ٪
                      </Text>
                      <Text variant="legal" tone="tertiary">
                        {tCommon('common.vsLastMonth', 'نسبت به ماه قبل')}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}

      <QueryList<InvoiceWithCustomer>
        data={items}
        estimatedItemSize={96}
        isLoading={query.isLoading}
        isRefetching={query.isRefetching}
        error={query.error}
        onRetry={query.refetch}
        keyExtractor={(item, index) => item.id ?? `pending-${index}`}
        emptyTitle={t('sales.emptyTitle')}
        emptyDescription={t('sales.emptyDescription')}
        emptyAction={{ label: t('sales.newInvoice'), onPress: openCreate }}
        renderItem={({ item }) => (
          <SwipeRow
            actions={[
              {
                key: 'share',
                label: t('common.share'),
                tone: 'brand',
                icon: <Ionicons name="share-outline" size={17} color={colors.primaryFg} />,
                onPress: () => shareInvoice(item),
              },
            ]}
          >
            <InvoiceRow
              invoice={item}
              currency={currency}
              statusLabel={t(statusKey((item.status ?? 'pending') as InvoiceStatus), {
                defaultValue: item.status ?? '',
              })}
              typeLabel={
                (item.type ?? 'sale') === 'purchase' ? t('sales.purchase') : t('sales.sale')
              }
              settledLabel={tCommon('invoices.paymentDate', 'تاریخ تسویه')}
              onPress={openDetail}
              onLongPress={item.id ? () => selection.begin(item.id as string) : undefined}
              selected={item.id ? selection.isSelected(item.id) : false}
            />
          </SwipeRow>
        )}
      />

      <FloatingButton
        testID="fab-new-invoice"
        accessibilityLabel={t('sales.newInvoice')}
        label={t('sales.newInvoice')}
        onPress={openCreate}
        bottomOffset={62}
        icon={<Ionicons name="add" size={20} color={colors.primaryFg} />}
      />
    </AppScreen>
  )
}
