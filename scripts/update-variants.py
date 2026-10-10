import os
import re

VARIANTS = [
    ('02-editorial-ledger', 'Variant02EditorialLedger', 'bg-white text-black font-serif border-b-[8px] border-black'),
    ('03-industrial-control-room', 'Variant03IndustrialControl', 'bg-zinc-950 text-emerald-400 font-mono'),
    ('04-living-business-map', 'Variant04BusinessMap', 'bg-[#f8f9fa] text-slate-800'),
    ('05-premium-financial-instrument', 'Variant05FinancialInstrument', 'bg-stone-50 text-stone-900 tracking-wide'),
    ('06-digital-workshop', 'Variant06DigitalWorkshop', 'bg-amber-50 text-amber-950'),
    ('07-swiss-business-system', 'Variant07SwissSystem', 'bg-neutral-100 text-neutral-900 border-x-4 border-red-600'),
    ('08-quiet-future', 'Variant08QuietFuture', 'bg-slate-50 text-slate-500 font-light'),
    ('09-business-story-film', 'Variant09StoryFilm', 'bg-black text-white'),
    ('10-unexpected-hisabche', 'Variant10Unexpected', 'bg-blue-600 text-white font-black')
]

TEMPLATE = """'use client'

import React from 'react'
import { Activity, Database, Lock, ShieldCheck, ChevronDown, Rocket } from 'lucide-react'
import type { LandingCopy } from '../../copy'
import {
  businessFlowSteps,
  offlineBeats,
  moduleGroups,
  securityPillars,
  pricingPlans,
  faqEntries,
  SectionHeading,
} from '../variant-section-kit'
import { LiveInvoiceWidget, LiveJournalVoucherWidget, LiveTillRegisterWidget, LiveOfflinePipelineWidget } from '../../shared/real-product-embeds'

export function {NAME}({ copy, locale }: { copy: LandingCopy; locale: string }) {
  const flowSteps = businessFlowSteps(copy)
  const beats = offlineBeats(copy)
  const mods = moduleGroups(copy)
  const security = securityPillars(copy)

  return (
    <div className="relative min-h-screen w-full {THEME}" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      {/* 1. Hero */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 pt-20 text-center">
        <h1 className="mx-auto max-w-4xl text-balance text-4xl sm:text-6xl font-bold">
          {copy.hero.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg opacity-80">
          {copy.hero.subtitle}
        </p>
        <div className="mt-10 flex gap-4">
          <button className="bg-[hsl(var(--color-primary))] text-white px-8 py-3 rounded-md font-bold">
            {copy.hero.primaryCta}
          </button>
        </div>
      </section>

      {/* 2. Business Flow Scene */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <SectionHeading label={copy.flow.subtitle} title={copy.flow.title} className="mb-12 text-center text-3xl" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {flowSteps.map((step, i) => (
            <div key={step.id} className="border border-current/10 p-6">
              <span className="opacity-50 text-xs">0{i + 1}</span>
              <h3 className="text-xl font-bold mt-2">{step.title}</h3>
              <p className="mt-2 text-sm opacity-70">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Product Presentation */}
      <section className="py-24 border-y border-current/10">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeading title={copy.transform.title} description={copy.transform.desc} className="mb-12 text-center text-3xl" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] p-2 border shadow-lg"><LiveInvoiceWidget caption={copy.product.captions.invoice} note={copy.product.invoiceNote} /></div>
            <div className="bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] p-2 border shadow-lg"><LiveJournalVoucherWidget caption={copy.product.captions.journal} /></div>
            <div className="bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] p-2 border shadow-lg"><LiveTillRegisterWidget caption={copy.product.captions.till} /></div>
          </div>
        </div>
      </section>

      {/* 4. Offline Arc */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <SectionHeading title={copy.offline.title} description={copy.offline.subtitle} className="mb-12 text-center text-3xl" />
        <div className="mx-auto max-w-3xl bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] p-2 border shadow-lg">
          <LiveOfflinePipelineWidget caption={copy.product.captions.offline} />
        </div>
      </section>

      {/* 5. Pricing & FAQ */}
      <section className="py-24 border-t border-current/10">
        <div className="mx-auto max-w-5xl px-4">
          <SectionHeading title={copy.pricing.label} className="mb-12 text-center text-3xl" />
          <div className="grid gap-6 sm:grid-cols-3 mb-24">
            {pricingPlans(copy).map((plan) => (
              <div key={plan.id} className="border border-current/20 p-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-sm opacity-60">{plan.who}</p>
                <div className="my-6 border-t border-current/10" />
                <p className="text-sm font-medium">{plan.bestIf}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-2xl font-bold">{copy.faq.category.start}</h2>
            <div className="space-y-4">
              {faqEntries(copy).slice(0, 5).map((faq, i) => (
                <details key={i} className="border border-current/10 p-4">
                  <summary className="font-bold cursor-pointer">{faq.q}</summary>
                  <p className="mt-4 text-sm opacity-80">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm opacity-50 border-t border-current/10">
        <p>{copy.footer.tagline} · © {new Date().getFullYear()} {copy.footer.copyright}</p>
      </footer>
    </div>
  )
}

export default {NAME}
"""

BASE = 'packages/ui/src/components/ui/landing/variants'

for folder, name, theme in VARIANTS:
    path = os.path.join(BASE, folder, 'index.tsx')
    content = TEMPLATE.replace('{NAME}', name).replace('{THEME}', theme)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    # delete stub files
    for stub in ['hero-scene.tsx', 'product-scene.tsx', 'flow-scene.tsx', 'offline-scene.tsx', 'business-flow-scene.tsx', 'chapter-scene.tsx', 'compare-scene.tsx', 'cta-scene.tsx', 'faq-scene.tsx', 'modules-scene.tsx', 'pricing-scene.tsx', 'security-scene.tsx', 'site-footer-view.tsx', 'system-scene.tsx', 'transform-scene.tsx', 'trust-bar-scene.tsx', 'chapter-visuals.tsx', 'landing-primitives.tsx', 'offline-sync-scene.tsx', 'cinematic-hero.tsx']:
        stub_path = os.path.join(BASE, folder, stub)
        if os.path.exists(stub_path):
            os.remove(stub_path)

print("All variants updated!")
