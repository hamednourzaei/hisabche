// ============================================
// backend/src/services/migration/xlsx.domain.ts
//
// The workbook reader lives in @hisabche/validation (schemas/xlsx-reader.ts)
// so the device's local engine — Node on Windows, Hermes on Android — reads a
// workbook exactly as the server does (offline xlsx import, 21 Oct 2026).
// ============================================

export {
  XlsxError,
  readXlsx,
  rowsToCsv,
  serialToIso,
  type XlsxRejection,
  type XlsxSheet,
} from '@hisabche/validation'
