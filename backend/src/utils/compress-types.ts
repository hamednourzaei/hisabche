/**
 * Content types @fastify/compress may compress: the library defaults plus
 * Hisabche Sync Binary. `text/event-stream` stays EXCLUDED — a compressed SSE
 * stream is buffered and stops being live (the /docs monitor, metrics stream).
 */
export const COMPRESSIBLE_TYPES =
  /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)xml(?:;|$)|^application\/x-hisabche-sync(?:;|$)/
