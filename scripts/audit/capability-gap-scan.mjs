// scripts/audit/capability-gap-scan.mjs — READ-ONLY. For each of the 50 known gaps, which files of the current repository mention it.
// Run from the repository root: node scripts/audit/capability-gap-scan.mjs   (keywords are heuristics: a hit is a lead, never proof)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd().split(String.fromCharCode(92)).join('/')
const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  '.turbo',
  'graphify-out',
  'coverage',
  '.claude',
  '.ai',
  'android',
  'ios',
  'out',
  '.expo',
  'hisabche-promo-reel',
  '.p',
])
const EXT = /\.(ts|tsx|sql|mjs)$/
const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p)
    else if (EXT.test(name) && st.size < 2_000_000) files.push(p)
  }
}
for (const top of ['backend/src', 'packages', 'apps', 'docs']) walk(join(ROOT, top))

const kind = (rel) =>
  /\.pg\.test\.|__tests__|\.test\.|\.spec\./.test(rel)
    ? 'test'
    : rel.endsWith('.sql')
      ? 'sql'
      : /^docs\//.test(rel)
        ? 'doc'
        : 'src'

const GAPS = {
  1: [
    'product_variants',
    'productVariant',
    'ProductVariant',
    'variant_attributes',
    'variantMatrix',
  ],
  2: ['variant.?matrix', 'generateVariants', 'variantCombinations'],
  3: ['serial.*(sale|invoice)', 'stock_serials', 'consumeSerial', 'serialSold'],
  4: ['warrant(y|ies)', 'warranty_policies'],
  5: ['warranty_claims', 'repair_orders', 'repair_history', 'warrantyClaim'],
  6: ['vehicle_attributes', 'vin\\b', 'vehicle_units', 'chassis'],
  7: ['recondition'],
  8: ['stock_aging', 'unit_aging', 'agingBucket', 'daysInStock'],
  9: ['cross_reference', 'oem', 'aftermarket'],
  10: ['fitment', 'vehicle_fitments'],
  11: ['core_charge', 'refundable_deposit', 'coreCharge'],
  12: ['area_pric', 'areaPricing', 'price.*per.*(sqm|m2|area)'],
  13: ['roll_', 'rollTracking', 'variable_length', 'remaining_length'],
  14: ['partial.?roll', 'cutLength', 'cut_length'],
  15: ['batch.*uom|uom.*batch', 'per_batch_conversion', 'batchConversion'],
  16: ['dual.?uom', 'secondary_unit', 'catch.?weight', 'dualUnit'],
  17: ['pack_barcodes', 'product_barcodes', 'package.*barcode'],
  18: ['fefo', 'FEFO'],
  19: ['best_before', 'expiry_date', 'expires_on', 'expiry'],
  20: ['evaluateCreditLimit', 'credit_limit', 'creditLimit', 'OVER_CREDIT_LIMIT'],
  21: ['order_deposit', 'orderDeposit', 'pre.?invoice.*deposit', 'sales_order.*deposit'],
  22: ['delivery_schedul', 'deliverySchedule', 'delivery_slot'],
  23: ['installation', 'install_schedul'],
  24: ['crew', 'vehicle_capacity', 'deliveryCapacity'],
  25: ['proof_of_delivery', 'proofOfDelivery', 'pod_'],
  26: ['dispatch_board', 'dispatchBoard', 'dispatch'],
  27: ['driver_assign', 'delivery_assignment', 'driverId'],
  28: ['cod_', 'cash_on_delivery', 'codReconcil'],
  29: ['driver_settlement', 'trip_settlement', 'perTripSettlement'],
  30: ['waybill', 'trip_loads', 'transport_trips', 'loadManifest'],
  31: ['running_cost', 'fleet_cost', 'vehicle_expense', 'fuel_log'],
  32: ['seat', 'ticket(ing)?\\b', 'passenger_ticket'],
  33: ['route_leg', 'fare_leg', 'leg_fare', 'route_stops'],
  34: ['manifest', 'passenger_manifest'],
  35: ['appointment', 'reservation_slot'],
  36: ['service_schedul', 'staff_assignment', 'time_slot', 'resource_calendar'],
  37: ['time_and_material', 'time.?material', 'billable_hours', 'time_entries.*invoice'],
  38: ['make.?to.?order', 'work_order', 'workOrder', 'sales_order.*production'],
  39: ['wip\\b', 'WIP', 'work_in_progress'],
  40: ['manufactur.*(offline|local)', 'local-engine.*manufactur'],
  41: ['farm_plot', 'land_plot', 'agri_plot', 'plots?\\b.*field'],
  42: ['crop_cycle', 'cropCycle', 'planting_season'],
  43: ['field_activity', 'irrigation', 'fertiliz'],
  44: ['livestock', 'animal_tag', 'herd'],
  45: ['mortality', 'milk_yield', 'egg_production'],
  46: ['purity', 'karat', 'carat', 'fine_weight', 'fineWeight'],
  47: ['making_charge', 'makingCharge', 'wastage'],
  48: ['trade_in', 'tradeIn', 'old_gold', 'oldGold'],
  49: ['gem_stone', 'stone_valu', 'stone_weight', 'gemstone'],
  50: ['measurement', 'dimension_', 'unit_dimension', 'quantity_dimension', 'dimensional'],
}

const cache = []
for (const f of files) {
  let text = ''
  try {
    text = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  cache.push({
    rel: relative(ROOT, f).split(String.fromCharCode(92)).join('/'),
    lines: text.split(String.fromCharCode(10)),
  })
}
const out = {}
for (const [id, pats] of Object.entries(GAPS)) {
  const re = new RegExp(pats.join('|'), 'i')
  const hit = { src: [], sql: [], test: [], doc: [] }
  for (const { rel, lines } of cache) {
    const k = kind(rel)
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hit[k].push(rel + ':' + (i + 1))
        break
      }
    }
  }
  out[id] = {
    counts: Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, v.length])),
    src: hit.src.slice(0, 8),
    sql: hit.sql.slice(0, 5),
    test: hit.test.slice(0, 4),
  }
}

console.log('files scanned', files.length)
for (const [id, v] of Object.entries(out))
  console.log(id, JSON.stringify(v.counts), v.src[0] ?? '-', '|', v.sql[0] ?? '-')
