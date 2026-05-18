import { create } from 'zustand'

export interface CartItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  totalPrice: number
}

interface CartState {
  items: CartItem[]
  customerId: string | null
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateDiscount: (productId: string, discount: number) => void
  setCustomer: (customerId: string) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId
              ? {
                  ...i,
                  quantity: i.quantity + item.quantity,
                  totalPrice: (i.quantity + item.quantity) * i.unitPrice * (1 - i.discount / 100),
                }
              : i
          ),
        }
      }
      return { items: [...state.items, item] }
    }),

  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, quantity, totalPrice: quantity * i.unitPrice * (1 - i.discount / 100) }
          : i
      ),
    })),

  updateDiscount: (productId, discount) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, discount, totalPrice: i.quantity * i.unitPrice * (1 - discount / 100) }
          : i
      ),
    })),

  setCustomer: (customerId) => set({ customerId }),

  clearCart: () => set({ items: [], customerId: null }),

  getTotal: () => get().items.reduce((sum, i) => sum + i.totalPrice, 0),

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))