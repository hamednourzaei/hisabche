// Owner request (8 Nov 2026): ticking two rows must not make the header look
// «all selected». The header box is ticked only when every row is, and never
// drawn in the browser's indeterminate (filled, dashed) state.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toggleAll } from '@hisabche/ui-contract'

const table = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'data-table', 'data-table.tsx'),
  'utf8',
)
const code = table
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n')

describe('select-all checkbox', () => {
  it('is never drawn as indeterminate', () => {
    expect(code).not.toContain('.indeterminate')
    expect(code).toContain('checked={allSelected}')
  })

  it('a partial selection + header click selects the rest; a full one clears', () => {
    const partial = toggleAll(new Set(['a']), ['a', 'b', 'c'])
    expect([...partial].sort()).toEqual(['a', 'b', 'c'])
    expect(toggleAll(partial, ['a', 'b', 'c']).size).toBe(0)
  })
})
