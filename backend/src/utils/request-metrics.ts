// backend/src/utils/request-metrics.ts
//
// فاز ۰ — اندازه‌گیری. هدف این است که برای هر درخواست بدانیم:
//   - چند کوئری به دیتابیس زده شده
//   - مجموع زمان صرف‌شده در دیتابیس چقدر بوده
//   - کش hit شده یا miss
//
// بدون این اعداد نمی‌شود قضاوت کرد که گلوگاه «تعداد کوئری» است،
// «خودِ کوئری» یا «فاصله‌ی شبکه» — و در نتیجه نمی‌شود فهمید فازهای بعدی
// (Repository / Pool) اصلاً ارزش وقت گذاشتن دارند یا نه.

import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestMetrics {
  queryCount: number
  dbTimeMs: number
  cacheHits: number
  cacheMisses: number
}

const storage = new AsyncLocalStorage<RequestMetrics>()

export function runWithMetrics<T>(fn: () => T): T {
  return storage.run({ queryCount: 0, dbTimeMs: 0, cacheHits: 0, cacheMisses: 0 }, fn)
}

/**
 * برای Fastify: هوک‌ها ادامه‌ی چرخه‌ی درخواست را در بر نمی‌گیرند، پس
 * storage.run() اینجا جواب نمی‌دهد. enterWith از همین نقطه به بعد در همان
 * زنجیره‌ی async، context را فعال می‌کند — یعنی از onRequest تا onResponse.
 */
export function enterMetricsContext(): void {
  storage.enterWith({ queryCount: 0, dbTimeMs: 0, cacheHits: 0, cacheMisses: 0 })
}

export function getMetrics(): RequestMetrics | undefined {
  return storage.getStore()
}

/** یک کوئری دیتابیس را ثبت می‌کند. اگر خارج از یک درخواست صدا زده شود بی‌اثر است. */
export function trackQuery(durationMs: number): void {
  const m = storage.getStore()
  if (!m) return
  m.queryCount += 1
  m.dbTimeMs += durationMs
}

export function trackCache(hit: boolean): void {
  const m = storage.getStore()
  if (!m) return
  if (hit) m.cacheHits += 1
  else m.cacheMisses += 1
}

/**
 * یک Promise کوئری را زمان‌سنجی می‌کند و نتیجه‌اش را دست‌نخورده برمی‌گرداند.
 * عمداً مقدار بازگشتی را تغییر نمی‌دهد تا بتوان بدون تغییر منطق، هر کوئری
 * موجود را با آن پوشاند:  await measured(supabase.from('x').select())
 */
export async function measured<T>(promise: PromiseLike<T>): Promise<T> {
  const started = Date.now()
  try {
    return await promise
  } finally {
    trackQuery(Date.now() - started)
  }
}
