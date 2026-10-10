import { readFileSync } from 'node:fs'
const L = JSON.parse(readFileSync('packages/i18n/messages/fa/common.json', 'utf8')).landing
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
const k = (v) => (v && typeof v === 'object' ? `{${Object.keys(v).join(',')}}` : JSON.stringify(v))

for (const p of [
  'chapter.ledger.card1',
  'chapter.offline.card1',
  'chapter.money.card1',
  'chapter.inventory.card1',
  'system.step.sell',
  'compare.row.books',
  'pricing.plan.free',
  'transformStep.sale',
  'solution1Title',
  'factOffline',
  'ctaReassurance1',
  'landing.demoTab',
  'landing.comparisonRow',
  'landing.industry',
  'landing.footerLink',
  'landing.featurePage',
  'landing.legalPage',
  'landing.modules',
  'landing.transformStep',
]) {
  console.log(p.padEnd(26), k(get(L, p.replace(/^landing\./, ''))))
}
console.log('\n--- chapter.ledger.card1 + offline.card1 values ---')
console.log(JSON.stringify(get(L, 'chapter.ledger.card1'), null, 1, '	'))
console.log(JSON.stringify(get(L, 'chapter.offline.card1'), null, 1, '	'))
console.log('\n--- system.step.sell ---')
console.log(JSON.stringify(get(L, 'system.step.sell'), null, 1, '	'))
