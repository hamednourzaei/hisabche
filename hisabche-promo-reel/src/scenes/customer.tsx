// ============================================
// Hisabche Motion Design Studio — Customer Conversion Scenes
// Dedicated production scenes integrating the 5 customer-conversion primitives:
// 1. OfflineSyncDemoScene
// 2. FragmentedToolsDemoScene
// 3. ProfitWaterfallDemoScene
// 4. WarehouseMovementDemoScene
// 5. DualPerspectiveDemoScene
//
// 100% Dark Studio Theme, full-bleed 9:16 vertical layout.
// ============================================

import { ease, mix, progress } from '../engine/anim'
import type { Cue } from '../engine/types'
import {
  DualPerspectiveWorkflow,
  FragmentedToolsMetaphor,
  OfflineSyncIndicator,
  ProfitWaterfallBreakdown,
  WarehouseNodeMovement,
} from '../ui/customer-primitives'
import { Icon } from '../ui/icons'
import { Rich } from '../ui/rich'

// ─────────────────────────────────────────────────────────────────────────────
// 1. OfflineSyncDemoScene
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineSyncDemoSpec {
  kind: 'offline-sync-demo'
  title: string
  subtitle?: string
  reconnectAt?: number
  syncCompleteAt?: number
}

export function OfflineSyncDemoScene({ spec, t }: { spec: OfflineSyncDemoSpec; t: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '60px 40px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 20%, #10141D 0%, #07080B 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: '#f8fafc',
            margin: '0 0 8px 0',
            lineHeight: 1.3,
          }}
        >
          <Rich text={spec.title} />
        </h2>
        {spec.subtitle && (
          <p style={{ fontSize: 16, color: '#94a3b8', margin: 0 }}>
            <Rich text={spec.subtitle} />
          </p>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <OfflineSyncIndicator
          t={t}
          reconnectAt={spec.reconnectAt ?? 2.6}
          syncCompleteAt={spec.syncCompleteAt ?? 4.4}
        />
      </div>
    </div>
  )
}

export function offlineSyncDemoCues(spec: OfflineSyncDemoSpec): Cue[] {
  const reconnect = spec.reconnectAt ?? 2.6
  const complete = spec.syncCompleteAt ?? 4.4
  return [
    { at: 0.2, kind: 'alert' },
    { at: 1.0, kind: 'tick' },
    { at: 1.8, kind: 'tick' },
    { at: reconnect, kind: 'sync' },
    { at: reconnect + 0.6, kind: 'whoosh' },
    { at: complete, kind: 'success' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FragmentedToolsDemoScene
// ─────────────────────────────────────────────────────────────────────────────

export interface FragmentedToolsDemoSpec {
  kind: 'fragmented-tools-demo'
  title: string
  convergeAt?: number
}

export function FragmentedToolsDemoScene({
  spec,
  t,
}: {
  spec: FragmentedToolsDemoSpec
  t: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '50px 30px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 30%, #121622 0%, #08090C 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: '#f8fafc',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          <Rich text={spec.title} />
        </h2>
      </div>

      <div style={{ width: '100%', maxWidth: 440 }}>
        <FragmentedToolsMetaphor t={t} convergeAt={spec.convergeAt ?? 2.4} />
      </div>
    </div>
  )
}

export function fragmentedToolsDemoCues(spec: FragmentedToolsDemoSpec): Cue[] {
  const converge = spec.convergeAt ?? 2.4
  return [
    { at: 0.2, kind: 'tick' },
    { at: 1.2, kind: 'alert' },
    { at: converge, kind: 'whoosh' },
    { at: converge + 0.8, kind: 'success' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ProfitWaterfallDemoScene
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfitWaterfallDemoSpec {
  kind: 'profit-waterfall-demo'
  title: string
  grossRevenue?: number
  cogs?: number
  expenses?: number
}

export function ProfitWaterfallDemoScene({
  spec,
  t,
}: {
  spec: ProfitWaterfallDemoSpec
  t: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '60px 40px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 20%, #0E1626 0%, #06090F 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: '#f8fafc',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          <Rich text={spec.title} />
        </h2>
      </div>

      <div style={{ width: '100%', maxWidth: 440 }}>
        <ProfitWaterfallBreakdown
          t={t}
          grossRevenue={spec.grossRevenue ?? 280000}
          cogs={spec.cogs ?? 180000}
          opex={spec.expenses ?? 35000}
        />
      </div>
    </div>
  )
}

export function profitWaterfallDemoCues(): Cue[] {
  return [
    { at: 0.3, kind: 'cash' },
    { at: 1.2, kind: 'tick' },
    { at: 2.1, kind: 'alert' },
    { at: 3.2, kind: 'whoosh' },
    { at: 4.1, kind: 'chime' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WarehouseMovementDemoScene
// ─────────────────────────────────────────────────────────────────────────────

export interface WarehouseMovementDemoSpec {
  kind: 'warehouse-movement-demo'
  title: string
  transitAt?: number
  arriveAt?: number
}

export function WarehouseMovementDemoScene({
  spec,
  t,
}: {
  spec: WarehouseMovementDemoSpec
  t: number
}) {
  const transitAt = spec.transitAt ?? 1.8
  const arriveAt = spec.arriveAt ?? 3.8
  const isTransferring = t >= transitAt && t < arriveAt
  const isArrived = t >= arriveAt
  const auditEnter = ease(progress(t, 0.6, 0.4))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '40px 24px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 30%, #101B1E 0%, #070B0D 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: '#f8fafc',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          <Rich text={spec.title} />
        </h2>
      </div>

      <div style={{ width: '100%', maxWidth: 460 }}>
        <WarehouseNodeMovement t={t} transferStartAt={transitAt} transferArriveAt={arriveAt} />

        {/* Live Transaction Audit Trail (Eliminates dead vertical space) */}
        <div
          style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 16,
            background: 'rgba(10, 15, 20, 0.85)',
            border: `1px solid ${
              isArrived
                ? 'rgba(52, 211, 153, 0.35)'
                : isTransferring
                  ? 'rgba(245, 158, 11, 0.35)'
                  : 'rgba(255, 255, 255, 0.08)'
            }`,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            opacity: auditEnter,
            transform: `translateY(${mix(15, 0, auditEnter)}px)`,
            transition: 'border-color 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon
                name={isArrived ? 'check' : isTransferring ? 'truck' : 'file'}
                size={15}
                color={isArrived ? '#34d399' : isTransferring ? '#fbbf24' : '#38bdf8'}
              />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>
                ره‌گیری سند انتقال: TR-9402
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: isArrived
                  ? 'rgba(52, 211, 153, 0.15)'
                  : isTransferring
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(56, 189, 248, 0.15)',
                color: isArrived ? '#34d399' : isTransferring ? '#fbbf24' : '#38bdf8',
              }}
            >
              {isArrived ? 'ثبت نهایی' : isTransferring ? 'درحال جابه‌جایی' : 'پیش‌نویس حواله'}
            </span>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>
            {isArrived
              ? 'تراز انبار مبدا و مقصد به‌روزرسانی شد · صفر مغایرت در کاردکس'
              : isTransferring
                ? 'کاهش اتوماتیک از انبار مرکزی · رزرو در کاردکس شعبات مقصد'
                : 'تطبیق کاردکس با انبارگردانی فیزیکی قبل از صدور مجوز خروج'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function warehouseMovementDemoCues(spec: WarehouseMovementDemoSpec): Cue[] {
  const transit = spec.transitAt ?? 1.8
  const arrive = spec.arriveAt ?? 3.8
  return [
    { at: 0.2, kind: 'scan' },
    { at: transit, kind: 'whoosh' },
    { at: transit + 0.8, kind: 'tick' },
    { at: arrive, kind: 'success' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DualPerspectiveDemoScene
// ─────────────────────────────────────────────────────────────────────────────

export interface DualPerspectiveDemoSpec {
  kind: 'dual-perspective-demo'
  title: string
  saleAt?: number
  journalAt?: number
}

export function DualPerspectiveDemoScene({
  spec,
  t,
}: {
  spec: DualPerspectiveDemoSpec
  t: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '50px 30px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 20%, #151821 0%, #08090C 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: '#f8fafc',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          <Rich text={spec.title} />
        </h2>
      </div>

      <div style={{ width: '100%', maxWidth: 450 }}>
        <DualPerspectiveWorkflow
          t={t}
          click2At={spec.saleAt ?? 1.5}
          journalPostAt={spec.journalAt ?? 2.8}
        />
      </div>
    </div>
  )
}

export function dualPerspectiveDemoCues(spec: DualPerspectiveDemoSpec): Cue[] {
  const sale = spec.saleAt ?? 1.5
  const journal = spec.journalAt ?? 2.8
  return [
    { at: 0.2, kind: 'tick' },
    { at: sale, kind: 'cash' },
    { at: journal, kind: 'sync' },
    { at: journal + 0.8, kind: 'success' },
  ]
}
