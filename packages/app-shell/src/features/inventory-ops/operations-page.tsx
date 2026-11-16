import { lazy } from 'react'

// The warehouse and customers hubs open this container lazily too. A static
// re-export here kept it out of its own chunk («dynamic import will not move
// module into another chunk»), so the route loads it the same lazy way.
const OperationsPage = lazy(() =>
  import('@hisabche/ui/components/ui/inventory-ops/containers/inventory-ops-container').then(
    (m) => ({ default: m.InventoryOpsContainer }),
  ),
)

export default OperationsPage
