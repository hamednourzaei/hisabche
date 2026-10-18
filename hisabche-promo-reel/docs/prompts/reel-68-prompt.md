# Reel 68 — «دزد دخلت کیه وقتی نه دزدی شده و نه فروشت کمه؟»

- **Duration:** 18.0 seconds · 4 scenes · theme `cinematic-obsidian` · actors `r68-*` (`src/components/Reel68ShowreelActors.tsx`)
- **Format:** 9:16 vertical (1080×1920 @ 30fps)
- **New Hook:** «دزد دخلت کیه وقتی نه دزدی شده و نه فروشت کمه؟» (Voiceover opening: «نه کسی از دخل برداشته، نه فروشت کمه؛ پس چرا همیشه بی‌پولی؟»)
  - Checked against reels 01–67 titles: unprecedented uncomfortable discovery.
- **Role/Persona:** Retail shopkeeper & wholesaler (کاسب خرده‌فروش و عمده‌فروش).
- **Product Truth:**
  - Real-time line-by-line profit calculation (`AccountingService.getInvoiceMargins`).
  - Automatic COGS deduction and scrap detection; paper profit vs actual net cash.
  - Multi-node synchronized pipeline: 1 invoice automatically syncs warehouse stock, till balance, and net profit ledger.
- **Forbidden Claims:** zero used (no tax-ID connection, no SMS, no 100%, no guarantees, no fictitious bank ties).

## Script & Shot List

| #   | Time      | Line (VO)                                                              | Visual Stage & Motion                                                                                                   | Sound Cues                                                 |
| --- | --------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | 0.0–4.5   | نه کسی از دخل برداشته، نه فروشت کمه؛ پس چرا همیشه بی‌پولی؟             | Vault card slams shut; sales counter surges to ۸۵۰ میلیون; mystery drain alert pops with zero cash balance              | `cardThock`, `cash`, `alert`, `impact`                     |
| 2   | 4.5–9.0   | چون سودت روی کاغذ زنده است، اما هزینه‌های پنهان می‌بلعندش.             | Exploded 3D layer deconstruction: apparent paper profit card splits, reveals hidden scrap and uncalculated cost layers  | `paperRustle`, `pop`, `cardEnter`, `alert`, `whoosh`       |
| 3   | 9.0–14.5  | در حسابچه، یک فاکتور همزمان انبار، صندوق و سود واقعی را هماهنگ می‌کند. | Quantum sync conduit hub ignites: single invoice pulse triggers 3 synchronized nodes (warehouse, cash till, net profit) | `chime`, `pop`, `cardEnter`, `tick`, `dataFlow`, `success` |
| 4   | 14.5–18.0 | نبض شفاف دخل تو؛ شروع رایگان در حسابچه.                                | Heartbeat shock badge resolves; emerald luminous CTA bloom; brand aurora glow on hisabche.com (held ≥ 3.5s)             | `insightReveal`, `pop`, `ctaResolution`, `chime`           |

## Production Rules & AV Sync

- **HARD RULE 13 & 14:** Single focal stage centered at $Y \in [42\%, 58\%]$. Spoken dialogue lives strictly in the floating teleprompter (`bottom: 80px`). On-stage labels are concise (≤ 6 words). Zero divider lines.
- **AV SYNC LAW:**
  - Every word paired with a sound event carries an `action` and is read via `cueAt` in `Reel68ShowreelActors.tsx`.
  - Zero sound on `sentenceEnding`.
  - Climax scene (Scene 3) holds 1.1s (≥ 1.0s) after sentence ending.
- **Alignment:** `PROVISIONAL_CADENCE_MODEL_ACTIVE`. After studio voiceover is placed: `node scripts/place-voiceover.mjs 68 <audio-file>`.
