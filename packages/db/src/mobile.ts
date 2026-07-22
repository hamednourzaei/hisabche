import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { hisabcheSchema } from './schema'
import Invoice from './models/Invoice.model'
import Product from './models/Product.model'
import Customer from './models/Customer.model'
import { syncDatabase } from './sync'

const adapter = new SQLiteAdapter({
  schema: hisabcheSchema,
  jsi: true,
  onSetUpError: (error: Error) => {
    console.error('Database setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Invoice, Product, Customer],
})

export async function performSync() {
  try {
    await syncDatabase(database)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export { Invoice, Product, Customer }