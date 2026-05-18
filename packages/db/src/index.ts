// Only type exports — safe for web, mobile, backend
import type InvoiceType from './models/Invoice.model'
import type ProductType from './models/Product.model'
import type CustomerType from './models/Customer.model'

export type Invoice = InvoiceType
export type Product = ProductType
export type Customer = CustomerType
export type { hisabcheSchema } from './schema/schema'