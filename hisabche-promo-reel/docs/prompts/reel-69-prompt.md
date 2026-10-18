# Reel 69 — Pocketsflow Creator E-Commerce Explainer

- **Duration:** 15.0 seconds · 6 scenes · theme `swiss-editorial` · actors `r69-*` (`src/components/Reel69ShowreelActors.tsx`)
- **Format:** 9:16 vertical (1080×1920 @ 30fps)
- **Palette & Look:** Clean stark white background with subtle faint gray grid lines (`#ffffff`, `rgba(0,0,0,0.045)`), bold vibrant blue cards (`#0056B3`), black typography (`#111827`), flat lighting with no shadows, dithered retro texture on animated character and accents.
- **Typography:** SF Pro / Inter sans-serif with bold headings and clean body weights.
- **Exact on-screen words quoted:**
  - Frame 1: “Got something”, “// for creators”
  - Frame 2: “Courses”, “Ebooks”, “Apps”
  - Frame 3: “Design Course $149.00”, “Apple Pay”, “Pay $149.00”
  - Frame 4: “Workbook upsell $19.00”, “Tax - VAT 20% $33.60”, “Add the workbook”
  - Frame 5: “1:1 coaching call $99”, “$9 / month”, “EU VAT”, “UK VAT”, “US sales tax”, “$12,480.00”
  - Frame 6: “Pocketsflow” (“Pockets” + “flow”)

## Script & Shot List

| #   | Time      | Spoken Line                               | Visual Stage & Motion                                                                                                                                                                    | Sound Cues                                            |
| --- | --------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | 0.0–1.5   | Got something for creators.               | White screen + subtle grid. Smiling dithered character on right; “// for creators” & “Got something” on left.                                                                            | `pop`, `cardEnter`, `chime`                           |
| 2   | 1.5–4.5   | Sell Courses, Ebooks, and Apps.           | Background transitions to bold blue UI panel (#0056B3). Character remains static on right; 3 product cards slide in from right.                                                          | `whoosh`, `cardThock`, `cardThock`, `cardThock`       |
| 3   | 4.5–7.5   | Design Course $149.00, instant Apple Pay. | Blue panel slides out revealing checkout screen on left. Character shrinks & floats to center-right looking at screen. Shows “Apple Pay”, “Pay $149.00”.                                 | `cardEnter`, `tick`, `softTransition`, `pop`, `cash`  |
| 4   | 7.5–10.0  | Workbook upsell $19.00, Tax - VAT 20%.    | Checkout updates with “Workbook upsell $19.00”, “Add the workbook”, and “Tax - VAT 20% $33.60”. Character smiles in place.                                                               | `pop`, `tick`, `dataFlow`, `insightReveal`            |
| 5   | 10.0–13.5 | Add the workbook, $9 / month, $12,480.00. | Modular multi-panel split explosion: “1:1 coaching call $99”, “$9 / month”, VAT chips (EU VAT, UK VAT, US sales tax), and “$12,480.00”. Character floats in center. Climax holds ≥ 1.0s. | `impact`, `cardEnter`, `tick`, `cardEnter`, `success` |
| 6   | 13.5–15.0 | Pockets... flow.                          | Screen fades to pure white. “Pockets” animates in from left (fading in first), then “flow” slides in from right to form “Pocketsflow”.                                                   | `softTransition`, `ctaResolution`                     |

## Production Rules & AV Sync

- **HARD RULE 13 & 14:** Single focal stage per beat, ≤ 6 words per on-stage label.
- **AV SYNC LAW:**
  - Every word paired with a sound event carries an `action` and is read via `cueAt` in `Reel69ShowreelActors.tsx`.
  - Zero sound on `sentenceEnding`.
  - Climax scene (Scene 5) holds 1.05s (≥ 1.0s) after sentence ending.
- **Alignment:** `PROVISIONAL_CADENCE_MODEL_ACTIVE`.
