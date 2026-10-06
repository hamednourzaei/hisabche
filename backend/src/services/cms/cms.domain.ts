// ============================================
// backend/src/services/cms/cms.domain.ts
//
// Pure domain rules for the CMS. No DB, no network.
// Design-System-Aware: every visual value maps to a Hisabche token.
// ============================================

import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════
// BLOCK TYPES — exhaustive list of supported section types
// ═══════════════════════════════════════════════════════════════

export const BLOCK_TYPES = [
  'hero',
  'feature-grid',
  'feature-list',
  'cta',
  'faq',
  'testimonials',
  'pricing',
  'blog-grid',
  'content',
  'image-text',
  'gallery',
  'video',
  'stats',
  'logo-cloud',
  'comparison',
  'steps',
  'team',
  'contact-form',
  'announcement',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS — constrained palette from Hisabche design system
// ═══════════════════════════════════════════════════════════════

/** Typography variants matching globals.css type scale */
export const TYPOGRAPHY_VARIANTS = [
  'display',
  'heading-1',
  'heading-2',
  'heading-3',
  'body-large',
  'body',
  'body-small',
  'caption',
  'label',
] as const

export type TypographyVariant = (typeof TYPOGRAPHY_VARIANTS)[number]

/** Background types */
export const BACKGROUND_TYPES = ['none', 'solid', 'gradient', 'image', 'video'] as const

export type BackgroundType = (typeof BACKGROUND_TYPES)[number]

/** Approved surface tokens (from globals.css) */
export const SURFACE_TOKENS = [
  'surface-base',
  'surface-muted',
  'surface-elevated',
  'surface-overlay',
] as const

/** Approved text tokens */
export const TEXT_TOKENS = ['fg-primary', 'fg-secondary', 'fg-tertiary'] as const

/** Approved accent tokens */
export const ACCENT_TOKENS = [
  'primary',
  'primary-light',
  'success',
  'warning',
  'destructive',
  'info',
] as const

/** Approved gradient tokens */
export const GRADIENT_TOKENS = [
  'gradient-brand',
  'gradient-brand-hover',
  'gradient-success',
] as const

/** All approved color tokens */
export const ALL_COLOR_TOKENS = [...SURFACE_TOKENS, ...TEXT_TOKENS, ...ACCENT_TOKENS] as const

/** Approved spacing tokens (from globals.css) */
export const SPACING_TOKENS = [
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-8',
  'space-10',
  'space-12',
  'space-16',
  'space-20',
  'space-24',
] as const

/** Approved radius tokens */
export const RADIUS_TOKENS = [
  'radius-xs',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-xl',
  'radius-2xl',
  'radius-full',
] as const

/** Approved shadow tokens */
export const SHADOW_TOKENS = [
  'elevation-0',
  'elevation-1',
  'elevation-2',
  'elevation-3',
  'elevation-4',
  'elevation-5',
  'elevation-6',
  'card-elevation-sm',
  'card-elevation-md',
  'card-elevation-lg',
] as const

/** Page themes — predefined by developers, not arbitrary */
export const PAGE_THEMES = [
  'default',
  'marketing',
  'product',
  'editorial',
  'campaign',
  'dark',
] as const

export type PageTheme = (typeof PAGE_THEMES)[number]

/** Page status */
export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const

export type PageStatus = (typeof PAGE_STATUSES)[number]

/** Locales */
export const CMS_LOCALES = ['fa', 'af', 'en'] as const

export type CmsLocale = (typeof CMS_LOCALES)[number]

/** Breakpoint model — matches Hisabche design system */
export const CMS_BREAKPOINTS = ['mobile', 'tablet', 'desktop'] as const

export type CmsBreakpoint = (typeof CMS_BREAKPOINTS)[number]

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS — validation for CMS content
// ═══════════════════════════════════════════════════════════════

const colorTokenSchema = z.enum([...ALL_COLOR_TOKENS] as [string, ...string[]])
const spacingTokenSchema = z.enum([...SPACING_TOKENS] as [string, ...string[]])
const radiusTokenSchema = z.enum([...RADIUS_TOKENS] as [string, ...string[]])
const shadowTokenSchema = z.enum([...SHADOW_TOKENS] as [string, ...string[]])
const gradientTokenSchema = z.enum([...GRADIENT_TOKENS] as [string, ...string[]])
const typographyVariantSchema = z.enum([...TYPOGRAPHY_VARIANTS] as [string, ...string[]])

/** Responsive visibility — show/hide per breakpoint */
export const responsiveVisibilitySchema = z.object({
  mobile: z.boolean().default(true),
  tablet: z.boolean().default(true),
  desktop: z.boolean().default(true),
})

export type ResponsiveVisibility = z.infer<typeof responsiveVisibilitySchema>

/** Responsive image — different images per viewport with fallback */
export const responsiveImageSchema = z.object({
  desktop: z.string().uuid().optional(),
  tablet: z.string().uuid().optional(),
  mobile: z.string().uuid().optional(),
  alt: z.string().default(''),
  objectFit: z.enum(['cover', 'contain', 'fill', 'none']).default('cover'),
  objectPosition: z.string().default('center center'),
  focalX: z.number().min(0).max(1).default(0.5),
  focalY: z.number().min(0).max(1).default(0.5),
  aspectRatio: z.string().optional(),
  maxWidth: z.string().optional(),
})

export type ResponsiveImage = z.infer<typeof responsiveImageSchema>

/** Background overlay */
const overlaySchema = z.object({
  enabled: z.boolean().default(false),
  token: colorTokenSchema.optional(),
  opacity: z.number().min(0).max(1).default(0.5),
  gradient: gradientTokenSchema.optional(),
})

/** Background configuration */
export const backgroundConfigSchema = z.object({
  type: z.enum([...BACKGROUND_TYPES] as [string, ...string[]]).default('none'),
  token: colorTokenSchema.optional(),
  gradient: gradientTokenSchema.optional(),
  image: responsiveImageSchema.optional(),
  video: z
    .object({
      src: z.string().url(),
      poster: z.string().uuid().optional(),
      autoplay: z.boolean().default(false),
      muted: z.boolean().default(true),
      loop: z.boolean().default(true),
      controls: z.boolean().default(false),
    })
    .optional(),
  overlay: overlaySchema.optional(),
})

export type BackgroundConfig = z.infer<typeof backgroundConfigSchema>

/** Per-breakpoint spacing */
const breakpointSpacingSchema = z.object({
  padding: spacingTokenSchema.optional(),
  margin: spacingTokenSchema.optional(),
  gap: spacingTokenSchema.optional(),
})

/** Responsive spacing */
export const responsiveSpacingSchema = z.object({
  desktop: breakpointSpacingSchema.optional(),
  tablet: breakpointSpacingSchema.optional(),
  mobile: breakpointSpacingSchema.optional(),
})

export type ResponsiveSpacing = z.infer<typeof responsiveSpacingSchema>

/** Per-breakpoint layout */
const breakpointLayoutSchema = z.object({
  columns: z.number().int().min(1).max(6).optional(),
  alignment: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  textAlign: z.enum(['start', 'center', 'end']).optional(),
  maxWidth: z.string().optional(),
  minHeight: z.string().optional(),
  contentOrder: z.enum(['default', 'reverse']).optional(),
})

/** Responsive layout */
export const responsiveLayoutSchema = z.object({
  desktop: breakpointLayoutSchema.optional(),
  tablet: breakpointLayoutSchema.optional(),
  mobile: breakpointLayoutSchema.optional(),
})

export type ResponsiveLayout = z.infer<typeof responsiveLayoutSchema>

/** Typography configuration */
export const typographyConfigSchema = z.object({
  variant: typographyVariantSchema.optional(),
  alignment: z.enum(['start', 'center', 'end']).optional(),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  maxWidth: z.string().optional(),
})

export type TypographyConfig = z.infer<typeof typographyConfigSchema>

/** Section-level design controls */
export const sectionDesignSchema = z.object({
  variant: z.string().optional(),
  background: backgroundConfigSchema.optional(),
  border: z
    .object({
      token: colorTokenSchema.optional(),
      width: z.enum(['0', '1', '2']).optional(),
    })
    .optional(),
  radius: radiusTokenSchema.optional(),
  shadow: shadowTokenSchema.optional(),
  maxWidth: z.enum(['sm', 'md', 'lg', 'xl', '2xl', 'full']).optional(),
  alignment: z.enum(['start', 'center', 'end']).optional(),
})

export type SectionDesign = z.infer<typeof sectionDesignSchema>

// ═══════════════════════════════════════════════════════════════
// CTA SCHEMA — reusable across blocks
// ═══════════════════════════════════════════════════════════════

export const ctaSchema = z.object({
  text: z.string().min(1).max(100),
  url: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).default('primary'),
  icon: z.string().optional(),
  newTab: z.boolean().default(false),
})

export type CtaConfig = z.infer<typeof ctaSchema>

// ═══════════════════════════════════════════════════════════════
// BLOCK CONTENT SCHEMAS — per block type
// ═══════════════════════════════════════════════════════════════

const heroContentSchema = z.object({
  eyebrow: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  primaryCta: ctaSchema.optional(),
  secondaryCta: ctaSchema.optional(),
  foregroundImage: responsiveImageSchema.optional(),
  alignment: z.enum(['start', 'center', 'end']).default('center'),
  variant: z.enum(['centered', 'split', 'fullscreen']).default('centered'),
})

const featureItemSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  image: responsiveImageSchema.optional(),
  link: z.string().optional(),
})

const featureGridContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  items: z.array(featureItemSchema).min(1).max(12),
  iconStyle: z.enum(['filled', 'outlined', 'none']).default('outlined'),
  cardVariant: z.enum(['flat', 'elevated', 'bordered']).default('flat'),
})

const featureListContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  items: z.array(featureItemSchema).min(1).max(20),
})

const ctaBlockContentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema.optional(),
  image: responsiveImageSchema.optional(),
  variant: z.enum(['simple', 'with-image', 'banner']).default('simple'),
})

const faqItemSchema = z.object({
  id: z.string(),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5000),
})

const faqContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  items: z.array(faqItemSchema).min(1).max(50),
})

const testimonialItemSchema = z.object({
  id: z.string(),
  quote: z.string().min(1).max(1000),
  author: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  avatar: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5).optional(),
})

const testimonialsContentSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(testimonialItemSchema).min(1).max(20),
  variant: z.enum(['cards', 'carousel', 'simple']).default('cards'),
})

const pricingTierSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.string().min(1),
  period: z.string().max(50).optional(),
  features: z.array(z.string()).default([]),
  cta: ctaSchema.optional(),
  highlighted: z.boolean().default(false),
  badge: z.string().max(50).optional(),
})

const pricingContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  tiers: z.array(pricingTierSchema).min(1).max(5),
})

const blogGridContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  count: z.number().int().min(1).max(12).default(3),
  category: z.string().optional(),
  locale: z.enum([...CMS_LOCALES] as [string, ...string[]]).optional(),
})

const contentBlockContentSchema = z.object({
  html: z.string().max(50000),
  typography: typographyConfigSchema.optional(),
})

const imageTextContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  image: responsiveImageSchema,
  imagePosition: z.enum(['start', 'end']).default('end'),
  cta: ctaSchema.optional(),
  variant: z.enum(['default', 'featured', 'minimal']).default('default'),
})

const galleryImageSchema = z.object({
  id: z.string(),
  image: z.string().uuid(),
  alt: z.string().default(''),
  caption: z.string().max(500).optional(),
})

const galleryContentSchema = z.object({
  title: z.string().max(200).optional(),
  images: z.array(galleryImageSchema).min(1).max(20),
  variant: z.enum(['grid', 'masonry', 'carousel']).default('grid'),
})

const videoContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  src: z.string().url(),
  poster: z.string().uuid().optional(),
  autoplay: z.boolean().default(false),
  muted: z.boolean().default(true),
  loop: z.boolean().default(false),
  controls: z.boolean().default(true),
  desktopOnly: z.boolean().default(false),
  mobilePoster: z.string().uuid().optional(),
})

const statItemSchema = z.object({
  id: z.string(),
  value: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
  prefix: z.string().max(20).optional(),
})

const statsContentSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(statItemSchema).min(1).max(8),
  variant: z.enum(['default', 'highlighted', 'inline']).default('default'),
})

const logoItemSchema = z.object({
  id: z.string(),
  image: z.string().uuid(),
  alt: z.string().default(''),
  url: z.string().optional(),
})

const logoCloudContentSchema = z.object({
  title: z.string().max(200).optional(),
  logos: z.array(logoItemSchema).min(1).max(20),
})

const comparisonContentSchema = z.object({
  title: z.string().max(200).optional(),
  columns: z.array(z.string()).min(2).max(5),
  rows: z.array(
    z.object({
      label: z.string(),
      values: z.array(z.union([z.string(), z.boolean()])),
    }),
  ),
})

const stepItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  image: responsiveImageSchema.optional(),
})

const stepsContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  items: z.array(stepItemSchema).min(2).max(10),
  variant: z.enum(['horizontal', 'vertical', 'alternating']).default('horizontal'),
})

const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().uuid().optional(),
  links: z.record(z.string()).optional(),
})

const teamContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  members: z.array(teamMemberSchema).min(1).max(20),
})

const contactFormContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  email: z.string().email().optional(),
  showPhone: z.boolean().default(false),
  showAddress: z.boolean().default(false),
})

const announcementContentSchema = z.object({
  text: z.string().min(1).max(500),
  link: z.string().optional(),
  linkText: z.string().max(100).optional(),
  dismissible: z.boolean().default(true),
  variant: z.enum(['info', 'success', 'warning', 'destructive']).default('info'),
})

/** Map block type → content schema */
export const BLOCK_CONTENT_SCHEMAS: Record<BlockType, z.ZodType> = {
  hero: heroContentSchema,
  'feature-grid': featureGridContentSchema,
  'feature-list': featureListContentSchema,
  cta: ctaBlockContentSchema,
  faq: faqContentSchema,
  testimonials: testimonialsContentSchema,
  pricing: pricingContentSchema,
  'blog-grid': blogGridContentSchema,
  content: contentBlockContentSchema,
  'image-text': imageTextContentSchema,
  gallery: galleryContentSchema,
  video: videoContentSchema,
  stats: statsContentSchema,
  'logo-cloud': logoCloudContentSchema,
  comparison: comparisonContentSchema,
  steps: stepsContentSchema,
  team: teamContentSchema,
  'contact-form': contactFormContentSchema,
  announcement: announcementContentSchema,
}

// ═══════════════════════════════════════════════════════════════
// SECTION SCHEMA
// ═══════════════════════════════════════════════════════════════

export const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([...BLOCK_TYPES] as [string, ...string[]]),
  content: z.record(z.unknown()),
  visibility: responsiveVisibilitySchema.default({ mobile: true, tablet: true, desktop: true }),
  design: sectionDesignSchema.optional(),
  spacing: responsiveSpacingSchema.optional(),
  typography: typographyConfigSchema.optional(),
  responsive: responsiveLayoutSchema.optional(),
  order: z.number().int().min(0),
})

export type SectionConfig = z.infer<typeof sectionSchema>

// ═══════════════════════════════════════════════════════════════
// PAGE SCHEMA
// ═══════════════════════════════════════════════════════════════

export const pageInputSchema = z.object({
  locale: z.enum([...CMS_LOCALES] as [string, ...string[]]),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/,
      'Slug must be lowercase alphanumeric with hyphens/slashes',
    ),
  title: z.string().min(1).max(300),
  theme: z.enum([...PAGE_THEMES] as [string, ...string[]]).default('default'),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  seoCanonical: z.string().url().optional(),
  seoOgImageId: z.string().uuid().optional(),
  seoNoindex: z.boolean().default(false),
  seoSchema: z.record(z.unknown()).optional(),
  sections: z.array(sectionSchema).default([]),
})

export type PageInput = z.infer<typeof pageInputSchema>

// ═══════════════════════════════════════════════════════════════
// DOMAIN FUNCTIONS — pure validation
// ═══════════════════════════════════════════════════════════════

export class CmsError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message?: string | undefined,
  ) {
    super(message ?? code)
    this.name = 'CmsError'
  }
}

/** Validate section content against its block type schema */
export function validateSectionContent(section: SectionConfig): string[] {
  const schema = BLOCK_CONTENT_SCHEMAS[section.type as BlockType]
  if (!schema) return [`Unknown block type: ${section.type}`]

  const result = schema.safeParse(section.content)
  if (!result.success) {
    return result.error.issues.map(
      (i) => `${section.type}[${section.id}]: ${i.path.join('.')}: ${i.message}`,
    )
  }
  return []
}

/** Validate all sections in a page */
export function validatePageSections(sections: SectionConfig[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const section of sections) {
    if (ids.has(section.id)) {
      errors.push(`Duplicate section ID: ${section.id}`)
    }
    ids.add(section.id)
    errors.push(...validateSectionContent(section))
  }

  return errors
}

/** Check heading hierarchy in content blocks */
export function validateHeadingHierarchy(sections: SectionConfig[]): string[] {
  const warnings: string[] = []
  let lastLevel = 0

  for (const section of sections) {
    const variant = section.typography?.variant
    if (!variant) continue

    const level = variant.startsWith('heading-')
      ? parseInt(variant.replace('heading-', ''), 10)
      : variant === 'display'
        ? 0
        : -1

    if (level > 0 && lastLevel > 0 && level > lastLevel + 1) {
      warnings.push(
        `Heading hierarchy skip: ${sections[sections.indexOf(section) - 1]?.type ?? 'start'} uses heading-${lastLevel}, then ${section.type} uses heading-${level}`,
      )
    }

    if (level >= 0) lastLevel = level
  }

  return warnings
}

/** Resolve responsive value with mobile-first fallback */
export function resolveResponsive<T>(
  config: { mobile?: T; tablet?: T; desktop?: T } | undefined,
  breakpoint: CmsBreakpoint,
): T | undefined {
  if (!config) return undefined

  switch (breakpoint) {
    case 'desktop':
      return config.desktop ?? config.tablet ?? config.mobile
    case 'tablet':
      return config.tablet ?? config.mobile
    case 'mobile':
      return config.mobile
  }
}

/** Sanitize slug for URL safety */
export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9/-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Reserved slugs that CMS pages cannot claim */
export const RESERVED_SLUGS = new Set([
  'login',
  'signup',
  'forgot-password',
  'reset-password',
  'accept-invite',
  'dashboard',
  'api',
  'admin',
  'oauth',
  'portal',
  'public-invoice',
  'public-task',
  'feedback',
  'preview',
  'blog',
  'docs',
  'market',
  'sitemap.xml',
  'robots.txt',
])

/** Check if a slug is available for CMS use */
export function isSlugReserved(slug: string): boolean {
  const first = slug.split('/')[0]!
  return RESERVED_SLUGS.has(first)
}
