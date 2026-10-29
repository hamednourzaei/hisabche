# Short-Form Video Platform Readiness Audit

## Platform Evaluation Matrix (Instagram Reels, TikTok, YouTube Shorts)

| Evaluation Parameter             |   Instagram Reels    |      TikTok       |  YouTube Shorts   |           Project Source Status            |
| -------------------------------- | :------------------: | :---------------: | :---------------: | :----------------------------------------: |
| **Aspect Ratio (9:16 Vertical)** |      1080x1920       |     1080x1920     |     1080x1920     |    `SOURCE_CONFIGURED` (100% compliant)    |
| **Frame Rate**                   |        30 FPS        |     30/60 FPS     |     30/60 FPS     |   `SOURCE_CONFIGURED` (30 FPS standard)    |
| **Duration Constraint**          |        < 90s         |    < 60s/180s     |       < 60s       |   `SOURCE_CONFIGURED` (All reels ≤ 59s)    |
| **Bottom Title Safe Zone**       |     240px bottom     |   320px bottom    |   200px bottom    | `SOURCE_CONFIGURED` (Safe padding active)  |
| **Right UI Action Zone**         |     120px right      |    140px right    |    110px right    | `SOURCE_CONFIGURED` (Central column focus) |
| **Top Header Safe Zone**         |      160px top       |     160px top     |     140px top     |   `SOURCE_CONFIGURED` (Stage pinned LTR)   |
| **Mobile Typography Contrast**   |   WCAG AA (>4.5:1)   |      WCAG AA      |      WCAG AA      |  `SOURCE_CONFIGURED` (Dark studio theme)   |
| **Word Count per Cluster**       |      ≤ 6 words       |     ≤ 6 words     |     ≤ 6 words     |     `SOURCE_CONFIGURED` (Hard Rule 14)     |
| **Numeral Localization**         |    Persian digits    |  Persian digits   |  Persian digits   |  `SOURCE_CONFIGURED` (faNumber pure map)   |
| **Camera Zoom Stability**        | Fixed scale (noZoom) |    Fixed scale    |    Fixed scale    |   `SOURCE_CONFIGURED` (Law 9 compliant)    |
| **Sound-Off Comprehension**      |    100% Subtitled    |  100% Subtitled   |  100% Subtitled   |    `SOURCE_CONFIGURED` (Dual text & VO)    |
| **Lossless Production Render**   |  MP4 (H.264 / AAC)   |        MP4        |        MP4        |    `RENDER_VERIFIED` via export-mp4.mjs    |
| **Live Account Publication**     |  Pending live test   | Pending live test | Pending live test |  `PLATFORM_PUBLISHING_VERIFIED: PENDING`   |

## Three-Tier Readiness Classifications

1. **`SOURCE_CONFIGURED`:** 107 / 107 reels satisfy geometry, typography, and timing rules in code.
2. **`RENDER_VERIFIED`:** Verified on sampled test frames and individual batch MP4 exports.
3. **`PLATFORM_PUBLISHING_VERIFIED`:** Pending actual platform live publishing experiments.
