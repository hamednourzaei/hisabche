// ============================================
// Hisabche API — Barrel Exports
// ============================================

export { apiClient, type ApiResponse, type ApiError } from './lib/client'

export { useLogin, useSignUp, useLogout, useCurrentUser } from './hooks/auth'

export {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  invoiceKeys,
} from './hooks/invoices'

export {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  productKeys,
} from './hooks/products'

export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  customerKeys,
} from './hooks/customers'
export { useTransactions, useCreateTransaction, useLedger, transactionKeys } from './hooks/transactions'