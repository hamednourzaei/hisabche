// embedded-postgres (dev-only, concurrency tests) publishes its typings only
// through package `exports`, which this project's `moduleResolution: node`
// does not read. The runtime import stays `embedded-postgres`; this points the
// type checker at the same package's own declaration file.
declare module 'embedded-postgres' {
  import EmbeddedPostgres from 'embedded-postgres/dist/index'
  export default EmbeddedPostgres
}
