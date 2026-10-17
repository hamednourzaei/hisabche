# Hisabche Promo Reel — Token & Asset Catalog
> **Path:** `.claude/reel-plugin/token-catalog.md`  
> **Source of Truth:** `src/ui/icons.tsx`, `src/ui/card.tsx`, `src/ui/rich.tsx`, `src/engine/sound.ts`

---

## 1. Icons Dictionary (`<Icon name="..." />`)

All 40 valid icon names verified from `src/ui/icons.tsx` (backed by Lucide React with Persian financial semantic mapping):

| Icon Name | Category | Metaphor & Typical Usage |
|---|---|---|
| `barcode` | Retail / Inventory | بارکدخوان، اسکن سریع کالا در دخل |
| `book` | Legacy / Traditional | دفاتر دستی، دفترچه نسیه سنتی |
| `boxes` | Inventory | موجودی انبار، کارتن‌های کالا |
| `briefcase` | Operations | امور اداری، قراردادها |
| `calculator` | Legacy / Accounting | ماشین‌حساب دستی، محاسبات کند و خطاخیز |
| `calendar` | Scheduling | سررسید، موعد چک‌ها، اقساط |
| `check` | Success | تایید سند، تسویه موفق، رفع مغایرت |
| `clipboard` | Audit | لیست انبارگردانی، گزارش روزانه |
| `cloud` | SaaS / Infrastructure | همگام‌سازی ابری، دسترسی از راه دور |
| `coins` | Cash / Minor Units | پول نقد، خرده‌حساب، سود نقدی |
| `factory` | Production | کارگاه تولیدی، بهای تمام‌شده کالا |
| `sheet` | Legacy / Spreadsheets | فایل اکسل، فرمول‌های شکننده |
| `file` | Documents | فاکتور، سند رسمی، پیش‌فاکتور |
| `drive` | Backup | فایل پشتیبان، سرور محلی |
| `history` | Audit Trail | لاگ تغییرات، ردیابی چه کسی فاکتور را پاک کرد |
| `bank` | Banking | بانک، چک صیادی بنفش، حساب جاری |
| `laptop` | Workplace | نسخه دسکتاپ و وب حسابچه |
| `chat` | Communication | یادآور خودکار پیامکی به مشتریان |
| `notebook` | Traditional | چرک‌نویس، یادداشت‌های پراکنده |
| `package` | Warehouse | بسته تحویلی، سفارش ارسالی به باربری |
| `receipt` | Sales Counter | فیش صندوق، رسید پرداخت کارتخوان |
| `sync` | Automation | راس‌گیری، تطبیق حساب‌ها، ثبت خودکار |
| `scale` | Balance | تراز آزمایشی، تعادل بدهکار و بستانکار |
| `shield` | Security | نسخه پشتیبان رمزنگاری‌شده، امنیت داده |
| `smartphone` | Mobile | نسخه موبایل، گزارش‌گیری فوری در دست مدیر |
| `sparkles` | AI / Advantage | هوش مالی، اتوماسیون بی‌دردسر |
| `store` | Retail | فروشگاه، مغازه، پیشخوان بازار |
| `sun` | Timeline | شروع شیفت صبح، گشایش بازار |
| `moon` | Timeline | بستن دخل شب، پایان روز کاری |
| `trash` | Error / Leak | خط‌خوردگی فاکتور، دورریز کالا، هدررفت پول |
| `trend` | Growth | رشد فروش، افزایش مارجین سود |
| `truck` | Logistics | تحویل باربری، توزیع عمده، ترانزیت بین شعب |
| `user` | Customer | مشتری تک، خریدار، فروشنده |
| `users` | Market | طرف‌حساب‌های تجاری، بنکداران بازار |
| `wallet` | Cashflow | صندوق نقدی، کیف پول، نقدینگی در دسترس |
| `offline` | Resilient POS | قطع اینترنت، کارکرد آفلاین بدون توقف |
| `gem` | High Value | مشتریان VIP، کالاهای باارزش |
| `dollar` | Multi-Currency | ارز مبنا، معاملات ارزی، حواله |
| `question` | Dilemma | ابهام مالی، مغایرت ناشناخته |

*Usage Example:*
```tsx
<Icon name="bank" size={24} color="#22d3ee" />
```

---

## 2. Visual Tones (`export type Tone`)

Verified from `src/ui/card.tsx`:

| Tone | Hex Solid | Background Soft | Neon Glow | Semantic Meaning |
|---|---|---|---|---|
| `'cyan'` | `#22d3ee` | `rgba(6,182,212,0.16)` | `rgba(6,182,212,0.28)` | Hisabche automated action, SaaS intelligence, technology |
| `'purple'` | `#c084fc` | `rgba(168,85,247,0.16)` | `rgba(168,85,247,0.28)` | Sayadi cheques, executive ledger, banking transactions |
| `'red'` | `#fb7185` | `rgba(244,63,94,0.16)` | `rgba(244,63,94,0.28)` | Consequence, bounced cheque, cash deficit, trapped capital |
| `'green'` | `#4ade80` | `rgba(34,197,94,0.16)` | `rgba(34,197,94,0.28)` | Cleared cheque, collected receivables, profit milestone |

---

## 3. Audio Cues (`SoundKind`)

Verified from `src/engine/sound.ts` (deterministic Web Audio synth & FFmpeg audio track synthesis):

### Kinetic UI & Physical Foley
- `'whoosh'`: Smooth organic air displacement (< 450Hz low-pass filtered, zero harsh white noise).
- `'impact'`: Physical rubber-stamp impact thud (55Hz sub-punch + tactile wood slap).
- `'pop'`: Fast kinetic element entrance (800Hz to 120Hz downward chirp).
- `'tick'`: Editorial clock ticker / micro dial click.
- `'clockTickRapid'`: Fast urgent countdown clicks approaching 12:00:00.
- `'paperRustle'`: Physical paper receipt handling.
- `'paperTear'`: Invoice or cheque leaf tearing.
- `'cameraSwish'`: Swift scene transition sweep.
- `'typewriterClick'`: Mechanical typewriter / tactile POS key press.
- `'receiptPrint'`: Thermal receipt stepper motor line feed.
- `'chatPop'`: Mobile SMS / push notification bubble sound.
- `'cardThock'`: Soft mechanical thock (apple-like tap or damped keyboard) for card entry.

### Musical, Harmonics & Milestones
- `'chime'`: Warm acoustic triad bell partials (E4, G4, B4 ~ 329.6Hz to 493.8Hz).
- `'cash'`: Metallic register latch and coin ring.
- `'alert'`: Dramatic tension interval with low-register cello dissonance.
- `'scan'`: Telemetry carrier sweep for barcode scanning.
- `'success'`: Warm Cmaj9 harmonic resolution.
- `'titleHit'`: Deep cinematic sub foundation.
- `'cinematicReveal'`: Sub-bass drop for headline impact.
- `'precisionSequence'`: Harmonic clockwork tick progression.

---

## 4. Rich Text Inline Markup (`<Rich text="..." />`)

Verified from `src/ui/rich.tsx`:

| Syntax | CSS Class | Visual Output |
|---|---|---|
| `[c:متن]` | `.hl-cyan` | Bright neon cyan text highlight (`#22d3ee`) |
| `[p:متن]` | `.hl-purple` | Bright neon purple text highlight (`#c084fc`) |
| `[g:متن]` | `.hl-gradient` | Cyan-to-Purple animated gradient text |
| `[r:متن]` | `.hl-red` | Urgent coral red warning text highlight (`#fb7185`) |
| `[w:متن]` | `.hl-white` | Pure white heavy bold text |

*Example in script:*
```ts
lines: ['ساعت [r:۱۲ ظهر] چکت [r:برگشت می‌خوره]!']
```

---

## 5. Typography & Persian RTL Layout

- **Font Family:** `Vazirmatn`, system-ui, sans-serif.
- **Numbers:** Always formatted with Persian digits (`۱۲:۰۰:۰۰`, `۴۳۰,۰۰۰,۰۰۰ تومان`) using `faNumber()` helper or Persian glyphs.
- **Weights:** Regular (400), SemiBold (600), Bold (700), ExtraBold (800), Black (900).
- **RTL Logical Properties:** Use logical CSS properties exclusively:
  - `ms-` / `me-` (margin-inline-start / margin-inline-end)
  - `ps-` / `pe-` (padding-inline-start / padding-inline-end)
  - `text-start` / `text-end`
  - `border-e` / `border-s`
  - **Strictly Banned:** Raw `left` and `right` positioning properties.
