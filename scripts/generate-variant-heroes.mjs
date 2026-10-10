// scripts/generate-variant-heroes.mjs
import { writeFileSync } from 'node:fs'

const HEROES = {
  '01-cinematic-operating-system': `'use client'
import React from 'react'
import { Activity } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 px-4 text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[hsl(var(--color-primary)/0.15)] via-transparent to-transparent">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.05)] text-[hsl(var(--color-primary))] mb-6">
        <Activity className="size-3.5 animate-pulse" />
        <span>سیستم‌عامل زنده سازمانی // v4.2</span>
      </div>
      <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
        کسب‌وکار شما، یک اکوسیستم پیوسته و هوشمند
      </h1>
      <p className="mt-6 text-base sm:text-lg text-[hsl(var(--fg-secondary))] max-w-2xl mx-auto leading-relaxed">
        هر تراکنش یک موج است که بلافاصله در تراز مالی، انبار و گزارش‌های لحظه‌ای طنین‌انداز می‌شود.
      </p>
    </section>
  )
}
`,

  '02-editorial-ledger': `'use client'
import React from 'react'

export function HeroScene() {
  return (
    <section className="pt-24 pb-16 px-6 max-w-5xl mx-auto border-b border-[hsl(var(--border-default))] font-serif text-start">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border-default))] pb-3 mb-8 text-xs font-mono uppercase tracking-widest text-[hsl(var(--fg-tertiary))]">
        <span>جلد اول · شماره ۴</span>
        <span>حسابداری دوطرفه لوکا پاچیولی</span>
      </div>
      <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[hsl(var(--fg-primary))] leading-tight">
        حسابداری نه یک وظیفه اداری، بلکه هنر انضباط سرمایه است
      </h1>
      <div className="grid sm:grid-cols-3 gap-8 mt-12 pt-8 border-t border-[hsl(var(--border-default))]">
        <p className="text-sm text-[hsl(var(--fg-secondary))] leading-relaxed sm:col-span-2">
          در این نسخه، شفافیت اعداد اصل اول است. هر ریال بدهکار با یک ریال بستانکار موازنه می‌شود، بدون خطای گردکردن و بدون اتلاف وقت.
        </p>
        <div className="text-xs font-mono text-[hsl(var(--fg-tertiary))] border-s border-[hsl(var(--border-default))] ps-4 flex flex-col justify-end">
          تراز دقیق دفاتر<br/>دقت ۱۰۰٪ ریاضی
        </div>
      </div>
    </section>
  )
}
`,

  '03-industrial-control-room': `'use client'
import React from 'react'
import { Terminal } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-20 pb-12 px-4 max-w-6xl mx-auto font-mono text-start">
      <div className="p-6 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-sunken)/0.5)]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border-default))] pb-3 mb-6 text-xs text-[hsl(var(--color-primary))]">
          <span className="flex items-center gap-2 font-bold">
            <Terminal className="size-4" /> CONTROL_ROOM // TELEMETRY_ACTIVE
          </span>
          <span className="text-[hsl(var(--color-success))] flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[hsl(var(--color-success))] animate-ping" /> SYS_OK
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[hsl(var(--fg-primary))] tracking-tight">
          مرکز کنترل عملیات تجاری: صفر تلرانس، حداکثر پایداری
        </h1>
        <p className="mt-4 text-xs sm:text-sm text-[hsl(var(--fg-secondary))] max-w-2xl">
          مهندسی شده برای کسب‌وکارهایی که با انضباط صنعتی اداره می‌شوند. سرعت بالا، کلیدهای میانبر و پایداری در اوج ترافیک.
        </p>
      </div>
    </section>
  )
}
`,

  '04-living-business-map': `'use client'
import React from 'react'
import { Compass } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-24 pb-16 px-4 max-w-5xl mx-auto text-center">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-sunken))] mb-6">
        <Compass className="size-3.5 text-[hsl(var(--color-primary))]" />
        نقشه توپولوژیک جریان داده‌ها
      </div>
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
        کسب‌وکار شما یک ارگانیسم زنده است
      </h1>
      <p className="mt-4 text-base text-[hsl(var(--fg-secondary))] max-w-2xl mx-auto">
        حرکت از فروشگاه به انبار، از انبار به دخل، و از دخل به دفاتر مالی در یک نقشه به‌هم‌پیوسته ارگانیک.
      </p>
    </section>
  )
}
`,

  '05-premium-financial-instrument': `'use client'
import React from 'react'
import { Gauge } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-28 pb-20 px-6 max-w-4xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[hsl(var(--border-default))] text-xs uppercase tracking-widest text-[hsl(var(--fg-tertiary))] mb-6">
        <Gauge className="size-3.5 text-[hsl(var(--color-primary))]" />
        CHRONOMETER GRADE ACCURACY // سوئیس توربیلون
      </div>
      <h1 className="text-4xl sm:text-6xl font-light tracking-tight text-[hsl(var(--fg-primary))]">
        دقت میکرومتری در قلب تراکنش‌های مالی
      </h1>
      <p className="mt-6 text-sm text-[hsl(var(--fg-secondary))] max-w-xl mx-auto leading-relaxed font-light">
        ساخته شده با وسواس و ظرافت ساعت‌های مکانیکی لوکس. بدون خطای گردکردن ارقام اعشاری در هر ۲۵ ارز جهانی.
      </p>
    </section>
  )
}
`,

  '06-digital-workshop': `'use client'
import React from 'react'
import { Hammer } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-20 pb-16 px-4 max-w-5xl mx-auto text-start">
      <div className="p-8 rounded-2xl border-2 border-[hsl(var(--border-default))] bg-[hsl(var(--surface-sunken)/0.3)]">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--color-primary))] mb-3">
          <Hammer className="size-4" /> کارگاه اصیل کاسبی بازار
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-[hsl(var(--fg-primary))]">
          ابزار دست کاسب، ساخته شده برای کف بازار
        </h1>
        <p className="mt-4 text-sm sm:text-base text-[hsl(var(--fg-secondary))] max-w-2xl leading-relaxed">
          از باسکول و بارکدخوان تا فیش پرینتر و کشوی پول؛ حسابچه لمس فیزیکی و واقعی دخل و حجره را می‌شناسد.
        </p>
      </div>
    </section>
  )
}
`,

  '07-swiss-business-system': `'use client'
import React from 'react'

export function HeroScene() {
  return (
    <section className="pt-20 pb-16 px-6 max-w-5xl mx-auto text-start border-b-2 border-[hsl(var(--fg-primary))]">
      <div className="text-xs font-mono font-bold uppercase tracking-wider text-[hsl(var(--color-primary))] mb-2">
        07 // INTERNATIONAL TYPOGRAPHIC STYLE
      </div>
      <h1 className="text-4xl sm:text-7xl font-black text-[hsl(var(--fg-primary))] tracking-tighter uppercase leading-none">
        سیستم مالی هدفمند
      </h1>
      <div className="grid sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-[hsl(var(--border-default))]">
        <p className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-secondary))] leading-relaxed">
          نظم مطلق و معماری اطلاعات منطقی. داده‌ها بدون تزئینات زائد و با کارایی ۱۰۰ درصدی ارائه می‌شوند.
        </p>
        <div className="text-xs font-mono text-[hsl(var(--fg-tertiary))]">
          گرید ۱۲ ستونی · فونت خوانا · دسترسی سریع
        </div>
      </div>
    </section>
  )
}
`,

  '08-quiet-future': `'use client'
import React from 'react'
import { Sparkles } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-32 pb-24 px-4 text-center max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))] mb-8">
        <Sparkles className="size-3 text-[hsl(var(--color-primary))]" /> سکون و آرامش مالی
      </div>
      <h1 className="text-3xl sm:text-5xl font-extralight text-[hsl(var(--fg-primary))] tracking-wide leading-tight">
        قدرت در سکوت جاری است
      </h1>
      <p className="mt-6 text-sm text-[hsl(var(--fg-secondary))] font-light leading-relaxed max-w-xl mx-auto">
        نرم‌افزاری که بدون هیاهو، استرس بستن حساب‌ها را حذف می‌کند. مدیریت کسب‌وکار باید این‌گونه آرام باشد.
      </p>
    </section>
  )
}
`,

  '09-business-story-film': `'use client'
import React from 'react'
import { Clapperboard } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-24 pb-16 px-4 max-w-5xl mx-auto text-start">
      <div className="aspect-[21/9] w-full rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-sunken)/0.6)] p-8 flex flex-col justify-end relative overflow-hidden">
        <div className="absolute top-4 start-4 flex items-center gap-2 text-xs font-mono text-[hsl(var(--color-primary))]">
          <Clapperboard className="size-4" /> پرده اول: نقطه عطف
        </div>
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
          از آشفتگی حساب‌ها تا تسلط کامل بر سازمان
        </h1>
        <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--fg-secondary))] max-w-xl">
          روایتی از تحول واقعی کسب‌وکارهایی که با حسابچه به یکپارچگی دست یافتند.
        </p>
      </div>
    </section>
  )
}
`,

  '10-unexpected-hisabche': `'use client'
import React from 'react'
import { Zap } from 'lucide-react'

export function HeroScene() {
  return (
    <section className="pt-20 pb-16 px-4 max-w-4xl mx-auto text-center">
      <div className="inline-block rotate-[-2deg] bg-[hsl(var(--color-primary))] text-white px-4 py-1 font-black text-sm uppercase shadow-md mb-6">
        <Zap className="size-4 inline me-1" /> حسابداری نباید حوصله‌سربر باشد!
      </div>
      <h1 className="text-4xl sm:text-7xl font-black text-[hsl(var(--fg-primary))] tracking-tighter leading-none">
        سریع، جسور، بدون معطلی
      </h1>
      <p className="mt-6 text-base text-[hsl(var(--fg-secondary))] max-w-xl mx-auto font-bold">
        کلیدهای میانبر، رابط کاربری فوق‌سریع و صدور فاکتور در کمتر از ۳ ثانیه.
      </p>
    </section>
  )
}
`,
}

for (const [id, code] of Object.entries(HEROES)) {
  const p = `packages/ui/src/components/ui/landing/variants/${id}/hero-scene.tsx`
  writeFileSync(p, code, 'utf8')
  console.log('Wrote', p)
}
