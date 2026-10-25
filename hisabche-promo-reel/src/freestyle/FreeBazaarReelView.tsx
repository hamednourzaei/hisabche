// ============================================
// Hisabche Promo Reel — Standalone Free-Reel View (Bazaar Humor)
// Real Persian/Dari bazaar scenario without restrictive folder rules:
// - Traditional merchants, tea cups, messy paper ledgers, bounced cheques
// - Real grocery names (برنج طارم، روغن لادن، قند) and currency (تومان)
// - Dynamic comic panels, sound-synced animations, pure deterministic clock
// ============================================

import { ease, mix, progress, spring } from '../engine/anim'
import { BAZAAR_SCENES } from './bazaar-humor-data'

export interface FreeBazaarReelViewProps {
  t: number
}

export function FreeBazaarReelView({ t }: FreeBazaarReelViewProps) {
  const currentSceneIndex = BAZAAR_SCENES.findIndex((s) => t >= s.start && t < s.end)
  const sceneIdx = currentSceneIndex === -1 ? BAZAAR_SCENES.length - 1 : currentSceneIndex
  const scene = BAZAAR_SCENES[sceneIdx]!
  const local = t - scene.start

  // Background smooth transitions across 5 chapters
  const isModern = t >= 18.0

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: isModern
          ? 'radial-gradient(circle at 50% 20%, #0c2027 0%, #050b14 70%, #020509 100%)'
          : 'radial-gradient(circle at 50% 30%, #1f140e 0%, #0f0a07 60%, #070403 100%)',
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
      {/* Background Ambient Glow & Grid Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isModern
            ? 'radial-gradient(circle at 50% 10%, rgba(16, 185, 129, 0.15), transparent 60%)'
            : 'radial-gradient(circle at 50% 10%, rgba(245, 158, 11, 0.12), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header Bar: Story Episode Badge */}
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
            background: isModern ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: isModern
              ? '1px solid rgba(16, 185, 129, 0.4)'
              : '1px solid rgba(245, 158, 11, 0.4)',
            fontSize: 13,
            fontWeight: 700,
            color: isModern ? '#34d399' : '#fbbf24',
          }}
        >
          <span>{isModern ? '⚡ تحول دیجیتال بازار' : '☕ روایت واقعی حجره و بازار'}</span>
          <span style={{ opacity: 0.6 }}>|</span>
          <span>قسمت {scene.id} از ۵</span>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: isModern ? '#6ee7b7' : '#f59e0b',
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

      {/* Main Canvas Area: Render Scene Active Layer */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: '10px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        {sceneIdx === 0 && <SceneOneNotebook local={local} />}
        {sceneIdx === 1 && <SceneTwoBouncedCheque local={local} />}
        {sceneIdx === 2 && <SceneThreeMeltdown local={local} />}
        {sceneIdx === 3 && <SceneFourHisabcheRescue local={local} />}
        {sceneIdx === 4 && <SceneFiveTeaPeace local={local} />}
      </div>
    </div>
  )
}

// ─── SCENE 1: The Messy Old Ledger & The Cash Deficit ───────────────────────
function SceneOneNotebook({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.6))
  const shake = local > 2.2 && local < 3.2 ? Math.sin((local - 2.2) * 30) * 6 : 0
  const bubbleSpring = spring(Math.max(0, local - 1.8))
  const stampSpring = spring(Math.max(0, local - 3.4))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(${mix(40, 0, enter)}px) rotate(${shake * 0.3}deg)`,
        opacity: enter,
      }}
    >
      {/* Title */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: '#fef3c7',
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          }}
        >
          دفتر سررسید و معمای کسری دخل!
        </div>
        <div style={{ fontSize: 13, color: '#d97706', marginTop: 4 }}>
          روایت واقعی در دکان‌های سنتی عمده‌فروشی و بازار
        </div>
      </div>

      {/* Illustrated Old Paper Ledger */}
      <div
        style={{
          width: '92%',
          background: '#fdfbf7',
          color: '#1e293b',
          borderRadius: 14,
          padding: '20px 22px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 40px rgba(217, 119, 6, 0.1)',
          border: '2px solid #e2d9cc',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Tahoma, sans-serif',
          transform: 'rotate(-1.5deg)',
        }}
      >
        {/* Tea Stain on the corner */}
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: -20,
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(146, 64, 14, 0.35) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Notebook header lines */}
        <div
          style={{
            borderBottom: '2px solid #e11d48',
            paddingBottom: 8,
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: '#991b1b',
            fontWeight: 'bold',
          }}
        >
          <span>دفتر حساب و کتاب نسیه — سال ۱۳۹۸</span>
          <span
            style={{ fontSize: 10, background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}
          >
            چای‌خورده و مخدوش!
          </span>
        </div>

        {/* Ledger Entries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px dashed #cbd5e1',
              paddingBottom: 4,
            }}
          >
            <span>حاج رضا: ۱۲ کیسه برنج طارم نسیه</span>
            <span style={{ fontWeight: 700 }}>۱۴,۴۰۰,۰۰۰ تومان</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px dashed #cbd5e1',
              paddingBottom: 4,
              color: '#475569',
            }}
          >
            <span>ممد بقال: ۴ حلب روغن ۱۶ کیلویی لادن</span>
            <span style={{ fontWeight: 700, textDecoration: 'line-through', color: '#dc2626' }}>
              نامشخص؟!
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px dashed #cbd5e1',
              paddingBottom: 4,
            }}
          >
            <span>کارتن تخم‌مرغ: ۳ کارتن بدون رسید</span>
            <span style={{ fontWeight: 700 }}>۲,۱۰۰,۰۰۰ تومان</span>
          </div>
        </div>

        {/* Big Alert Stamp */}
        {local > 3.2 && (
          <div
            style={{
              position: 'absolute',
              bottom: 15,
              right: 15,
              padding: '8px 16px',
              border: '3px solid #dc2626',
              borderRadius: 8,
              color: '#dc2626',
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '0.05em',
              transform: `scale(${stampSpring}) rotate(-8deg)`,
              background: 'rgba(254, 226, 226, 0.95)',
              boxShadow: '0 4px 16px rgba(220, 38, 38, 0.3)',
            }}
          >
            ⚠️ ۵ میلیون تومن کسری دخل!
          </div>
        )}
      </div>

      {/* Comic Speech Bubble from Disciple */}
      {local > 1.6 && (
        <div
          style={{
            marginTop: 18,
            width: '88%',
            background: '#b91c1c',
            color: '#ffffff',
            borderRadius: 16,
            padding: '12px 18px',
            boxShadow: '0 10px 25px rgba(185, 28, 28, 0.4)',
            transform: `scale(${bubbleSpring})`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 28 }}>🗣️</div>
          <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 700 }}>
            شاگرد: «حاجی! حساب دخل با پول نقد جور درنمیاد، ۵ میلیون تومنش غیب شده!»
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SCENE 2: The Sayadi Cheque Nightmare & Phone Turned Off ────────────────
function SceneTwoBouncedCheque({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const stampSlam = spring(Math.max(0, local - 2.2))
  const phoneSpring = spring(Math.max(0, local - 3.5))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(${mix(30, 0, enter)}px)`,
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#f87171' }}>
          چک صیادی ۲۰۰ میلیونی و مشتری که رفت!
        </div>
        <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 2 }}>
          سررسید امروز بود، بانک رفتیم ولی حساب خالی بود!
        </div>
      </div>

      {/* Iranian Sayadi Cheque Representation */}
      <div
        style={{
          width: '92%',
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          color: '#3b0764',
          borderRadius: 12,
          padding: '18px 20px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.7)',
          border: '2px solid #8b5cf6',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Tahoma, sans-serif',
        }}
      >
        {/* Cheque Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #c4b5fd',
            paddingBottom: 6,
            marginBottom: 10,
            fontSize: 11,
            color: '#6d28d9',
            fontWeight: 800,
          }}
        >
          <span>چک صیادی بنفش بانکی</span>
          <span style={{ letterSpacing: '0.15em' }}>شناسه: ۹۴۸۲-۷۱۵۴-۰۰۳۲</span>
        </div>

        {/* Cheque Details */}
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>تاریخ سررسید: ۱۴۰۵/۰۲/۱۵</span>
            <span style={{ color: '#dc2626', fontWeight: 800 }}>سررسید: امروز!</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>در وجه: جناب حاج اصغر و شرکا</span>
            <span>بابت: ۶ تن برنج و روغن</span>
          </div>
          <div
            style={{
              marginTop: 6,
              background: '#ffffff',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #c4b5fd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, color: '#6b7280' }}>مبلغ چک:</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#4c1d95' }}>
              ۲۸۰,۰۰۰,۰۰۰ تومان
            </span>
          </div>
        </div>

        {/* Red Stamp Slammed Down */}
        {local > 2.0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${stampSlam}) rotate(-14deg)`,
              padding: '12px 24px',
              border: '4px solid #b91c1c',
              borderRadius: 10,
              background: 'rgba(254, 226, 226, 0.96)',
              color: '#b91c1c',
              fontWeight: 900,
              fontSize: 20,
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(185, 28, 28, 0.5)',
              zIndex: 10,
              letterSpacing: '0.05em',
            }}
          >
            ❌ برگشت خورد!
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>موجودی حساب کافی نیست</div>
          </div>
        )}
      </div>

      {/* Shaking Phone Off Box */}
      {local > 3.2 && (
        <div
          style={{
            marginTop: 16,
            width: '88%',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid #ef4444',
            borderRadius: 14,
            padding: '12px 16px',
            transform: `scale(${phoneSpring})`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 26 }}>📵</div>
          <div style={{ fontSize: 13, lineHeight: 1.4, color: '#fecaca' }}>
            <span style={{ fontWeight: 800, color: '#f87171' }}>«مشترک مورد نظر خاموش است...»</span>
            <br />
            تلفن و آدرس مشتری اصلاً تو دفتر سررسید یادداشت نشده بود!
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SCENE 3: The Adding Machine Meltdown & Ghost Profits ───────────────────
function SceneThreeMeltdown({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const tapeScroll = mix(0, -120, progress(local, 0.5, 5))
  const badgeSpring = spring(Math.max(0, local - 2.8))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(${mix(25, 0, enter)}px)`,
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 25, fontWeight: 900, color: '#fbbf24' }}>
          دخل شلوغ، ولی جیب خالی؟!
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
          ماشین‌حساب دود کرده اما آخر ماه پول‌ها ناپدید می‌شوند!
        </div>
      </div>

      {/* Retro Adding Machine Paper Roll */}
      <div
        style={{
          width: '80%',
          height: 190,
          background: '#f8fafc',
          color: '#0f172a',
          borderRadius: 10,
          border: '3px solid #64748b',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          fontFamily: 'monospace',
          fontSize: 14,
          padding: '14px 18px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 24,
            background: 'linear-gradient(to bottom, #cbd5e1 0%, transparent 100%)',
            zIndex: 5,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            transform: `translateY(${tapeScroll}px)`,
          }}
        >
          <div>+ ۴۵,۰۰۰,۰۰۰ فروش برنج</div>
          <div>+ ۱۸,۲۰۰,۰۰۰ روغن لادن</div>
          <div>- ۳۲,۰۰۰,۰۰۰ چک خرید بنکدار</div>
          <div>- ۱۴,۵۰۰,۰۰۰ نسیه بلاتکلیف</div>
          <div style={{ color: '#dc2626' }}>- ۵,۰۰۰,۰۰۰ کسری صندوق</div>
          <div>+ ۲۲,۰۰۰,۰۰۰ قند و شکر</div>
          <div style={{ color: '#dc2626', fontWeight: 900 }}>ERR: کجاست سود واقعی؟!</div>
          <div>- ۱۸,۴۰۰,۰۰۰ نسیه فراموش‌شده</div>
          <div>+ ۹,۰۰۰,۰۰۰ کارتخوان نامعلوم</div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 35,
            background: 'linear-gradient(to top, #f8fafc 40%, transparent 100%)',
            zIndex: 5,
          }}
        />
      </div>

      {/* Warning Callout Box */}
      {local > 2.2 && (
        <div
          style={{
            marginTop: 18,
            width: '88%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            borderRadius: 14,
            padding: '12px 18px',
            transform: `scale(${badgeSpring})`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 900, color: '#f87171' }}>
            با سررسید پاره و حافظه نمیشه کاسبی کرد!
          </div>
          <div style={{ fontSize: 13, color: '#fecaca', marginTop: 4 }}>
            فروش داری، انبارت خالی می‌شه، اما سودت قطره‌قطره نشت می‌کنه.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SCENE 4: The Hisabche Revolution in the Merchant's Shop ────────────────
function SceneFourHisabcheRescue({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.6))
  const card1 = spring(Math.max(0, local - 0.8))
  const card2 = spring(Math.max(0, local - 2.0))
  const card3 = spring(Math.max(0, local - 3.2))
  const card4 = spring(Math.max(0, local - 4.4))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(${mix(30, 0, enter)}px)`,
        opacity: enter,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#34d399' }}>
          وقتشه دفتر رو ببندی؛ حسابچه اومد!
        </div>
        <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 2 }}>
          نرم‌افزار مدرن حسابداری، صندوق، انبار و نسیه‌های بازار
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div style={{ width: '92%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Feature 1 */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 12,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transform: `scale(${card1})`,
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.1)',
          }}
        >
          <div style={{ fontSize: 24 }}>⚡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
              صدور فاکتور بارکدی در ۲ ثانیه
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              برنج، روغن، حبوبات؛ ثبت آنی هم نقدی و هم نسیه
            </div>
          </div>
        </div>

        {/* Feature 2 */}
        {local > 1.8 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 12,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transform: `scale(${card2})`,
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div style={{ fontSize: 24 }}>🎯</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                تراز ۱۰۰٪ کارتخوان با دخل مغازه
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                پایان کسری دخل و مغایرت صندوق؛ حتی یک ریال گم نمی‌شود
              </div>
            </div>
          </div>
        )}

        {/* Feature 3 */}
        {local > 3.0 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 12,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transform: `scale(${card3})`,
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div style={{ fontSize: 24 }}>📱</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
                یادآور خودکار پیامکی به بدهکار
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                ارسال پیامک محترمانه سررسید قبل از اینکه مشتری بدقول شود
              </div>
            </div>
          </div>
        )}

        {/* Feature 4 */}
        {local > 4.2 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 12,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transform: `scale(${card4})`,
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div style={{ fontSize: 24 }}>🛡️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
                قفل سقف اعتبار و هشدار چک صیادی
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                تا مشتری قبلی را تسویه نکند، بار جدید نسیه خارج نمی‌شود
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCENE 5: Hot Tea, Peace of Mind & Final Call to Action ─────────────────
function SceneFiveTeaPeace({ local }: { local: number }) {
  const enter = ease(progress(local, 0, 0.5))
  const btnSpring = spring(Math.max(0, local - 1.2))

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        transform: `translateY(${mix(20, 0, enter)}px)`,
        opacity: enter,
      }}
    >
      {/* Big Cup Icon and Steam */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 44,
          marginBottom: 10,
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.3)',
        }}
      >
        ☕
      </div>

      <div style={{ fontSize: 27, fontWeight: 900, color: '#fef3c7', lineHeight: 1.3 }}>
        چای قندپهلوتو با آرامش بنوش!
      </div>
      <div style={{ fontSize: 14, color: '#34d399', marginTop: 6, fontWeight: 700 }}>
        حسابچه حواسش به تک‌تک ریال‌های دخلت هست.
      </div>

      {/* Metric card */}
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
          <div style={{ fontSize: 11, color: '#94a3b8' }}>کسری دخل</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#10b981' }}>۰ ریال</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>سرعت فاکتور</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fbbf24' }}>۲ ثانیه</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>آرامش خیال</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8' }}>۱۰۰٪</div>
        </div>
      </div>

      {/* CTA Button */}
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
            letterSpacing: '0.02em',
          }}
        >
          شروع رایگان در hisabche.com
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          ویندوز، وب و موبایل • بدون نیاز به دانش حسابداری
        </div>
      </div>
    </div>
  )
}
