// ============================================
// backend/src/utils/json-schema.ts
//
// A zod schema as the JSON Schema Fastify validates and serializes with — ONE copy.
// (13 Nov 2026: 30 route files each had their own `toJsonSchema(schema: any)`.)
//
// ⚠️ The parameter is `unknown` and the converter is called through a narrowed signature:
// typing it as `Parameters<typeof zodToJsonSchema>[0]` or `ZodTypeAny` makes tsc instantiate the
// converter's generics for every schema — TS2589, and on this repo an out-of-memory crash of
// `tsc --noEmit` itself (CLAUDE.md §8, «zodToJsonSchema … TS2589»).
// ============================================

import { zodToJsonSchema } from 'zod-to-json-schema'

const convert = zodToJsonSchema as unknown as (
  schema: unknown,
  options: { target: 'jsonSchema7' },
) => Record<string, unknown>

export function toJsonSchema(schema: unknown): Record<string, unknown> {
  const result = convert(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}
