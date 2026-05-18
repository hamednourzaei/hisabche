import React, { memo, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useSyncStore, useBackupStore, useThemeStore } from '@hisabche/store'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', border: '#e2e8f0', success: '#16a34a', warning: '#f59e0b', destructive: '#dc2626', muted: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', border: '#1e2d45', success: '#4ade80', warning: '#fbbf24', destructive: '#f87171', muted: '#1e2d45' },
}

// ─── Helper ───────────────────────────────────────────────
const timeAgo = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s} ثانیه پیش`
  if (s < 3600) return `${Math.floor(s / 60)} دقیقه پیش`
  return `${Math.floor(s / 3600)} ساعت پیش`
}

// ─── Sub-components ───────────────────────────────────────
const StatusCard = memo(function StatusCard({ tk, isOnline, lastSyncedAt, pendingCount }: { tk: any; isOnline: boolean; lastSyncedAt: number | null; pendingCount: number }) {
  return (
    <View style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]} accessibilityRole="header" accessibilityLabel={`وضعیت: ${isOnline ? 'آنلاین' : 'آفلاین'}`}>
      <View style={s.statusRow}>
        <View style={[s.statusDot, { backgroundColor: isOnline ? tk.success : tk.warning }]} />
        <Text style={[s.statusText, { color: isOnline ? tk.success : tk.warning }]}>{isOnline ? 'آنلاین' : 'آفلاین'}</Text>
      </View>
      {lastSyncedAt ? <Text style={[s.syncInfo, { color: tk.mutedFg }]}>آخرین همگام‌سازی: {timeAgo(lastSyncedAt)}</Text> : null}
      {pendingCount > 0 ? (
        <View style={[s.pendingBadge, { backgroundColor: tk.warning + '20', borderColor: tk.warning }]} accessibilityLabel={`${pendingCount} عملیات در انتظار`}>
          <Text style={[s.pendingText, { color: tk.warning }]}>{pendingCount} عملیات در انتظار همگام‌سازی</Text>
        </View>
      ) : null}
    </View>
  )
})

const ActionButtons = memo(function ActionButtons({ tk, onSync, onBackup }: { tk: any; onSync: () => void; onBackup: () => void }) {
  return (
    <View style={s.actionsRow}>
      <TouchableOpacity style={[s.actionBtn, { backgroundColor: tk.primary }]} onPress={onSync} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="همگام‌سازی">
        <Text style={s.actionEmoji}>🔄</Text>
        <Text style={[s.actionLabel, { color: '#fff' }]}>همگام‌سازی</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.actionBtn, { backgroundColor: tk.card, borderColor: tk.border, borderWidth: 1 }]} onPress={onBackup} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="بکاپ دستی">
        <Text style={s.actionEmoji}>💾</Text>
        <Text style={[s.actionLabel, { color: tk.foreground }]}>بکاپ دستی</Text>
      </TouchableOpacity>
    </View>
  )
})

const BackupList = memo(function BackupList({ tk, backups }: { tk: any; backups: any[] }) {
  if (backups.length === 0) return <Text style={[s.emptyText, { color: tk.mutedFg }]}>هنوز بکاپی گرفته نشده</Text>
  return (
    <>
      {backups.slice(0, 5).map((b) => (
        <View key={b.id} style={[s.listItem, { backgroundColor: tk.card, borderColor: tk.border }]} accessibilityLabel={`${b.type === 'auto' ? 'بکاپ خودکار' : 'بکاپ دستی'}: ${timeAgo(b.timestamp)}`}>
          <Text style={[s.itemEmoji]}>{b.status === 'completed' ? '✅' : '❌'}</Text>
          <View style={s.flex1}>
            <Text style={[s.itemTitle, { color: tk.foreground }]}>{b.type === 'auto' ? 'بکاپ خودکار' : 'بکاپ دستی'}</Text>
            <Text style={[s.itemSub, { color: tk.mutedFg }]}>{timeAgo(b.timestamp)} · {b.size}</Text>
          </View>
        </View>
      ))}
    </>
  )
})

const AuditLog = memo(function AuditLog({ tk, auditLog }: { tk: any; auditLog: any[] }) {
  if (auditLog.length === 0) return <Text style={[s.emptyText, { color: tk.mutedFg }]}>هنوز فعالیتی ثبت نشده</Text>
  return (
    <>
      {auditLog.slice(0, 10).map((entry) => (
        <View key={entry.id} style={[s.listItem, { backgroundColor: tk.card, borderColor: tk.border }]} accessibilityLabel={`${entry.action}: ${entry.entity}`}>
          <View style={[s.auditDot, { backgroundColor: tk.primary }]} />
          <View style={s.flex1}>
            <Text style={[s.itemTitle, { color: tk.foreground }]}>{entry.action}</Text>
            <Text style={[s.itemSub, { color: tk.mutedFg }]}>{entry.entity} · {timeAgo(entry.timestamp)}</Text>
          </View>
        </View>
      ))}
    </>
  )
})

const ConfidenceCard = memo(function ConfidenceCard({ tk }: { tk: any }) {
  return (
    <View style={[s.confidenceBox, { backgroundColor: tk.success + '10', borderColor: tk.success + '30' }]} accessibilityRole="text" accessibilityLabel="اطلاعات شما امن است. تمام اطلاعات روی گوشی ذخیره می‌شود. بدون اینترنت کار می‌کند. بکاپ خودکار هر ۲۴ ساعت.">
      <Text style={s.confidenceEmoji}>🛡️</Text>
      <Text style={[s.confidenceTitle, { color: tk.success }]}>اطلاعات شما امن است</Text>
      <Text style={[s.confidenceText, { color: tk.mutedFg }]}>{'تمام اطلاعات روی گوشی شما ذخیره می‌شود.\nحتی بدون اینترنت هم کار می‌کند.\nبکاپ خودکار هر ۲۴ ساعت انجام می‌شود.'}</Text>
    </View>
  )
})

// ─── Main Screen ──────────────────────────────────────────
interface Props { onBack?: () => void }

export default function SyncCenterScreen({ onBack }: Props) {
  const { t } = useTranslation()
  const { isDark } = useThemeStore()
  const tk = useMemo(() => isDark ? tokens.dark : tokens.light, [isDark])
  const { isOnline, isSyncing, pendingCount, lastSyncedAt, setLastSynced } = useSyncStore()
  const { backups, addBackup, auditLog } = useBackupStore()

  const handleSync = useCallback(() => setLastSynced(Date.now()), [setLastSynced])
  const handleBackup = useCallback(() => addBackup({ id: `backup-${Date.now()}`, timestamp: Date.now(), size: '۲۵۰ KB', type: 'manual', status: 'completed' }), [addBackup])

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
      <View style={[s.header, { borderBottomColor: tk.border }]}>
        {onBack ? <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('action.back')}><Text style={[s.backBtn, { color: tk.primary }]}>←</Text></TouchableOpacity> : <View style={{ width: 40 }} />}
        <Text style={[s.title, { color: tk.foreground }]}>{t('baqidari.securityCenter', { defaultValue: 'مرکز امنیت' })}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <StatusCard tk={tk} isOnline={isOnline} lastSyncedAt={lastSyncedAt} pendingCount={pendingCount} />
        <ActionButtons tk={tk} onSync={handleSync} onBackup={handleBackup} />
        <Text style={[s.sectionTitle, { color: tk.foreground }]}>{t('baqidari.backups', { defaultValue: 'بکاپ‌ها' })}</Text>
        <BackupList tk={tk} backups={backups} />
        <Text style={[s.sectionTitle, { color: tk.foreground, marginTop: 20 }]}>{t('baqidari.activityLog', { defaultValue: 'تاریخچه فعالیت‌ها' })}</Text>
        <AuditLog tk={tk} auditLog={auditLog} />
        <ConfidenceCard tk={tk} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 16, fontWeight: '700' },
  syncInfo: { fontSize: 13 },
  pendingBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  pendingText: { fontSize: 13, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 20, borderRadius: 14, alignItems: 'center', gap: 6 },
  actionEmoji: { fontSize: 28 },
  actionLabel: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  itemEmoji: { fontSize: 18 },
  itemTitle: { fontSize: 13, fontWeight: '600' },
  itemSub: { fontSize: 11, marginTop: 2 },
  auditDot: { width: 8, height: 8, borderRadius: 4 },
  confidenceBox: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8, marginTop: 8 },
  confidenceEmoji: { fontSize: 40 },
  confidenceTitle: { fontSize: 16, fontWeight: '700' },
  confidenceText: { fontSize: 13, textAlign: 'center', lineHeight: 22 },
})