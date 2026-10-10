// packages/ui/src/components/ui/landing/journey/journey-industries.ts
//
// The kinds of business named on the boards along the hall's walls.
//
// ⚠️ Only business types whose day-to-day work the product covers (stock,
// invoices, till, purchasing, production). Hotels, clinics, fuel stations and
// the like are in the messages file and are NOT here: nothing in the product
// handles bookings, patients or pumps, so naming them on a wall would say it
// does. This list used to be a row of chips lower on the landing; it lives on
// the walls of the hall now, and as plain text for a reader with no picture.
//
// The name of each comes from `landing.industry.<key>`. The icon is a single
// character, not a drawing: it costs no bytes and no DOM.

export const JOURNEY_INDUSTRIES = [
  { key: 'retail', icon: '🛍' },
  { key: 'wholesale', icon: '📦' },
  { key: 'supermarket', icon: '🛒' },
  { key: 'grocery', icon: '🥫' },
  { key: 'pharmacy', icon: '💊' },
  { key: 'restaurant', icon: '🍽' },
  { key: 'bakery', icon: '🥖' },
  { key: 'boutique', icon: '👗' },
  { key: 'fashion', icon: '👔' },
  { key: 'cosmetics', icon: '💄' },
  { key: 'electronics', icon: '🔌' },
  { key: 'mobile', icon: '📱' },
  { key: 'computer', icon: '💻' },
  { key: 'hardware', icon: '🔧' },
  { key: 'construction', icon: '🧱' },
  { key: 'furniture', icon: '🛋' },
  { key: 'home', icon: '🧺' },
  { key: 'stationery', icon: '✏' },
  { key: 'bookstore', icon: '📚' },
  { key: 'autoParts', icon: '⚙' },
  { key: 'service', icon: '🧰' },
  { key: 'distribution', icon: '🚚' },
  { key: 'warehouse', icon: '🏬' },
  { key: 'manufacturing', icon: '🏭' },
] as const

export interface IndustrySign {
  label: string
  icon: string
}
