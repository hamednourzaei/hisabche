import os

VARIANTS_CONFIG = [
    {
        "id": "02-editorial-ledger",
        "name": "Variant02EditorialLedger",
        "container_class": "bg-[#fcfbf9] text-[#1a1a1a] font-serif selection:bg-neutral-900 selection:text-white border-t-8 border-black",
        "header_badge": "VOL. IV // FINANCIAL GAZETTE // NO. 142",
        "title_class": "font-serif text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-none",
        "card_class": "border-t-2 border-black pt-4",
        "border_style": "border-black",
        "accent_text": "text-neutral-900 font-mono text-xs uppercase tracking-widest",
        "hero_extra": '<div className="w-full max-w-5xl mx-auto border-y-2 border-black py-3 my-8 flex justify-between text-xs font-mono uppercase tracking-widest"><span>LUCA PACIOLI DOUBLE-ENTRY</span><span>AUDITED RECORD</span><span>OCTOBER 2026</span></div>',
        "flow_layout": "grid grid-cols-1 md:grid-cols-6 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-black border-y-2 border-black",
    },
    {
        "id": "03-industrial-control-room",
        "name": "Variant03IndustrialControl",
        "container_class": "bg-[#0c0e12] text-[#e0e6ed] font-mono selection:bg-emerald-500 selection:text-black",
        "header_badge": "SYS_STATUS: OPTIMAL // TELEMETRY LINK 01",
        "title_class": "font-mono text-4xl sm:text-6xl font-black tracking-tight text-emerald-400 uppercase",
        "card_class": "border border-emerald-500/30 bg-emerald-950/10 p-6 rounded-none",
        "border_style": "border-emerald-500/40",
        "accent_text": "text-emerald-400 font-mono text-xs font-bold",
        "hero_extra": '<div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs mb-8">● ALL 12 ENTERPRISE BUSES ONLINE</div>',
        "flow_layout": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
    },
    {
        "id": "04-living-business-map",
        "name": "Variant04BusinessMap",
        "container_class": "bg-[#f8fafc] text-slate-900 selection:bg-blue-600 selection:text-white",
        "header_badge": "TOPOLOGICAL ENTERPRISE MAP // LIVE MESH",
        "title_class": "text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900",
        "card_class": "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow",
        "border_style": "border-slate-200",
        "accent_text": "text-blue-600 font-sans text-xs font-bold uppercase",
        "hero_extra": '<div className="mx-auto max-w-xl p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-blue-900 text-xs text-center mb-8">نقشه توپولوژیک زنده: هر تراکنش مسیر بهینه خود را در شبکه کسب‌وکار می‌پیماید.</div>',
        "flow_layout": "grid grid-cols-1 md:grid-cols-5 gap-4",
    },
    {
        "id": "05-premium-financial-instrument",
        "name": "Variant05FinancialInstrument",
        "container_class": "bg-[#141416] text-[#e6e6e6] font-sans selection:bg-amber-400 selection:text-black",
        "header_badge": "SWISS CHRONOMETER GRADE // TOLERANCE 0.00%",
        "title_class": "text-4xl sm:text-6xl lg:text-7xl font-extralight tracking-wide text-white uppercase",
        "card_class": "rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-8 backdrop-blur-md",
        "border_style": "border-white/10",
        "accent_text": "text-amber-400 font-mono text-xs tracking-widest",
        "hero_extra": '<div className="size-16 mx-auto mb-8 rounded-full border border-amber-400/40 flex items-center justify-center text-amber-400"><span className="size-2 rounded-full bg-amber-400 animate-ping"/></div>',
        "flow_layout": "flex flex-col gap-8 max-w-3xl mx-auto",
    },
    {
        "id": "06-digital-workshop",
        "name": "Variant06DigitalWorkshop",
        "container_class": "bg-[#faf6f0] text-[#2d241e] font-sans selection:bg-amber-800 selection:text-white",
        "header_badge": "کارگاه اصیل کاسبی بازار // ساخت دست تجار",
        "title_class": "text-4xl sm:text-6xl font-black text-[#2d241e]",
        "card_class": "rounded-xl border-2 border-[#d9ccba] bg-[#fffdfa] p-6 shadow-sm",
        "border_style": "border-[#d9ccba]",
        "accent_text": "text-amber-800 font-bold text-xs",
        "hero_extra": '<div className="inline-block border-2 border-dashed border-[#d9ccba] px-6 py-2 rounded-xl text-xs font-bold text-amber-900 mb-8">ابزار دست کاسب کف بازار: دخل، ترازو، فیش و انبار</div>',
        "flow_layout": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
    },
    {
        "id": "07-swiss-business-system",
        "name": "Variant07SwissSystem",
        "container_class": "bg-white text-black font-sans selection:bg-red-600 selection:text-white border-s-8 border-red-600",
        "header_badge": "HELVETICA RATIONAL SYSTEM // 12-COLUMN DISCIPLINE",
        "title_class": "text-5xl sm:text-7xl lg:text-8xl font-black text-black uppercase leading-none tracking-tighter",
        "card_class": "border-t-4 border-black pt-4 rounded-none",
        "border_style": "border-black",
        "accent_text": "text-red-600 font-mono text-xs font-black uppercase",
        "hero_extra": '<div className="w-full max-w-4xl border-b-2 border-black pb-2 mb-8 flex justify-between font-mono text-xs font-bold"><span>07 / RATIONAL INDEX</span><span>NO DECORATION</span><span>100% UTILITY</span></div>',
        "flow_layout": "grid grid-cols-1 md:grid-cols-12 gap-6",
    },
    {
        "id": "08-quiet-future",
        "name": "Variant08QuietFuture",
        "container_class": "bg-[#fcfcfd] text-slate-600 font-sans selection:bg-slate-200 selection:text-slate-900",
        "header_badge": "AMBIENT SILENT INTELLIGENCE // ZERO DISTRACTION",
        "title_class": "text-3xl sm:text-5xl font-light text-slate-800 tracking-wide",
        "card_class": "rounded-2xl border border-slate-100 bg-white/60 p-8 shadow-sm backdrop-blur-sm",
        "border_style": "border-slate-100",
        "accent_text": "text-slate-400 text-xs font-normal",
        "hero_extra": '<div className="size-2 rounded-full bg-slate-300 mx-auto mb-8"/>',
        "flow_layout": "space-y-8 max-w-2xl mx-auto",
    },
    {
        "id": "09-business-story-film",
        "name": "Variant09StoryFilm",
        "container_class": "bg-[#050505] text-neutral-200 font-sans selection:bg-white selection:text-black",
        "header_badge": "ACT I: THE TRANSFORMATION CHRONICLE // WIDESCREEN",
        "title_class": "text-4xl sm:text-6xl font-black text-white tracking-tight",
        "card_class": "rounded-2xl border border-white/10 bg-neutral-900/60 p-8 backdrop-blur-md",
        "border_style": "border-white/15",
        "accent_text": "text-neutral-400 font-mono text-xs tracking-widest",
        "hero_extra": '<div className="aspect-[21/9] w-full max-w-4xl mx-auto border border-white/20 rounded-2xl flex items-center justify-center bg-neutral-950 mb-12 text-xs font-mono text-white/40">[21:9 WIDESCREEN FRAME // NARRATIVE SEQUENCE]</div>',
        "flow_layout": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
    },
    {
        "id": "10-unexpected-hisabche",
        "name": "Variant10Unexpected",
        "container_class": "bg-[#0b0f19] text-white font-sans selection:bg-indigo-500 selection:text-white",
        "header_badge": "RADIAL GRAVITATIONAL HORIZON // NON-LINEAR LEDGER",
        "title_class": "text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400",
        "card_class": "rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-transparent p-8 shadow-xl",
        "border_style": "border-indigo-500/30",
        "accent_text": "text-indigo-400 font-mono text-xs font-bold",
        "hero_extra": '<div className="size-32 mx-auto rounded-full border border-indigo-500/30 border-dashed flex items-center justify-center mb-8 animate-spin-slow"><div className="size-16 rounded-full border border-sky-400/50 flex items-center justify-center"><div className="size-4 rounded-full bg-indigo-500"/></div></div>',
        "flow_layout": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8",
    }
]

BASE_DIR = 'packages/ui/src/components/ui/landing/variants'

TEMPLATE = """'use client'

import React from 'react'
import { Database, Lock, ShieldCheck, ChevronDown, Rocket, CheckCircle2 } from 'lucide-react'
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
    <div className="relative min-h-screen w-full {CONTAINER_CLASS}" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      {/* 1. Hero Scene */}
      <section className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        <div className="mb-6 inline-block font-mono text-xs font-bold tracking-widest opacity-80">
          {HEADER_BADGE}
        </div>

        {HERO_EXTRA}

        <h1 className="mx-auto max-w-5xl text-balance {TITLE_CLASS}">
          {copy.hero.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg opacity-80 sm:text-xl">
          {copy.hero.subtitle}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button className="bg-[hsl(var(--color-primary))] text-white px-8 py-3.5 rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-opacity">
            {copy.hero.primaryCta}
          </button>
          <button className="border border-current/20 px-8 py-3.5 rounded-lg text-sm font-bold hover:bg-current/5 transition-colors">
            {copy.hero.secondaryCta}
          </button>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-6 text-xs font-medium opacity-70">
          {copy.hero.facts.map((fact, i) => (
            <span key={i} className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-[hsl(var(--color-primary))]" /> {fact}
            </span>
          ))}
        </div>
      </section>

      {/* 2. Business Flow Scene */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-24 border-t {BORDER_STYLE}">
        <SectionHeading
          label={copy.flow.subtitle}
          title={copy.flow.title}
          className="mb-16 text-center text-3xl sm:text-5xl"
        />

        <div className="{FLOW_LAYOUT}">
          {flowSteps.map((step, i) => (
            <div key={step.id} className="{CARD_CLASS}">
              <span className="{ACCENT_TEXT}">0{i + 1} // {step.id.toUpperCase()}</span>
              <h3 className="mt-3 text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-75">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Product Presentation Scene */}
      <section className="relative z-10 border-y {BORDER_STYLE} py-24">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeading
            label={copy.product.exampleLabel}
            title={copy.transform.title}
            description={copy.transform.desc}
            className="mb-16 text-center text-3xl sm:text-5xl max-w-3xl mx-auto"
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border {BORDER_STYLE} p-1 shadow-md">
              <div className="rounded-xl bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
                <LiveInvoiceWidget caption={copy.product.captions.invoice} note={copy.product.invoiceNote} />
              </div>
            </div>
            <div className="rounded-2xl border {BORDER_STYLE} p-1 shadow-md">
              <div className="rounded-xl bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
                <LiveJournalVoucherWidget caption={copy.product.captions.journal} />
              </div>
            </div>
            <div className="rounded-2xl border {BORDER_STYLE} p-1 shadow-md">
              <div className="rounded-xl bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
                <LiveTillRegisterWidget caption={copy.product.captions.till} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Offline & Sync Arc Scene */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-24">
        <SectionHeading
          label="SYNCHRONIZATION ARTIFACTS"
          title={copy.offline.title}
          description={copy.offline.subtitle}
          className="mb-16 text-center text-3xl sm:text-5xl"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {beats.slice(0, 4).map((beat, i) => (
            <div key={beat.id} className="{CARD_CLASS}">
              <span className="{ACCENT_TEXT}">PHASE 0{i + 1}</span>
              <h3 className="mt-2 text-lg font-bold">{beat.title}</h3>
              <p className="mt-2 text-xs leading-relaxed opacity-70">{beat.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border {BORDER_STYLE} p-1">
          <div className="rounded-xl bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
            <LiveOfflinePipelineWidget caption={copy.product.captions.offline} />
          </div>
        </div>
      </section>

      {/* 5. Modules Scene */}
      <section className="relative z-10 border-t {BORDER_STYLE} py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            label={copy.modules.label}
            title={copy.modules.title}
            description={copy.modules.desc}
            className="mb-16 text-start text-3xl sm:text-5xl"
          />

          <div className="grid gap-6 sm:grid-cols-2">
            {mods.map((group) => (
              <div key={group.id} className="{CARD_CLASS}">
                <h3 className="flex items-center gap-2 text-base font-bold text-[hsl(var(--color-primary))]">
                  <Database className="size-4" />
                  {group.title}
                </h3>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 text-sm opacity-80">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span>•</span> {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Security Scene */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-24 border-t {BORDER_STYLE}">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              label={copy.nav.trust}
              title={copy.trust.label}
              description={copy.trust.builtFor}
              className="mb-8 text-start text-3xl sm:text-5xl"
            />
            <div className="space-y-6">
              {security.map((pillar) => (
                <div key={pillar.id} className="flex gap-4">
                  <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                    <Lock className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold">{pillar.title}</h4>
                    <ul className="mt-1 space-y-0.5 text-xs opacity-70">
                      {pillar.bullets.map((b, i) => (
                        <li key={i}>— {b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <div className="p-12 rounded-3xl border {BORDER_STYLE} text-center">
              <ShieldCheck className="size-20 mx-auto text-[hsl(var(--color-primary))]" />
              <h4 className="mt-4 text-xl font-bold">{copy.trust.platforms}</h4>
              <p className="mt-2 text-xs opacity-70 max-w-xs">{copy.trust.languages}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Pricing & FAQ Scene */}
      <section className="relative z-10 border-t {BORDER_STYLE} py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            label="TIER ARCHITECTURE"
            title={copy.pricing.label}
            className="mb-16 text-center text-3xl sm:text-5xl"
          />

          <div className="grid gap-6 sm:grid-cols-3">
            {pricingPlans(copy).map((plan) => (
              <div key={plan.id} className="{CARD_CLASS} flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-xs opacity-70">{plan.who}</p>
                  <div className="my-6 h-px w-full bg-current/10" />
                  <p className="text-sm font-bold text-[hsl(var(--color-primary))]">{plan.bestIf}</p>
                </div>
                <button className="mt-8 block w-full rounded-lg border border-current/20 py-2.5 text-xs font-bold hover:bg-current/5 transition-colors">
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-24 mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold">{copy.faq.category}</h2>
            <div className="space-y-3">
              {faqEntries(copy).slice(0, 5).map((faq, i) => (
                <details key={i} className="group rounded-xl border {BORDER_STYLE} p-4 open:bg-current/[0.02]">
                  <summary className="flex cursor-pointer items-center justify-between font-bold text-sm marker:content-none">
                    {faq.q}
                    <ChevronDown className="size-4 opacity-50 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed opacity-75">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. CTA Scene & Footer */}
      <section className="relative z-10 border-t {BORDER_STYLE} py-24 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <Rocket className="size-10 mx-auto text-[hsl(var(--color-primary))] mb-4" />
          <h2 className="text-3xl sm:text-5xl font-black">{copy.cta.title}</h2>
          <p className="mt-4 text-sm opacity-80">{copy.cta.subtitle}</p>
          <button className="mt-8 rounded-lg bg-[hsl(var(--color-primary))] px-8 py-3 text-sm font-bold text-white shadow-md hover:opacity-90">
            {copy.cta.button}
          </button>
        </div>
      </section>

      <footer className="border-t {BORDER_STYLE} py-8 text-center text-xs opacity-50">
        <p>{copy.footer.tagline} · © {new Date().getFullYear()} {copy.footer.copyright}</p>
      </footer>
    </div>
  )
}

export default {NAME}
"""

for cfg in VARIANTS_CONFIG:
    path = os.path.join(BASE_DIR, cfg["id"], "index.tsx")
    code = (
        TEMPLATE.replace("{NAME}", cfg["name"])
        .replace("{CONTAINER_CLASS}", cfg["container_class"])
        .replace("{HEADER_BADGE}", cfg["header_badge"])
        .replace("{TITLE_CLASS}", cfg["title_class"])
        .replace("{CARD_CLASS}", cfg["card_class"])
        .replace("{BORDER_STYLE}", cfg["border_style"])
        .replace("{ACCENT_TEXT}", cfg["accent_text"])
        .replace("{HERO_EXTRA}", cfg["hero_extra"])
        .replace("{FLOW_LAYOUT}", cfg["flow_layout"])
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(code)
    print("Wrote complete implementation for", cfg["id"])
