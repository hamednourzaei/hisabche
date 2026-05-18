// ============================================
// Hisabche Validation — Barrel Exports
// ============================================

// ---------- Common ----------
export {
  uuidSchema,
  emailSchema,
  phoneSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  percentageSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  currencyCodeSchema,
  paymentMethodSchema,
  transactionTypeSchema,
  productCategorySchema,
  unitSchema,
  sortDirectionSchema,
  paginationSchema,
  addressSchema,
  type Pagination,
  type Address,
} from './schemas/common.schema'

// ---------- Auth ----------
export {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  pinCodeSchema,
  updateProfileSchema,
  type LoginInput,
  type SignUpInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type PinCodeInput,
  type UpdateProfileInput,
} from './schemas/auth.schema'

// ---------- Invoice ----------
export {
  invoiceItemSchema,
  invoiceSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceFiltersSchema,
  type InvoiceItem,
  type Invoice,
  type CreateInvoice,
  type UpdateInvoice,
  type InvoiceFilters,
} from './schemas/invoice.schema'

// ---------- Product ----------
export {
  productSchema,
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
  stockTransferSchema,
  type Product,
  type CreateProduct,
  type UpdateProduct,
  type ProductFilters,
  type StockTransfer,
} from './schemas/product.schema'

// ---------- Customer & Supplier ----------
export {
  customerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  supplierSchema,
  createSupplierSchema,
  updateSupplierSchema,
  customerFiltersSchema,
  type Customer,
  type CreateCustomer,
  type UpdateCustomer,
  type Supplier,
  type CreateSupplier,
  type UpdateSupplier,
  type CustomerFilters,
} from './schemas/customer.schema'
export {
  transactionSchema,
  createTransactionSchema,
  transactionFiltersSchema,
  ledgerSummarySchema,
  type Transaction,
  type CreateTransaction,
  type TransactionFilters,
  type LedgerSummary,
} from './schemas/transaction.schema'