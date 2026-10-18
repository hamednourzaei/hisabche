# Reel 67 — «همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؟»

- **Duration:** 48 seconds · 6 scenes · theme `midnight-gold` · actors `r67-*` (`src/components/Reel67PriceListActors.tsx`)
- **New hook:** a customer confronts the shop (customer-confrontation). The same item was sold at two prices.
  - Checked against the titles of reels 01–66: neither «همسایه» nor «دو قیمت» appears in any of them.
  - «فهرست قیمت» has never been the subject of a reel.
- **Customer:** wholesaler or neighbourhood grocer (عمده/خرده‌فروش).
- **Product truth:**
  - `packages/validation/src/schemas/pricing.ts` (Price lists #19) and `backend/src/services/commerce/price-list.service.ts`.
  - A price list is a named set of product prices in one currency.
  - Each customer is put on one list, and the invoice takes the line price from that list.
  - A product that isn't on the list keeps its own price.
- **Forbidden claims:** none used. No text messages, no guarantees, no 100%, no bank connection.

## Script (two phrases per scene, split at «؛» or «:» — for `place-voiceover.mjs`)

| #   | Time      | Line (VO)                                                          | Visual                                                                                             |
| --- | --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | 0.0–7.5   | همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؛ چرا به من گرون‌تر؟  | 25 kg sack + two receipts: ۱٬۹۵۰ green and ۲٬۱۰۰ with a red glow                                   |
| 2   | 7.5–15.5  | قیمت عمده و خرده فقط توی ذهن خودته؛ شاگرد تازه هر بار یه عدد میگه. | Yellow «عمده / خرده» tags blur out; the shop boy's price odometer runs through 4 different numbers |
| 3   | 15.5–23.0 | یه قیمت اشتباه؛ یا سودت رفته، یا مشتری‌ات.                         | Scale: a coin falls from «سود», a person walks away from «مشتری»                                   |
| 4   | 23.0–31.0 | توی حسابچه هر مشتری فهرست قیمت خودش رو داره: عمده، خرده، همکار.    | Three list cards spread out and each lights up on its own word                                     |
| 5   | 31.0–39.0 | اسم مشتری رو که بزنی؛ فاکتور خودش قیمت همون فهرست رو میذاره.       | «حاجی رحیم» is typed → the rice line fills itself with ۱٬۹۵۰ and an «عمده» badge                   |
| 6   | 39.0–48.0 | قیمت‌هات رو یک بار بنویس؛ شروع رایگان در حسابچه.                   | Swinging price tag «یک قیمت، همیشه» → «شروع رایگان» button → hisabche.com (held ≥ 3 s)             |

## Rules

- **HARD RULE 14:** the narration appears only in the subtitles. On-stage labels are 1–2 words (product, price, list name), no more than 6 words at once. No divider lines.
- **AV SYNC LAW:**
  - Every word that carries a sound has an `action`, and the actor reads it with `cueAt`.
  - No `sentenceEnding` has a sound.
  - `check-av-sync.mjs 67 --mix`: 26 transients, all within ±45 ms.
- **Alignment:** `PROVISIONAL_CADENCE_MODEL_ACTIVE`. After the voiceover is recorded (see `voiceover-elevenlabs.md`): `node scripts/place-voiceover.mjs 67 <file>`.

## Voiceover direction

- **Scene 1:** the voice of a mildly offended regular customer — a real question, not a shout.
- **Scenes 2–3:** the shopkeeper's inner voice, flat and tired.
- **Scenes 4–6:** calm and confident; stress «فهرست قیمت» and «خودش».
