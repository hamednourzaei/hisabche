// ============================================
// Hisabche Promo Reel — Standalone Free-Reel View: The Partners' Dispute (44s)
// - Scenario: Two business partners arguing over missing monthly profit
// - Real merchant goods (پسته، زعفران، روغن) and currency (تومان)
// - No bottom subtitle bar (all dialogues integrated on stage)
// - Steady, rock-solid camera (no continuous zoom-in)
// ============================================

import { ease, progress, spring } from '../engine/anim'
import { PARTNERS_SCENES } from './bazaar-humor-data'

export interface FreePartnersReelViewProps {
  t: number
}

export function FreePartnersReelView({ t }: FreePartnersReelViewProps) {
  const currentSceneIndex = PARTNERS_SCENES.findIndex((s) => t >= s.start && t < s.end)
  const sceneIdx = currentSceneIndex === -1 ? PARTNERS_SCENES.length - 1 : currentSceneIndex
  const scene = PARTNERS_SCENES[sceneIdx]!
  const local = t - scene.start
  const isModern = t >= 26.0

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: isModern
          ? 'radial-gradient(circle at 50% 20%, #064e3b 0%, #022c22 60%, #01140e 100%)'
          : 'radial-gradient(circle at 50% 25%, #2a1205 0%, #150902 60%, #080301 100%)',
        color: '#f8fafc',
        fontFamily: 'Vazir, Vazirmatn, Tahoma, sans-serif',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        direction: 'rtl',
        transition: 'background 0.8s ease',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: isModern ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            border: isModern
              ? '1px solid rgba(16, 185, 129, 0.45)'
              : '1px solid rgba(245, 158, 11, 0.45)',
            fontSize: 13,
            fontWeight: 700,
            color: isModern ? '#34d399' : '#fbbf24',
          }}
        >
          <span>{isModern ? '🤝 سهم‌الشرکه شفاف و بی‌کدورت' : '☕ دعوای مالی دو شریک حجره'}</span>
          <span style={{ opacity: 0.6 }}>|</span>
          <span>صحنه {scene.id} از ۷</span>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: isModern ? '#34d399' : '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>حسابچه</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isModern ? '#10b981' : '#f59e0b',
              boxShadow: `0 0 8px ${isModern ? '#10b981' : '#f59e0b'}`,
            }}
          />
        </div>
      </div>

      {/* Main Stage: Active Scene Layer */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: '10px 24px 30px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        {sceneIdx === 0 && <SceneOnePartnersConfront local={local} />}
        {sceneIdx === 1 && <SceneTwoExcelRefError local={local} />}
        {sceneIdx === 2 && <SceneThreeCrumpledReceipts local={local} />}
        {sceneIdx === 3 && <SceneFourHiddenExpenses local={local} />}
        {sceneIdx === 4 && <SceneFiveHisabchePartners local={local} />}
        {sceneIdx === 5 && <SceneSixReconciliation local={local} />}
        {sceneIdx === 6 && <SceneSevenPartnersZen local={local} />}
      </div>
    </div>
  )
}

// ─── SCENE 1: The Accusation - 1 Billion Sales, Only 40M in Bank! ───────────
function SceneOnePartnersConfront({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const slam = spring(Math.max(0, local - 1.2))
  const bubble = spring(Math.max(0, local - 2.2))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#f87171' }}>
          یک میلیارد فروختیم، پس پول‌ها کجاست؟!
        </div>
        <div style={{ fontSize: 13, color: '#fed7aa', marginTop: 4 }}>
          آخر ماه، دخل پر از فاکتور ولی حساب بانک خالی!
        </div>
      </div>

      <div
        style={{
          width: '92%',
          background: 'linear-gradient(135deg, #291811 0%, #150902 100%)',
          border: '2px solid #ea580c',
          borderRadius: 16,
          padding: '20px 22px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '1px solid #7c2d12',
            paddingBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: '#fdba74', fontWeight: 800 }}>حجره کریم و بهروز</span>
          <span style={{ fontSize: 11, color: '#f87171' }}>ترازنامه پایان ماه</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>فروش ناخالص این ماه:</span>
          <span style={{ fontWeight: 900, color: '#38bdf8' }}>۱,۰۰۰,۰۰۰,۰۰۰ تومان</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>موجودی واقعی حساب بانک:</span>
          <span style={{ fontWeight: 900, color: '#ef4444' }}>۴۰,۰۰۰,۰۰۰ تومان!</span>
        </div>

        {local > 1.2 && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              border: '2px dashed #ef4444',
              borderRadius: 10,
              padding: '10px 14px',
              textAlign: 'center',
              transform: `scale(${slam})`,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fca5a5' }}>
              آقا کریم: «نکنه برداشتی داشتی بهروز؟ پس این همه پول کجا رفت؟!»
            </div>
          </div>
        )}
      </div>

      {local > 2.2 && (
        <div
          style={{
            marginTop: 16,
            width: '88%',
            background: '#b91c1c',
            color: '#fff',
            borderRadius: 12,
            padding: '12px 16px',
            transform: `scale(${bubble})`,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          سوتفاهم مالی، شک و دلخوری؛ بزرگ‌ترین قاتل شراکت‌های بازار!
        </div>
      )}
    </div>
  )
}

// ─── SCENE 2: The Freezing Excel Sheet & Cigarette Pack Receipts ─────────────
function SceneTwoExcelRefError({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const stamp = spring(Math.max(0, local - 2.0))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24' }}>
          اکسل با ۵۰۰۰ ردیف ارور #REF!
        </div>
        <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4 }}>
          فاکتورهای نوشته‌شده پشت جعبه شیرینی و پاکت سیگار!
        </div>
      </div>

      <div
        style={{
          width: '90%',
          background: '#0f172a',
          border: '2px solid #475569',
          borderRadius: 14,
          padding: '18px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          fontFamily: 'monospace',
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: '#94a3b8',
            borderBottom: '1px solid #334155',
            paddingBottom: 6,
          }}
        >
          <span>A1: شرح خرید پسته و زعفران</span>
          <span>B1: مبالغ</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
          <span>خرید عمده زعفران قائنات:</span>
          <span style={{ fontWeight: 900 }}>#REF!</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
          <span>کرایه وانت و تخلیه بار:</span>
          <span style={{ fontWeight: 900 }}>#VALUE!</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
          <span>هزینه بسته‌بندی کارتن:</span>
          <span style={{ fontWeight: 900 }}>#NAME?</span>
        </div>

        {local > 1.8 && (
          <div
            style={{
              marginTop: 8,
              background: '#451a03',
              border: '2px solid #f59e0b',
              borderRadius: 8,
              padding: '10px 12px',
              fontFamily: 'Vazirmatn, sans-serif',
              transform: `scale(${stamp})`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fde68a' }}>
              بهروز: «تو فاکتورها رو پشت پاکت سیگار می‌نویسی می‌اندازی رو میز، من از کجا بفهمم بابت
              چی بوده؟!»
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 3: Crumpled Receipts & Faded Thermal Paper ───────────────────────
function SceneThreeCrumpledReceipts({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const card = spring(Math.max(0, local - 1.5))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#f87171' }}>
          فاکتورهای جیبی و قبض‌های عابر پریده!
        </div>
        <div style={{ fontSize: 13, color: '#fecaca', marginTop: 4 }}>
          ۷۵ میلیون تومن کارت کشیدی، بابت چی؟! فاکتورش کو؟!
        </div>
      </div>

      <div
        style={{
          width: '90%',
          background: '#f8fafc',
          color: '#1e293b',
          borderRadius: 14,
          padding: '18px 20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          border: '2px solid #cbd5e1',
          transform: 'rotate(-2deg)',
          fontFamily: 'Tahoma, sans-serif',
        }}
      >
        <div
          style={{
            borderBottom: '2px dashed #94a3b8',
            paddingBottom: 8,
            marginBottom: 8,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          رسید دستگاه پوز سیار — جوهر پاک‌شده
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          مبلغ پرداختی: <span style={{ color: '#dc2626' }}>۷۵,۰۰۰,۰۰۰ تومان</span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          نام پذیرنده:{' '}
          <span style={{ textDecoration: 'line-through' }}>[نامشخص - جوهر چای ریخته]</span>
        </div>

        {local > 1.2 && (
          <div
            style={{
              marginTop: 10,
              background: '#fee2e2',
              border: '2px solid #dc2626',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#991b1b',
              fontWeight: 900,
              fontSize: 13,
              transform: `scale(${card})`,
            }}
          >
            ❌ نه فاکتور دارد، نه فیش خرید، نه ثبت در دفتر!
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 4: 220 Million Tomans in Phantom Petty Expenses ───────────────────
function SceneFourHiddenExpenses({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const stamp = spring(Math.max(0, local - 1.8))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 25, fontWeight: 900, color: '#ef4444' }}>
          ۲۲۰ میلیون تومان هزینه پنهان بی‌سند!
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
          کرایه وانت، انعام، پیک و تخفیف‌های شفاهی که ثبت نشدند
        </div>
      </div>

      <div
        style={{
          width: '90%',
          background: 'rgba(30, 41, 59, 0.9)',
          border: '2px solid #dc2626',
          borderRadius: 14,
          padding: '18px 20px',
          boxShadow: '0 20px 40px rgba(220, 38, 38, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>کرایه باربری و تخلیه بدون فیش:</span>
          <span style={{ fontWeight: 800, color: '#ef4444' }}>۶۸,۰۰۰,۰۰۰ تومان</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>تخفیف‌های شفاهی به مشتریان قدیمی:</span>
          <span style={{ fontWeight: 800, color: '#ef4444' }}>۹۲,۰۰۰,۰۰۰ تومان</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>مساعده کارگران و هزینه‌های روزمره:</span>
          <span style={{ fontWeight: 800, color: '#ef4444' }}>۶۰,۰۰۰,۰۰۰ تومان</span>
        </div>

        {local > 1.6 && (
          <div
            style={{
              marginTop: 6,
              background: '#b91c1c',
              color: '#ffffff',
              borderRadius: 8,
              padding: '10px 14px',
              textAlign: 'center',
              fontWeight: 900,
              fontSize: 16,
              transform: `scale(${stamp})`,
            }}
          >
            سود واقعی دود شد؛ رفاقت‌ها هم به خطر افتاد!
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 5: The Hisabche Partner Solution (Mobile + Dashboard) ────────────
function SceneFiveHisabchePartners({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const card1 = spring(Math.max(0, local - 0.8))
  const card2 = spring(Math.max(0, local - 2.2))
  const card3 = spring(Math.max(0, local - 3.8))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 25, fontWeight: 900, color: '#34d399' }}>
          حسابچه؛ معجزه شفافیت حساب شرکا
        </div>
        <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 4 }}>
          ثبت سند هزینه با یک عکس در بازار و داشبورد زنده سهم‌الشرکه
        </div>
      </div>

      <div style={{ width: '92%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid #10b981',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transform: `scale(${card1})`,
          }}
        >
          <div style={{ fontSize: 26 }}>📸</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
              ثبت آنی فاکتور خرید در بازار با گوشی
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              آقا کریم عکس فاکتور رو می‌گیره؛ سند در ثانیه در دفتر کل ثبت می‌شه
            </div>
          </div>
        </div>

        {local > 2.0 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #10b981',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transform: `scale(${card2})`,
            }}
          >
            <div style={{ fontSize: 26 }}>📊</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                داشبورد زنده سهم‌الشرکه شرکا
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                بهروز در لحظه موجودی بانک، بدهکاران و سود واقعی را می‌بیند
              </div>
            </div>
          </div>
        )}

        {local > 3.5 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #10b981',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transform: `scale(${card3})`,
            }}
          >
            <div style={{ fontSize: 26 }}>🔒</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
                تفکیک حساب تنخواه و برداشت شخصی
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                هیچ برداشتی بدون ثبت سند دوبل رد نمی‌شود؛ حساب مو لا درزش نمی‌ره
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 6: Reconciliation & Equal Profit (180 Million Each!) ─────────────
function SceneSixReconciliation({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const card = spring(Math.max(0, local - 1.2))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 25, fontWeight: 900, color: '#38bdf8' }}>
          لبخند و رفاقت؛ سود شفاف هر دو شریک
        </div>
        <div style={{ fontSize: 13, color: '#bae6fd', marginTop: 4 }}>
          بدون شک و سوتفاهم؛ ترازنامه ۱۰۰٪ شفاف تا تک‌ریال
        </div>
      </div>

      <div
        style={{
          width: '90%',
          background: '#0f172a',
          border: '2px solid #0284c7',
          borderRadius: 14,
          padding: '18px 20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155',
            paddingBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: '#94a3b8' }}>تقسیم سود رسمی شراکت</span>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 800 }}>تراز شده ✓</span>
        </div>

        <div
          style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid #38bdf8',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transform: `scale(${card})`,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>سهم سود آقا کریم:</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8' }}>۱۸۰,۰۰۰,۰۰۰ تومان</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>سهم سود بهروز:</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8' }}>۱۸۰,۰۰۰,۰۰۰ تومان</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6ee7b7', textAlign: 'center', fontWeight: 700 }}>
          🤝 بدون یک ریال اختلاف، با رفاقت پایدار و اعتماد کامل!
        </div>
      </div>
    </div>
  )
}

// ─── SCENE 7: Final Partners Call to Action ─────────────────────────────────
function SceneSevenPartnersZen({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const btnSpring = spring(Math.max(0, local - 1.0))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        opacity: enter,
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 10 }}>🤝✨</div>

      <div style={{ fontSize: 26, fontWeight: 900, color: '#fef3c7', lineHeight: 1.3 }}>
        رفاقت سر جاش، حساب مو لا درزش نره!
      </div>
      <div style={{ fontSize: 14, color: '#34d399', marginTop: 6, fontWeight: 700 }}>
        نرم‌افزار حسابداری شراکت و پایان سوتفاهم‌های مالی بازار
      </div>

      <div
        style={{
          marginTop: 18,
          width: '84%',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 14,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>اختلاف حساب</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#10b981' }}>۰ ریال</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>اعتماد شرکا</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8' }}>۱۰۰٪</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>شفافیت مالی</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fbbf24' }}>تک‌ریالی</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          transform: `scale(${btnSpring})`,
          width: '88%',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            borderRadius: 14,
            padding: '14px 24px',
            fontSize: 16,
            fontWeight: 900,
            boxShadow: '0 12px 30px rgba(16, 185, 129, 0.4)',
          }}
        >
          شروع رایگان در hisabche.com
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          حسابداری شرکا، اپ موبایل و گزارش دقیق سهم‌الشرکه
        </div>
      </div>
    </div>
  )
}
