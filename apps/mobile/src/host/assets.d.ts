// ============================================
// The shared UI ships as files, not as modules.
//
// Metro treats `.html` as an asset once `metro.config.js` lists it, and an
// asset import is a registry NUMBER, not a string path. Declaring it here is
// what lets the host reference the bundled shell without an `any` or an
// eslint-disable (راهنمای سشن §۱۰).
// ============================================

declare module '*.html' {
  const assetModuleId: number
  export default assetModuleId
}
