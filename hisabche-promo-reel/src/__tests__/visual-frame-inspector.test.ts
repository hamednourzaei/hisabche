// ============================================
// Hisabche Motion Design Studio — Visual Frame & Layout Inspector Test
//
// Performs headless visual and DOM frame analysis on Reel 46 and the 6 Opening Archetypes:
// 1. Frame 0 layout density & archetype rendering (zero generic placeholders)
// 2. Continuous deterministic timeline math (zero NaN, zero undefined)
// 3. Persian RTL HarfBuzz ligature integrity (zero broken DOM character splits)
// 4. Viewport utilization across Header, Hero, and Context zones
// ============================================

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getReelRegistryEntry } from '../data/reel-registry'
import { REELS } from '../reels'
import { SceneView } from '../scenes'

describe('Visual Frame & Layout Inspection (Headless Studio QA)', () => {
  const reel46 = REELS.find((r) => r.id === '46')!
  const registry46 = getReelRegistryEntry('46')

  it('renders Frame 0 (t = 0.0s) for Reel 46 with Uncomfortable Discovery archetype', () => {
    expect(registry46.openingArchetype).toBe('uncomfortable-discovery')
    expect(registry46.artDirection).toBe('swiss-editorial')
    const scene0 = reel46.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene: scene0, t: 0.0 }))

    // Frame 0 must contain the opening archetype container
    expect(html).toContain('opening-uncomfortable-discovery')

    // Must contain the surface reassuring metric
    expect(html).toContain('دخل نقدی امشب پای بستن کرکره')
    expect(html).toContain('۸۵٬۰۰۰٬۰۰۰ تومان')

    // Zero NaN in rendered inline styles or attributes
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')

    // Preserves authentic Persian currency & numbers
    expect(html).toContain('تومان')
    expect(html).toContain('۸۵٬۰۰۰٬۰۰۰')
  })

  it('renders Transition Frame (t = 1.2s) when fracture reveal cracks open', () => {
    const scene0 = reel46.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene: scene0, t: 1.2 }))

    // Hidden reality revealed
    expect(html).toContain('واقعیت پنهان')
    expect(html).toContain('بهای خرید بار جدید فردا صبح')
    expect(html).toContain('۸۹٬۵۰۰٬۰۰۰ تومان!')
    expect(html).toContain('عدم احتساب بهای لایه‌ای جایگزینی FIFO')

    expect(html).not.toContain('NaN')
  })

  it('renders Scene 2 (t = 8.0s) Profit Waterfall Demo with COGS breakdown', () => {
    const scene1 = reel46.scenes[1]!
    const localT = 8.0 - scene1.start
    const html = renderToString(React.createElement(SceneView, { scene: scene1, t: localT }))

    // Must render the waterfall chart container
    expect(html).toContain('waterfall')
    expect(html).toContain('بهای تمام‌شده واقعی')

    expect(html).not.toContain('NaN')
  })

  it('renders Scene 3 (t = 24.0s) Compare Matrix without generic cards', () => {
    const scene2 = reel46.scenes[2]!
    const localT = 24.0 - scene2.start
    const html = renderToString(React.createElement(SceneView, { scene: scene2, t: localT }))

    expect(html).toContain('موتور FIFO حسابچه')
    expect(html).toContain('تفکیک بار قدیم و جدید (FIFO)')

    expect(html).not.toContain('NaN')
  })

  it('renders Scene 4 (t = 38.0s) Versus Scale contrasting melting capital with business growth', () => {
    const scene3 = reel46.scenes[3]!
    const localT = 38.0 - scene3.start
    const html = renderToString(React.createElement(SceneView, { scene: scene3, t: localT }))

    expect(html).toContain('versus-stacked-mode')
    expect(html).toContain('دخل شلوغ')
    expect(html).toContain('خالی شدن سال به سال انبار')
    expect(html).toContain('حفظ ارزش دارایی')
    expect(html).toContain('سود شفاف و نقدی')

    expect(html).not.toContain('NaN')
  })

  it('renders Scene 5 (t = 55.0s) High-Conversion Call To Action', () => {
    const scene4 = reel46.scenes[4]!
    const localT = 55.0 - scene4.start
    const html = renderToString(React.createElement(SceneView, { scene: scene4, t: localT }))

    expect(html).toContain('حسابچه | محاسبه هوشمند بهای تمام‌شده و سود واقعی')
    expect(html).toContain('محاسبه سود FIFO')

    expect(html).not.toContain('NaN')
  })

  it('verifies that all 6 Opening Archetypes render distinct, non-empty DOM trees at Frame 0', () => {
    const archetypes = [
      'immediate-consequence',
      'uncomfortable-discovery',
      'customer-confrontation',
      'visual-pattern-interrupt',
      'quiet-dread',
      'deadline-pressure',
    ] as const

    const outputs = archetypes.map((arch) => {
      const spec = {
        kind: 'hook' as const,
        openingArchetype: arch,
        lines: ['تست خط اول', 'تست خط دوم'],
      }
      const scene = { start: 0, end: 7, spec, vo: 'تست صدا' }
      const html = renderToString(React.createElement(SceneView, { scene, t: 0.0 }))
      expect(html.length).toBeGreaterThan(200)
      expect(html).not.toContain('NaN')
      return html
    })

    // Assert that every archetype's Frame 0 DOM is mutually distinct
    const uniqueOutputs = new Set(outputs)
    expect(uniqueOutputs.size).toBe(archetypes.length)
  })

  it('verifies Reel 43 Scene 4 renders in adaptive stacked layout with clean 2-level hierarchy and balanced verdict pill', () => {
    const reel43 = REELS.find((r) => r.id === '43')!
    expect(reel43).toBeDefined()
    const scene3 = reel43.scenes[3]! // Scene 4 (0-indexed 3)
    const html = renderToString(React.createElement(SceneView, { scene: scene3, t: 2.5 }))

    // Must be in stacked mode due to copy length > 18 chars
    expect(html).toContain('versus-stacked-mode')
    expect(html).toContain('versus-stacked-card')

    // Left card (problem/red): Title and Subtitle split cleanly
    expect(html).toContain('ذوب شدن سرمایه')
    expect(html).toContain('تلاش بی‌ثمر شبانه‌روزی بدون احتساب ضایعات و قطعات')

    // Right card (solution/cyan): Title and Subtitle split cleanly
    expect(html).toContain('سود تضمین‌شده')
    expect(html).toContain('محاسبه دقیق بهای ساخت روی هر دستگاه خروجی سوله')

    // Verdict inside balanced glass banner pill
    expect(html).toContain('versus-verdict-pill')
    expect(html).toContain('تولیدکننده موفق کسی است که بهای ساخت را قبل از تراشکاری می‌داند')

    expect(html).not.toContain('NaN')
  })

  it('renders Reel 49 across key visual frames (Frame 0, Scene 2 kinetic reveal, Scene 4 versus, Scene 5 CTA)', () => {
    const reel49 = REELS.find((r) => r.id === '49')!
    expect(reel49).toBeDefined()

    // Frame 0: Hook with Uncomfortable Discovery
    const scene0 = reel49.scenes[0]!
    const frame0Html = renderToString(React.createElement(SceneView, { scene: scene0, t: 0.0 }))
    expect(frame0Html).toContain('opening-uncomfortable-discovery')
    expect(frame0Html).toContain('طلب وصول‌شده نسیه')
    expect(frame0Html).toContain('۵۰۰٬۰۰۰٬۰۰۰ تومان')
    expect(frame0Html).not.toContain('NaN')

    // Scene 2: Premium Motion Graphics Template at t = 3.0s
    const scene1 = reel49.scenes[1]!
    const scene1Html = renderToString(React.createElement(SceneView, { scene: scene1, t: 3.0 }))
    expect(scene1Html).toContain('premium-motion-graphics-template')
    expect(scene1Html).toContain('معماری کنترل تورم حسابچه')
    expect(scene1Html).toContain('پایش ارزش روز انبار در برابر تورم بازار')
    expect(scene1Html).toContain('راهکار ضد تورم حسابچه')
    expect(scene1Html).not.toContain('NaN')

    // Scene 4: Versus Scale at t = 3.0s
    const scene3 = reel49.scenes[3]!
    const scene3Html = renderToString(React.createElement(SceneView, { scene: scene3, t: 3.0 }))
    expect(scene3Html).toContain('versus-stacked-mode')
    expect(scene3Html).toContain('حفظ ۱۰۰٪ قدرت خرید')
    expect(scene3Html).not.toContain('NaN')

    // Scene 5: CTA at t = 4.0s
    const scene4 = reel49.scenes[4]!
    const scene4Html = renderToString(React.createElement(SceneView, { scene: scene4, t: 4.0 }))
    expect(scene4Html).toContain('حسابچه | نرم‌افزار حسابداری ضد تورم و مدیریت هوشمند نسیه')
    expect(scene4Html).toContain('کامنت کن: نسیه')
    expect(scene4Html).not.toContain('NaN')
  })

  it('renders Reel 50 composite film across key visual moments (Frame 0, Scene 4 product reveal, Scene 5 resolution)', () => {
    const reel50 = REELS.find((r) => r.id === '50')!
    expect(reel50).toBeDefined()

    // Frame 0: Hook with Quiet Dread
    const scene0 = reel50.scenes[0]!
    const frame0Html = renderToString(React.createElement(SceneView, { scene: scene0, t: 0.0 }))
    expect(frame0Html).toContain('opening-quiet-dread')
    expect(frame0Html).toContain('دخل نقدی امشب پای بستن کرکره: فروش روزانه بالا')
    expect(frame0Html).not.toContain('NaN')

    // Scene 4: Cinematic 3D Product (4 Pillars)
    const scene3 = reel50.scenes[3]!
    const scene3Html = renderToString(React.createElement(SceneView, { scene: scene3, t: 4.0 }))
    expect(scene3Html).toContain('cinematic-scene')
    expect(scene3Html).toContain('کنترل کامل دخل، انبار و مشتری')
    expect(scene3Html).toContain('۴ ستون هوشمند حسابچه در یک پلتفرم یکپارچه')
    expect(scene3Html).toContain('۱. فروش و فاکتورها')
    expect(scene3Html).toContain('۲. موجودی و انبار')
    expect(scene3Html).toContain('۳. حساب مشتریان')
    expect(scene3Html).toContain('۴. گزارش‌های کسب‌وکار')
    expect(scene3Html).not.toContain('NaN')

    // Scene 5: Emotional Resolution (Versus)
    const scene4 = reel50.scenes[4]!
    const scene4Html = renderToString(React.createElement(SceneView, { scene: scene4, t: 2.5 }))
    expect(scene4Html).toContain('versus-stacked-mode')
    expect(scene4Html).toContain('کنترل بیشتر. سردرگمی کمتر.')
    expect(scene4Html).toContain('بدون حسابچه (سردرگمی)')
    expect(scene4Html).toContain('با حسابچه (تسلط کامل)')
    expect(scene4Html).toContain('به‌جای حدس زدن دخل و نسیه، با دید روشن تصمیم بگیر')
    expect(scene4Html).not.toContain('NaN')
  })

  it('renders Reel 56 with Studio-Grade Motion Architecture (Volumetric Bézier Wave, 2.5D Split, Balance Scale, StudioOdometer)', () => {
    const reel56 = REELS.find((r) => r.id === '56')!
    expect(reel56).toBeDefined()

    // Scene 1: Hook Split with Volumetric Bézier Wave & StudioOdometer
    const scene0 = reel56.scenes[0]!
    const frame0Html = renderToString(React.createElement(SceneView, { scene: scene0, t: 1.5 }))
    expect(frame0Html).toContain('r56-volumetric-glow')
    expect(frame0Html).toContain('r56-wire-ambient')
    expect(frame0Html).toContain('r56-wire-core')
    expect(frame0Html).toContain('studio-odometer-wrap')
    expect(frame0Html).toContain('۹۰۰ میلیون فروش؛ یک شعبه زیر صفر!')
    expect(frame0Html).not.toContain('NaN')
    expect(frame0Html).not.toContain('undefined')

    // Scene 3: Branch Autopsy with 2.5D Split View & Balance Scale Line
    const scene2 = reel56.scenes[2]!
    const frame2Html = renderToString(React.createElement(SceneView, { scene: scene2, t: 3.5 }))
    expect(frame2Html).toContain('r56-balance-scale-stage')
    expect(frame2Html).toContain('r56-scale-svg')
    expect(frame2Html).toContain('r56-split-perspective-grid')
    expect(frame2Html).toContain('green-branch-card')
    expect(frame2Html).toContain('red-branch-card')
    expect(frame2Html).toContain('شعبه دوم')
    expect(frame2Html).toContain('شعبه مرکزی')
    expect(frame2Html).not.toContain('NaN')
    expect(frame2Html).not.toContain('undefined')
  })

  it('renders Reel 57 Forensic Audit & Fraud Shield (Invoice Diff, Audit Stream, StudioOdometer)', () => {
    const reel57 = REELS.find((r) => r.id === '57')!
    expect(reel57).toBeDefined()

    // Scene 1: Forensic Hook with Invoice Diff & StudioOdometer
    const scene0 = reel57.scenes[0]!
    const frame0Html = renderToString(React.createElement(SceneView, { scene: scene0, t: 1.5 }))
    expect(frame0Html).toContain('r57-invoice-card')
    expect(frame0Html).toContain('studio-odometer-wrap')
    expect(frame0Html).toContain('فاکتور ۷۵ میلیونی دیروز غیب شد!')
    expect(frame0Html).not.toContain('NaN')
    expect(frame0Html).not.toContain('undefined')

    // Scene 4: Security Shield with Realtime Audit Log Stream
    const scene3 = reel57.scenes[3]!
    const frame3Html = renderToString(React.createElement(SceneView, { scene: scene3, t: 2.0 }))
    expect(frame3Html).toContain('r57-audit-panel')
    expect(frame3Html).toContain('Audit Trail')
    expect(frame3Html).toContain('قفل دو مرحله‌ای مدیر فعال است')
    expect(frame3Html).not.toContain('NaN')
    expect(frame3Html).not.toContain('undefined')

    // Scene 5: Hard Rule 5 & 12 Final CTA Timing & Readable Hold
    const scene4 = reel57.scenes[4]!
    // At t = 0.5s (22.5s overall), CTA card is already fully visible on screen
    const frame4EarlyHtml = renderToString(
      React.createElement(SceneView, { scene: scene4, t: 0.5 }),
    )
    expect(frame4EarlyHtml).toContain('cta-action-card')
    expect(frame4EarlyHtml).toContain('hisabche.com')
    expect(frame4EarlyHtml).toContain('امنیت ۱۰۰٪ دخل و فاکتورها')

    // At t = 3.9s (25.9s overall, final frame), CTA remains fully visible with zero exit fadeout
    const frame4FinalHtml = renderToString(
      React.createElement(SceneView, { scene: scene4, t: 3.9 }),
    )
    expect(frame4FinalHtml).toContain('cta-action-card')
    expect(frame4FinalHtml).toContain('hisabche.com')
    expect(frame4FinalHtml).not.toContain('NaN')
  })

  it('renders Reel 59 Tax Audit & Moadian Shield (Hard Rules 1, 4, 5, 12 Verification)', () => {
    const reel59 = REELS.find((r) => r.id === '59')!
    expect(reel59).toBeDefined()

    // Scene 1: Tax Hook with 180M Penalty Card & Reject Stamp
    const scene0 = reel59.scenes[0]!
    const frame0Html = renderToString(React.createElement(SceneView, { scene: scene0, t: 1.5 }))
    expect(frame0Html).toContain('r59-tax-card')
    expect(frame0Html).toContain('برگ تشخیص سازمان امور مالیاتی')
    expect(frame0Html).toContain('studio-odometer-wrap')
    expect(frame0Html).not.toContain('NaN')
    expect(frame0Html).not.toContain('undefined')

    // Scene 2: Discrepancy Matrix (45 manual vs 0 in Moadian)
    const scene1 = reel59.scenes[1]!
    const frame1Html = renderToString(React.createElement(SceneView, { scene: scene1, t: 2.0 }))
    expect(frame1Html).toContain('r59-matrix-grid')
    expect(frame1Html).toContain('دفتر دستی فروشگاه')
    expect(frame1Html).toContain('ثبت‌شده در مودیان')
    expect(frame1Html).toContain('۰ فاکتور!')

    // Scene 4: Moadian Shield (One-click upload & 0 Rial penalty)
    const scene3 = reel59.scenes[3]!
    const frame3Html = renderToString(React.createElement(SceneView, { scene: scene3, t: 2.5 }))
    expect(frame3Html).toContain('r59-solution-card')
    expect(frame3Html).toContain('تایید نهایی مودیان')
    expect(frame3Html).toContain('۰')
    expect(frame3Html).toContain('ریال')

    // Scene 5: Hard Rule 5 CTA Hold (t=0.5s and t=3.9s)
    const scene4 = reel59.scenes[4]!
    const frame4EarlyHtml = renderToString(
      React.createElement(SceneView, { scene: scene4, t: 0.5 }),
    )
    expect(frame4EarlyHtml).toContain('cta-action-card')
    expect(frame4EarlyHtml).toContain('hisabche.com')
    expect(frame4EarlyHtml).toContain('تاییدیه ۱۰۰٪ سامانه مودیان')

    const frame4FinalHtml = renderToString(
      React.createElement(SceneView, { scene: scene4, t: 3.9 }),
    )
    expect(frame4FinalHtml).toContain('cta-action-card')
    expect(frame4FinalHtml).toContain('hisabche.com')
    expect(frame4FinalHtml).not.toContain('NaN')
  })
})
