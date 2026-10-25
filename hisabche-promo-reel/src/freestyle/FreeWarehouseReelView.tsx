// ============================================
// Hisabche Promo Reel — Standalone Free-Reel View: The Phantom Warehouse (42s)
// - Scenario: Missing warehouse detergent boxes & driver waiting
// - Real merchant goods (کارتن شوینده، مایع ظرفشویی) and currency (تومان)
// - No bottom subtitle bar (all dialogues integrated on stage)
// - Steady, rock-solid camera (no continuous zoom-in)
// ============================================

import { ease, mix, progress, spring } from '../engine/anim'
import { WAREHOUSE_SCENES } from './bazaar-humor-data'

export interface FreeWarehouseReelViewProps {
  t: number
}

export function FreeWarehouseReelView({ t }: FreeWarehouseReelViewProps) {
  const currentSceneIndex = WAREHOUSE_SCENES.findIndex((s) => t >= s.start && t < s.end)
  const sceneIdx = currentSceneIndex === -1 ? WAREHOUSE_SCENES.length - 1 : currentSceneIndex
  const scene = WAREHOUSE_SCENES[sceneIdx]!
  const local = t - scene.start
  const isModern = t >= 24.0

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: isModern
          ? 'radial-gradient(circle at 50% 20%, #064e3b 0%, #022c22 60%, #01140e 100%)'
          : 'radial-gradient(circle at 50% 25%, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
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
            background: isModern ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: isModern
              ? '1px solid rgba(16, 185, 129, 0.45)'
              : '1px solid rgba(239, 68, 68, 0.45)',
            fontSize: 13,
            fontWeight: 700,
            color: isModern ? '#34d399' : '#f87171',
          }}
        >
          <span>{isModern ? '⚡ انبارداری هوشمند ابری' : '📦 بحران موجودی در انبار'}</span>
          <span style={{ opacity: 0.6 }}>|</span>
          <span>صحنه {scene.id} از ۷</span>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: isModern ? '#34d399' : '#38bdf8',
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
              background: isModern ? '#10b981' : '#38bdf8',
              boxShadow: `0 0 8px ${isModern ? '#10b981' : '#38bdf8'}`,
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
        {sceneIdx === 0 && <SceneOneTruckWaiting local={local} />}
        {sceneIdx === 1 && <SceneTwoAisleSearch local={local} />}
        {sceneIdx === 2 && <SceneThreePhoneRage local={local} />}
        {sceneIdx === 3 && <SceneFourAuditDisaster local={local} />}
        {sceneIdx === 4 && <SceneFiveHisabcheTablet local={local} />}
        {sceneIdx === 5 && <SceneSixDriverSign local={local} />}
        {sceneIdx === 6 && <SceneSevenWarehouseZen local={local} />}
      </div>
    </div>
  )
}

// ─── SCENE 1: The Blue Nissan Pickup Truck Waiting at Door ──────────────────
function SceneOneTruckWaiting({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const truckSlide = mix(-60, 0, enter)
  const hornShake = local > 1.2 && local < 2.5 ? Math.sin((local - 1.2) * 35) * 5 : 0
  const bubble = spring(Math.max(0, local - 1.8))
  const counterSpring = spring(Math.max(0, local - 3.2))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(${truckSlide}px) translateX(${hornShake}px)`,
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 25, fontWeight: 900, color: '#f87171' }}>
          نیسان دم در انبار با بوق ممتد!
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
          بارنامه ۵۰ کارتن شوینده است، ولی قفسه خالیه!
        </div>
      </div>

      {/* Nissan Pickup Graphic Box */}
      <div
        style={{
          width: '92%',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
          border: '2px solid #3b82f6',
          borderRadius: 16,
          padding: '20px 22px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 32 }}>🚚</span>
          <span
            style={{
              background: '#ef4444',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            📢 بوق راننده نیسان!
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>
          راننده با بارنامه کاغذی:
          <br />
          <span style={{ color: '#93c5fd' }}>
            «۵۰ کارتن مایع شوینده و جرم‌گیر تحویل بده تا حرکت کنم!»
          </span>
        </div>

        {/* Missing Box Counter */}
        {local > 3.0 && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              border: '2px dashed #ef4444',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transform: `scale(${counterSpring})`,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#fca5a5' }}>موجودی شمارش‌شده قفسه:</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fecaca' }}>۳۴ کارتن</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: '#fca5a5' }}>کسری نامعلوم:</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>
                ❌ ۱۶ کارتن غیب شده!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Speech Bubble */}
      {local > 1.6 && (
        <div
          style={{
            marginTop: 18,
            width: '88%',
            background: '#b91c1c',
            color: '#fff',
            borderRadius: 14,
            padding: '12px 18px',
            transform: `scale(${bubble})`,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          شاگرد انبار: «آقا ناصر! همه راهروها رو گشتم، ۱۶ تا کارتن نیست که نیست!»
        </div>
      )}
    </div>
  )
}

// ─── SCENE 2: Agha Naser Searching Aisles with Wooden Ruler ──────────────────
function SceneTwoAisleSearch({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const stamp = spring(Math.max(0, local - 2.5))

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
        <div style={{ fontSize: 25, fontWeight: 900, color: '#f59e0b' }}>
          سرگردانی بین قفسه‌ها با خط‌کش چوبی!
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          دفتر اندیکاتور دستی پر از خط‌خوردگی و ورق‌های گم‌شده
        </div>
      </div>

      {/* Warehouse Shelf Mockup */}
      <div
        style={{
          width: '92%',
          background: '#1e293b',
          border: '2px solid #475569',
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
            paddingBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
            راهروی B - قفسه شوینده‌ها
          </span>
          <span style={{ fontSize: 11, color: '#f87171' }}>ثبت دستی در سررسید</span>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: 60,
              height: 60,
              background: '#334155',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            📦
          </div>
          <div
            style={{
              width: 60,
              height: 60,
              background: '#334155',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            📦
          </div>
          <div
            style={{
              width: 60,
              height: 60,
              border: '2px dashed #ef4444',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: '#ef4444',
            }}
          >
            ❓
          </div>
          <div
            style={{
              width: 60,
              height: 60,
              border: '2px dashed #ef4444',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: '#ef4444',
            }}
          >
            ❓
          </div>
        </div>

        {local > 2.2 && (
          <div
            style={{
              background: '#450a0a',
              border: '2px solid #ef4444',
              borderRadius: 10,
              padding: '10px 14px',
              textAlign: 'center',
              transform: `scale(${stamp})`,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fca5a5' }}>
              آقا ناصر: «من خودم هفته پیش شمردم، ۵۰ تا بود! کی برده؟ حواله‌اش کو؟!»
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 3: The Phone Call & Blurred Ink Ledger ────────────────────────────
function SceneThreePhoneRage({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const shake = local > 1.0 && local < 2.5 ? Math.sin((local - 1.0) * 30) * 5 : 0
  const bubble = spring(Math.max(0, local - 1.6))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateX(${shake}px)`,
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444' }}>
          تماس مشتری شاکی و جوهر پخش‌شده!
        </div>
        <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 4 }}>
          تالار عروسی امشب منتظر مواده، ولی بار تو انبار نیست!
        </div>
      </div>

      <div
        style={{
          width: '92%',
          background: '#0f172a',
          border: '2px solid #dc2626',
          borderRadius: 14,
          padding: '20px',
          boxShadow: '0 20px 40px rgba(220, 38, 38, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>📞</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>
              مدیر تالار تشریفات:
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>
              «بار تا ۱ ساعت دیگه نرسه، کل قرارداد رو فسخ می‌کنم!»
            </div>
          </div>
        </div>

        {local > 1.5 && (
          <div
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 10,
              padding: '12px 14px',
              fontFamily: 'Tahoma, sans-serif',
              transform: `scale(${bubble})`,
              position: 'relative',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
              برگه حواله دست‌نویس انبار:
            </div>
            <div style={{ fontSize: 13 }}>
              تحویل شد به:{' '}
              <span style={{ textDecoration: 'line-through', color: '#b91c1c' }}>
                [جوهر چای ریخته و ناخواناست!]
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4, fontWeight: 700 }}>
              نه شماره تماس راننده ثبت شده، نه امضای تحویل‌گیرنده!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 4: Traditional Inventory Audit Disaster ──────────────────────────
function SceneFourAuditDisaster({ local }: { local: number }) {
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
        <div style={{ fontSize: 25, fontWeight: 900, color: '#f87171' }}>
          ۳۸ میلیون تومان کسری انبار در ۳ ماه!
        </div>
        <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4 }}>
          انبارداری سنتی یعنی کالاهایی که بی‌سند می‌روند و آب می‌شوند!
        </div>
      </div>

      <div
        style={{
          width: '90%',
          background: '#1e1b4b',
          border: '2px solid #6366f1',
          borderRadius: 14,
          padding: '20px',
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
            borderBottom: '1px solid #4338ca',
            paddingBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: '#a5b4fc' }}>گزارش انبارگردانی فصلی</span>
          <span style={{ fontSize: 12, color: '#f87171', fontWeight: 800 }}>مغایرت فاحش!</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>مایع شوینده کد ۱۰۴:</span>
            <span style={{ color: '#ef4444', fontWeight: 800 }}>-۱۶ کارتن (۸,۴۰۰,۰۰۰ تومن)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>روغن صنعتی ۱ لیتری:</span>
            <span style={{ color: '#ef4444', fontWeight: 800 }}>-۲۲ کارتن (۱۴,۲۰۰,۰۰۰ تومن)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>پک دستمال حوله‌ای:</span>
            <span style={{ color: '#ef4444', fontWeight: 800 }}>-۴۰ بسته (۱۵,۴۰۰,۰۰۰ تومن)</span>
          </div>
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
            مجموع کسری بی‌صاحب: ۳۸,۰۰۰,۰۰۰ تومان!
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 5: The Hisabche Warehouse Tablet & Barcode Scanner ────────────────
function SceneFiveHisabcheTablet({ local }: { local: number }) {
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
          حسابچه؛ معجزه بارکد و مکان‌یابی انبار
        </div>
        <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 4 }}>
          دیگه نه دفتری کنده می‌شه، نه کارتنی گم می‌مونه!
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
          <div style={{ fontSize: 26 }}>📷</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
              اسکن بارکد با تبلت یا موبایل
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              یافتن سریع آدرس: راهرو ۴ - قفسه ۲ - طبقه ۳ در زیر ۲ ثانیه
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
            <div style={{ fontSize: 26 }}>🔄</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                کسر خودکار کاردکس با صدور فاکتور
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                تطبیق بلادرنگ انبار مرکزی با تمام شعبات و ویزیتورها
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
            <div style={{ fontSize: 26 }}>🛡️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
                قفل خروج بدون حواله رسمی
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                هیچ باری بدون تایید سیستمی از درب انبار خارج نمی‌شود
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 6: Digital Signature & Perfect In-Transit Dispatch ───────────────
function SceneSixDriverSign({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const signSpring = spring(Math.max(0, local - 1.5))

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
          امضای دیجیتال راننده و ارسال آنی رسید
        </div>
        <div style={{ fontSize: 13, color: '#bae6fd', marginTop: 4 }}>
          موجودی فیزیکی و سیستمی؛ ۱۰۰٪ منطبق بدون حتی ۱ کارتن مغایرت
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
          gap: 10,
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
          <span style={{ fontSize: 12, color: '#94a3b8' }}>بارنامه رسمی خروج #۸۸۴۲</span>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 800 }}>تاییدشده ✓</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>اقلام تحویلی: ۵۰ کارتن شوینده</span>
          <span style={{ fontWeight: 800, color: '#38bdf8' }}>کسری: ۰ عدد</span>
        </div>

        {local > 1.2 && (
          <div
            style={{
              background: '#0284c715',
              border: '1px dashed #38bdf8',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transform: `scale(${signSpring})`,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>امضای لمسی راننده:</div>
              <div
                style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}
              >
                ✍️ راننده: علی کاظمی
              </div>
            </div>
            <div style={{ fontSize: 24 }}>📱</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 7: Warehouse Zen & Final Call to Action ──────────────────────────
function SceneSevenWarehouseZen({ local }: { local: number }) {
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
      <div style={{ fontSize: 44, marginBottom: 10 }}>📦✨</div>

      <div style={{ fontSize: 26, fontWeight: 900, color: '#fef3c7', lineHeight: 1.3 }}>
        حتی یک کارتن هم در انبارت گم نمی‌شود!
      </div>
      <div style={{ fontSize: 14, color: '#34d399', marginTop: 6, fontWeight: 700 }}>
        انضباط کامل انبار، فاکتور و صندوق با حسابچه
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
          <div style={{ fontSize: 11, color: '#94a3b8' }}>کسری انبار</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#10b981' }}>صفر کارتن</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>سرعت انبارگردانی</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8' }}>۱۰ برابر</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>انضباط رانندگان</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fbbf24' }}>۱۰۰٪</div>
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
          انبارداری بارکدی، چندانباره و ثبت لحظه‌ای حواله
        </div>
      </div>
    </div>
  )
}
