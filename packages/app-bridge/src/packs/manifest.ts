// ============================================
// packages/app-bridge/src/packs/manifest.ts
//
// V62 Slice 8 — Signed pack manifest contract (pure, runtime-agnostic).
// ============================================

import { z } from 'zod'

export const packFileEntrySchema = z.object({
  path: z
    .string()
    .min(1)
    .refine(
      (p) => !p.startsWith('/') && !p.includes('..') && !p.includes('\\'),
      'Pack file path must be a safe relative POSIX path',
    ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'sha256 must be 64 hex chars'),
  sizeBytes: z.number().int().nonnegative(),
})

export type PackFileEntry = z.infer<typeof packFileEntrySchema>

export const packManifestEntrySchema = z.object({
  id: z.string().min(1),
  files: z.array(packFileEntrySchema),
  dependsOn: z.array(z.string().min(1)).default([]),
  withdrawn: z.boolean().default(false),
})

export type PackManifestEntry = z.infer<typeof packManifestEntrySchema>

export const packManifestSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  coreBuildId: z.string().min(1),
  generatedAt: z.string().min(1),
  packs: z.record(z.string(), packManifestEntrySchema),
})

export type PackManifest = z.infer<typeof packManifestSchema>

export function parsePackManifest(raw: unknown): PackManifest {
  return packManifestSchema.parse(raw)
}
