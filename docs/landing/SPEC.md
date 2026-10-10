# HISABCHE LANDING RECONSTRUCTION — SPEC & ARCHITECTURE

## 1. Architectural Boundary (Shared vs Variant-Specific)

### Shared Primitives (Reusable, DRY)

- **Token System:** Semantic variables `hsl(var(--color-*))` for strict multi-theme alignment.
- **Copy Resolution:** `packages/ui/src/components/ui/landing/copy.ts` resolves server translations once, completely detaching variants from browser next-intl dependencies.
- **Product Widgets:** Real embedded ERP features (`LiveInvoiceWidget`, `LiveTillRegisterWidget`, `LiveJournalVoucherWidget`, `LiveOfflinePipelineWidget`) using zero fake data (G1).
- **Motion Infrastructure:** `use-scene-observer.ts` and `use-scroll-narrative-store.ts` handling scroll triggers cleanly without per-frame CPU hogging.

### Variant-Specific Dimensions (Divergent)

Each variant must diverge across >=6 dimensions:

1. **Hero Composition:** Layout, depth, lighting, and entry interaction.
2. **Typography System:** Editorial serif, stark Swiss grotesque, monospace telemetry, or modern humanist.
3. **Spatial Grammar:** Strict linear columns, multi-axis asymmetrical grid, modular control panels, or layered cards.
4. **Motion Language:** Snappy industrial snap, horological precision spring, cinematic pan reveals, or zen dissolved states.
5. **Product Presentation:** How real product cards are framed (e.g. T-Accounts, industrial rack mount, horological calibers, physical paper receipt).
6. **Information Architecture & Density:** Compact low-whitespace vs airy expansive reading flow.

## 2. 10 Variant Declarations

| ID  | Name                 | Core Aesthetic                          | Motion Rhythm               | Product Metaphor              |
| --- | -------------------- | --------------------------------------- | --------------------------- | ----------------------------- |
| 01  | Cinematic OS         | Dark radial grid, neon telemetry        | Fluid scroll choreography   | Cosmic enterprise system      |
| 02  | Editorial Ledger     | High-contrast monochrome, sharp borders | Crisp line reveals          | Luca Pacioli T-Accounts       |
| 03  | Industrial Control   | High-density telemetry, mono labels     | Sharp hardware snaps        | Mission-critical rack mount   |
| 04  | Living Business Map  | Topological vector network              | Data pulse flows            | Organism neural network       |
| 05  | Financial Instrument | Refined hairlines, generous whitespace  | Horological dampened spring | Swiss mechanical chronometer  |
| 06  | Digital Workshop     | Tactile warm cards, slip overlays       | Physical spring bounce      | Physical bazaar craftsmanship |
| 07  | Swiss System         | 12-column strict grid, grotesque type   | Instant linear transitions  | Objective functional system   |
| 08  | Quiet Future         | Low-contrast whisper, glass frosted     | Slow breathing ease         | Ambient silent intelligence   |
| 09  | Business Story Film  | Widescreen ratios, dramatic spotlight   | Cinematic pan dissolves     | 3-Act documentary sequence    |
| 10  | Unexpected Cosmos    | Concentric orbital dials, gravity well  | Orbital celestial rotation  | Central gravitational ledger  |

## 3. Production & Performance Budget

- **Zero Heavy Bundle:** Dynamic loading (`lazy()` + `Suspense`) ensures visitors load ONLY their active variant.
- **Strict Logic CSS:** Complete RTL logical properties (ms/me, ps/pe, start/end).
- **Accessibility:** 100% compliant contrast, keyboard navigation, and full `prefers-reduced-motion` fallbacks.
