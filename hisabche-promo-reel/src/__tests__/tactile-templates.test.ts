// ============================================
// Hisabche Motion Design Studio — Tactile Primitives & 12 Viral Templates Test
//
// Verifies:
// 1. The 12 Viral Short-Form Template Archetypes registry and metadata integrity
// 2. Co-prime template rotation preventing duplicate templates on adjacent reels
// 3. Tactile Paper Primitives DOM rendering & deterministic math (zero NaN)
// 4. All 12 Viral Template components render clean markup at t = 2.0s
// 5. Flagship Reel 47 SceneView rendering across vertical train & macro zoom phases
// 6. Tactile Foley sound synthesizers & safe dispatch
// ============================================

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  AudioWaveformPill,
  DashedConnectorArrow,
  FastSpinClock,
  HandDrawnLoop,
  KineticSwitchText,
  LinedNotebookSheet,
  MarkerUnderline,
  StrikethroughPaperTag,
  TapedNavyCard,
  TornPaperStrip,
  VerticalTrainCanvas,
  YellowPriceTag,
} from '../components/tactile'
import { getReelRegistryEntry, getViralTemplate, REEL_REGISTRY_LIST } from '../data/reel-registry'
import {
  getReelViralTemplate,
  VIRAL_TEMPLATE_LIST,
  VIRAL_TEMPLATES,
} from '../data/template-catalog'
import { play, setMuted, soundEngine, type SoundKind } from '../engine/sound'
import { REELS } from '../reels'
import { SceneView } from '../scenes'
import {
  ChatPanicToCalmTemplate,
  ContinuousLineTravelerTemplate,
  InfiniteSpatialBoardTemplate,
  IsometricExplodedUiTemplate,
  KineticColorBlockTemplate,
  LiquidGlassSpatialTemplate,
  MinimalVectorPhilosophyTemplate,
  SplitScreenStopwatchTemplate,
  SwissFinancialTerminalTemplate,
  TactileTrainScrollTemplate,
  ThermalReceiptPrinterTemplate,
  VoxDocumentaryCollageTemplate,
} from '../templates'

describe('13 Viral Template Catalog & Rotation Matrix', () => {
  it('registers all 13 Viral Template Archetypes with complete metadata', () => {
    expect(VIRAL_TEMPLATE_LIST).toHaveLength(13)
    expect(Object.keys(VIRAL_TEMPLATES)).toHaveLength(13)

    const expectedIds = [
      'tactile-train-scroll',
      'thermal-receipt-scroll',
      'infinite-spatial-board',
      'vox-documentary-collage',
      'minimal-vector-philosophy',
      'chat-panic-to-calm',
      'liquid-glass-spatial',
      'kinetic-color-block',
      'split-screen-stopwatch',
      'isometric-exploded-ui',
      'continuous-line-traveler',
      'swiss-financial-terminal',
      'premium-motion-graphics',
    ]

    VIRAL_TEMPLATE_LIST.forEach((id, idx) => {
      expect(id).toBe(expectedIds[idx])
      const tpl = VIRAL_TEMPLATES[id]
      expect(tpl).toBeDefined()
      expect(tpl.id).toBe(id)
      expect(tpl.titleFa.length).toBeGreaterThan(0)
      expect(tpl.titleEn.length).toBeGreaterThan(0)
      expect(tpl.whyViral.length).toBeGreaterThan(0)
      expect(tpl.motionMechanism.length).toBeGreaterThan(0)
      expect(tpl.soundPalette.length).toBeGreaterThanOrEqual(3)
      expect(tpl.cadence.length).toBeGreaterThan(0)
    })
  })

  it('guarantees co-prime template rotation: adjacent reels never share the same template', () => {
    for (let i = 1; i < 50; i++) {
      const curId = String(i).padStart(2, '0')
      const nextId = String(i + 1).padStart(2, '0')

      const curTpl = getReelViralTemplate(curId)
      const nextTpl = getReelViralTemplate(nextId)

      expect(curTpl).not.toBe(nextTpl)
    }
  })

  it('assigns tactile-train-scroll to Flagship Reel 47 in registry', () => {
    const tpl47 = getViralTemplate('47')
    expect(tpl47).toBe('tactile-train-scroll')

    const reg47 = getReelRegistryEntry('47')
    expect(reg47.viralTemplate).toBe('tactile-train-scroll')
  })

  it('assigns thermal-receipt-scroll to POS Impasse Reel 48 in registry', () => {
    const tpl48 = getViralTemplate('48')
    expect(tpl48).toBe('thermal-receipt-scroll')

    const reg48 = getReelRegistryEntry('48')
    expect(reg48.viralTemplate).toBe('thermal-receipt-scroll')
  })

  it('assigns premium-motion-graphics to Inflation-Credit Trap Reel 49 in registry', () => {
    const tpl49 = getViralTemplate('49')
    expect(tpl49).toBe('premium-motion-graphics')

    const reg49 = getReelRegistryEntry('49')
    expect(reg49.viralTemplate).toBe('premium-motion-graphics')
  })

  it('covers all 13 template archetypes across the catalog', () => {
    const seenTemplates = new Set<string>()
    REEL_REGISTRY_LIST.forEach((entry) => {
      if (entry.viralTemplate) {
        seenTemplates.add(entry.viralTemplate)
      }
    })
    expect(seenTemplates.size).toBe(13)
  })
})

describe('Tactile Paper Primitives Suite (Headless DOM Rendering)', () => {
  it('renders DashedConnectorArrow without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(DashedConnectorArrow, {
        x1: 100,
        y1: 50,
        x2: 300,
        y2: 400,
        curveOffset: 60,
        strokeColor: '#121D35',
        t: 0.8,
      }),
    )
    expect(html).toContain('svg')
    expect(html).toContain('stroke-dashoffset')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders MarkerUnderline with highlighter sweep', () => {
    const html = renderToString(
      React.createElement(MarkerUnderline, { t: 0.8, startAt: 0.2 }, 'کلمه کلیدی'),
    )
    expect(html).toContain('کلمه کلیدی')
    expect(html).toContain('svg')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders HandDrawnLoop drawing around target badge', () => {
    const html = renderToString(
      React.createElement(
        HandDrawnLoop,
        { t: 1.0, startAt: 0, color: '#D44A3A' },
        React.createElement('span', null, 'بدون مغایرت'),
      ),
    )
    expect(html).toContain('بدون مغایرت')
    expect(html).toContain('svg')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders StrikethroughPaperTag with red slashed marker', () => {
    const html = renderToString(
      React.createElement(StrikethroughPaperTag, {
        label: 'اکسل‌های جزیره‌ای و دفتر کاغذی',
        t: 1.0,
        startAt: 0,
        strikeAt: 0.4,
      }),
    )
    expect(html).toContain('اکسل‌های جزیره‌ای')
    expect(html).toContain('strikethrough-paper-tag')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders YellowPriceTag with punch hole and string', () => {
    const html = renderToString(
      React.createElement(YellowPriceTag, {
        text: 'سود ناخالص: ۲۸۰٬۰۰۰ افغانی',
        sub: 'محاسبه شده با FIFO',
        t: 1.0,
        startAt: 0,
      }),
    )
    expect(html).toContain('سود ناخالص')
    expect(html).toContain('۲۸۰٬۰۰۰ افغانی')
    expect(html).toContain('yellow-price-tag-wrap')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders TapedNavyCard with masking tape overlay', () => {
    const html = renderToString(
      React.createElement(
        TapedNavyCard,
        { label: 'کاردکس انبار', t: 1.0, startAt: 0 },
        React.createElement('p', null, 'موجودی لحظه‌ای قفسه‌ها'),
      ),
    )
    expect(html).toContain('کاردکس انبار')
    expect(html).toContain('taped-navy-card-wrap')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders TornPaperStrip with jagged edges', () => {
    const html = renderToString(
      React.createElement(TornPaperStrip, {
        text: 'فاکتور فروش شماره ۱۰۸',
        t: 1.0,
        startAt: 0,
      }),
    )
    expect(html).toContain('فاکتور فروش شماره ۱۰۸')
    expect(html).toContain('torn-paper-strip-wrap')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders LinedNotebookSheet with checkmarks and ruled lines', () => {
    const html = renderToString(
      React.createElement(LinedNotebookSheet, {
        title: 'چک‌لیست پایان روز',
        lines: [
          { text: 'تراز صندوق', checked: true },
          { text: 'تایید حواله', checked: true },
          { text: 'بستن شیفت', checked: false },
        ],
        t: 1.0,
        startAt: 0,
      }),
    )
    expect(html).toContain('چک‌لیست پایان روز')
    expect(html).toContain('تراز صندوق')
    expect(html).toContain('lined-notebook-sheet-wrap')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders FastSpinClock with analog hands', () => {
    const html = renderToString(
      React.createElement(FastSpinClock, {
        t: 2.5,
        startAt: 0,
        badgeText: '۳ دقیقه تا راه‌اندازی',
      }),
    )
    expect(html).toContain('fast-spin-clock-wrap')
    expect(html).toContain('۳ دقیقه تا راه‌اندازی')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders AudioWaveformPill with dynamic vertical bars', () => {
    const html = renderToString(
      React.createElement(AudioWaveformPill, {
        t: 1.5,
        startAt: 0,
        barCount: 35,
      }),
    )
    expect(html).toContain('audio-waveform-pill-wrap')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders KineticSwitchText with state changes', () => {
    const html = renderToString(
      React.createElement(KineticSwitchText, {
        words: [
          { text: 'دفتر کاغذی', highlight: true },
          { text: 'و' },
          { text: 'مغایرت', switchedTo: 'انضباط مالی' },
        ],
        t: 1.2,
        startAt: 0,
      }),
    )
    expect(html).toContain('kinetic-switch-text-wrap')
    expect(html).toContain('دفتر کاغذی')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders VerticalTrainCanvas stations and macro zoom-out overview at t = 50s', () => {
    const stations = [
      {
        id: '1',
        title: 'ایستگاه اول',
        y: 0,
        startAt: 0,
        dur: 20,
        render: () => React.createElement('div', null, 'ایستگاه اول: دفتر کاغذی'),
      },
      {
        id: '2',
        title: 'ایستگاه دوم',
        y: 1000,
        startAt: 20,
        dur: 20,
        render: () => React.createElement('div', null, 'ایستگاه دوم: فاکتور هوشمند'),
      },
      {
        id: '3',
        title: 'ایستگاه سوم',
        y: 2000,
        startAt: 40,
        dur: 19,
        render: () => React.createElement('div', null, 'ایستگاه سوم: آرامش خیال'),
      },
    ]

    // Station inspection phase (t = 10s)
    const htmlStation = renderToString(
      React.createElement(VerticalTrainCanvas, {
        stations,
        t: 10,
        totalDur: 59,
      }),
    )
    expect(htmlStation).toContain('vertical-train-canvas')
    expect(htmlStation).toContain('ایستگاه اول')
    expect(htmlStation).not.toContain('NaN')
    expect(htmlStation).not.toContain('undefined')

    // Macro zoom overview phase (t = 50s)
    const htmlZoom = renderToString(
      React.createElement(VerticalTrainCanvas, {
        stations,
        t: 50,
        totalDur: 59,
      }),
    )
    expect(htmlZoom).toContain('vertical-train-canvas')
    expect(htmlZoom).toContain('ایستگاه سوم')
    expect(htmlZoom).not.toContain('NaN')
    expect(htmlZoom).not.toContain('undefined')
  })
})

describe('12 Viral Template Archetypes Component Suite', () => {
  it('renders TactileTrainScrollTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(TactileTrainScrollTemplate, { t: 2.0, totalDur: 59 }),
    )
    expect(html).toContain('vertical-train-canvas')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders ThermalReceiptPrinterTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(ThermalReceiptPrinterTemplate, {
        t: 2.0,
        title: 'فیش صندوق',
      }),
    )
    expect(html).toContain('thermal-receipt-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders InfiniteSpatialBoardTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(InfiniteSpatialBoardTemplate, {
        t: 2.0,
        title: 'بوم چندبعدی',
      }),
    )
    expect(html).toContain('infinite-spatial-board')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders VoxDocumentaryCollageTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(VoxDocumentaryCollageTemplate, {
        t: 2.0,
        title: 'مستند کلاژ',
      }),
    )
    expect(html).toContain('vox-documentary-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders MinimalVectorPhilosophyTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(MinimalVectorPhilosophyTemplate, {
        t: 2.0,
        title: 'مینیمالیسم برداری',
      }),
    )
    expect(html).toContain('minimal-vector-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders ChatPanicToCalmTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(ChatPanicToCalmTemplate, {
        t: 2.0,
        title: 'بمباران پیام',
      }),
    )
    expect(html).toContain('chat-panic-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders LiquidGlassSpatialTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(LiquidGlassSpatialTemplate, {
        t: 2.0,
        title: 'شیشه مایع',
      }),
    )
    expect(html).toContain('liquid-glass-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders KineticColorBlockTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(React.createElement(KineticColorBlockTemplate, { t: 2.0 }))
    expect(html).toContain('kinetic-color-block')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders SplitScreenStopwatchTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(React.createElement(SplitScreenStopwatchTemplate, { t: 2.0 }))
    expect(html).toContain('split-stopwatch-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders IsometricExplodedUiTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(IsometricExplodedUiTemplate, {
        t: 2.0,
        title: 'انفجار ایزومتریک',
      }),
    )
    expect(html).toContain('isometric-exploded-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders ContinuousLineTravelerTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(ContinuousLineTravelerTemplate, {
        t: 2.0,
        title: 'خط پیوسته',
      }),
    )
    expect(html).toContain('continuous-line-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders SwissFinancialTerminalTemplate at t = 2.0s without NaN or undefined', () => {
    const html = renderToString(
      React.createElement(SwissFinancialTerminalTemplate, {
        t: 2.0,
        title: 'ترمینال مالی',
      }),
    )
    expect(html).toContain('swiss-terminal-template')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })
})

describe('Flagship Reel 47 Headless Rendering (SceneView Integration)', () => {
  const reel47 = REELS.find((r) => r.id === '47')!

  it('renders Scene 1 at t = 2.0s (Opening Station)', () => {
    const scene = reel47.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.0 }))
    expect(html).toContain('vertical-train-canvas')
    expect(html).toContain('Hisabche')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders Scene 1 at t = 20.0s (Three Pillars Station)', () => {
    const scene = reel47.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 20.0 }))
    expect(html).toContain('vertical-train-canvas')
    expect(html).toContain('۳ بخش حیاتی هر کسب‌وکار ایرانی')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders Scene 1 at t = 51.0s (Macro Zoom-Out & CTA Station)', () => {
    const scene = reel47.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 51.0 }))
    expect(html).toContain('vertical-train-canvas')
    expect(html).toContain('حسابچه')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })
})

describe('Flagship Reel 48 Headless Rendering (POS Impasse Integration)', () => {
  const reel48 = REELS.find((r) => r.id === '48')!

  it('renders Scene 1 (Hook with Customer Confrontation) at t = 2.0s', () => {
    const scene = reel48.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.0 }))
    expect(html).toContain('مشتری شاکی پای کارتخوان فروشگاه:')
    expect(html).toContain('تراکنش ناموفق')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders Scene 2 (Thermal Receipt) at t = 3.0s', () => {
    const scene = reel48.scenes[1]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 3.0 }))
    expect(html).toContain('thermal-receipt-template')
    expect(html).toContain('برزخ ۷۲ ساعته بانکی')
    expect(html).not.toContain('NaN')
  })

  it('renders Scene 5 (CTA) at t = 3.0s', () => {
    const scene = reel48.scenes[4]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 3.0 }))
    expect(html).toContain('حسابچه | اتصال هوشمند فاکتور به کارتخوان و صفر مغایرت')
    expect(html).not.toContain('NaN')
  })
})

describe('Flagship Reel 49 Headless Rendering (Premium Motion Graphics Integration)', () => {
  const reel49 = REELS.find((r) => r.id === '49')!

  it('renders Scene 1 (Hook with Uncomfortable Discovery) at t = 2.0s', () => {
    const scene = reel49.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.0 }))
    expect(html).toContain('طلب وصول‌شده نسیه')
    expect(html).toContain('۸۰۰٬۰۰۰٬۰۰۰ تومان!')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders Scene 2 (Premium Motion Graphics Template) at t = 3.0s', () => {
    const scene = reel49.scenes[1]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 3.0 }))
    expect(html).toContain('premium-motion-graphics-template')
    expect(html).toContain('پایش ارزش روز انبار در برابر تورم بازار')
    expect(html).toContain('۳۰۰ میلیون کسری!')
    expect(html).not.toContain('NaN')
  })

  it('renders Scene 5 (CTA) at t = 3.0s', () => {
    const scene = reel49.scenes[4]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 3.0 }))
    expect(html).toContain('حسابچه | نرم‌افزار حسابداری ضد تورم و مدیریت هوشمند نسیه')
    expect(html).not.toContain('NaN')
  })
})

describe('Reel 50 Master Composite Commercial Headless Rendering', () => {
  const reel50 = REELS.find((r) => r.id === '50')!

  it('renders Scene 1 (Hook with Quiet Dread) at t = 2.0s', () => {
    const scene = reel50.scenes[0]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.0 }))
    expect(html).toContain('فروش داشتی…')
    expect(html).toContain('ولی سودت کجاست؟')
    expect(html).toContain('دخل نقدی امشب پای بستن کرکره: فروش روزانه بالا')
    expect(html).toContain('هزینه‌های پنهان، نسیه سوخته و کسر انبار: سود نامعلوم؟')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('renders Scene 2 (Thermal Receipt Template) at t = 2.5s', () => {
    const scene = reel50.scenes[1]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.5 }))
    expect(html).toContain('thermal-receipt-template')
    expect(html).toContain('نسیه؟ موجودی؟ سود واقعی؟')
    expect(html).not.toContain('NaN')
  })

  it('renders Scene 3 (Minimal Vector Philosophy) at t = 2.0s', () => {
    const scene = reel50.scenes[2]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.0 }))
    expect(html).toContain('minimal-vector-template')
    expect(html).toContain('اگه همه‌چیز یکجا بود چی؟')
    expect(html).not.toContain('NaN')
  })

  it('renders Scene 4 (Cinematic 3D Product — 4 Pillars) at t = 4.0s', () => {
    const scene = reel50.scenes[3]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 4.0 }))
    expect(html).toContain('cinematic-scene')
    expect(html).toContain('کنترل کامل دخل، انبار و مشتری')
    expect(html).toContain('۱. فروش و فاکتورها')
    expect(html).toContain('۲. موجودی و انبار')
    expect(html).toContain('۳. حساب مشتریان')
    expect(html).toContain('۴. گزارش‌های کسب‌وکار')
    expect(html).not.toContain('NaN')
  })

  it('renders Scene 5 (Versus stacked mode) at t = 3.0s', () => {
    const scene = reel50.scenes[4]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 3.0 }))
    expect(html).toContain('versus-stacked-mode')
    expect(html).toContain('کنترل بیشتر. سردرگمی کمتر.')
    expect(html).not.toContain('NaN')
  })

  it('renders Scene 6 (Brand CTA) at t = 2.0s', () => {
    const scene = reel50.scenes[5]!
    const html = renderToString(React.createElement(SceneView, { scene, t: 2.0 }))
    expect(html).toContain('Hisabche')
    expect(html).toContain('حسابچه رو ببین')
    expect(html).not.toContain('NaN')
  })
})

describe('Tactile Sound Engine & Foley Synthesizers', () => {
  it('exposes all 8 tactile sound synthesizers on soundEngine', () => {
    expect(typeof soundEngine.playMarkerScribble).toBe('function')
    expect(typeof soundEngine.playPaperRustle).toBe('function')
    expect(typeof soundEngine.playPaperTear).toBe('function')
    expect(typeof soundEngine.playCameraSwish).toBe('function')
    expect(typeof soundEngine.playTypewriterClick).toBe('function')
    expect(typeof soundEngine.playClockTickRapid).toBe('function')
    expect(typeof soundEngine.playChatPop).toBe('function')
    expect(typeof soundEngine.playReceiptPrint).toBe('function')
  })

  it('dispatches tactile sounds safely without error when muted or headless', () => {
    setMuted(true)

    const tactileKinds: SoundKind[] = [
      'markerScribble',
      'paperRustle',
      'paperTear',
      'cameraSwish',
      'typewriterClick',
      'clockTickRapid',
      'chatPop',
      'receiptPrint',
    ]

    tactileKinds.forEach((kind) => {
      expect(() => play(kind)).not.toThrow()
    })
  })
})
