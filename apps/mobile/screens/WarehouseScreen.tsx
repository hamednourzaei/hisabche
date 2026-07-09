import React, {
  memo,
  useCallback,
  useMemo,
  useState,
  useDeferredValue,
} from "react"

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native"

import { FlashList } from "@shopify/flash-list"
import { useTranslation } from "react-i18next"

import {
  useProducts,
  useCreateProduct,
  useDeleteProduct,
} from "@hisabche/api"

import { useThemeStore } from "@hisabche/store"

// -------------------- Theme --------------------

const tokens = {
  light: {
    background: "#ffffff",
    card: "#ffffff",
    cardBorder: "#e2e8f0",
    foreground: "#060d1f",
    mutedFg: "#64748b",
    primary: "#00b97a",
    border: "#e2e8f0",
    input: "#f1f5f9",
    success: "#16a34a",
    warning: "#f59e0b",
    destructive: "#dc2626",
    muted: "#f1f5f9",
    primaryFg: "#ffffff",
  },
  dark: {
    background: "#060d1f",
    card: "#0c1628",
    cardBorder: "#1e2d45",
    foreground: "#cbd5e1",
    mutedFg: "#94a3b8",
    primary: "#2dd4a0",
    border: "#1e2d45",
    input: "#1e2d45",
    success: "#4ade80",
    warning: "#fbbf24",
    destructive: "#f87171",
    muted: "#1e2d45",
    primaryFg: "#0b0f14",
  },
}

type ThemeTokens = typeof tokens.light

const fmt = (n: number) => n.toLocaleString("fa-AF")
const num = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// -------------------- Card --------------------

const ProductCard = memo(function ProductCard({
  p,
  tk,
  onPress,
  onDelete,
}: {
  p: any
  tk: ThemeTokens
  onPress: () => void
  onDelete: () => void
}) {
  const qty = num(p.quantity)
  const min = num(p.min_stock_level ?? p.minStockLevel ?? 5)

  const statusColor =
    qty === 0
      ? tk.destructive
      : qty <= min
      ? tk.warning
      : tk.success

  const sellPrice = num(p.sell_price ?? p.sellPrice)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        s.card,
        { backgroundColor: tk.card, borderColor: tk.cardBorder },
      ]}
    >
      <View style={s.cardRow}>
        <View style={[s.productIcon, { backgroundColor: tk.muted }]}>
          <Text style={s.productEmoji}>📦</Text>
        </View>

        <View style={s.flex1}>
          <Text style={[s.productName, { color: tk.foreground }]}>
            {p.name}
          </Text>

          <Text style={[s.productMeta, { color: tk.mutedFg }]}>
            {p.category || "عمومی"} · {p.unit || "عدد"} · خرید:{" "}
            {fmt(num(p.buy_price ?? p.buyPrice))} AFN
          </Text>
        </View>

        <View style={s.productRight}>
          <Text style={[s.productPrice, { color: tk.foreground }]}>
            {fmt(sellPrice)} AFN
          </Text>

          <View
            style={[
              s.stockBadge,
              {
                backgroundColor: statusColor + "20",
                borderColor: statusColor,
              },
            ]}
          >
            <View style={[s.stockDot, { backgroundColor: statusColor }]} />
            <Text style={[s.stockText, { color: statusColor }]}>
              موجودی: {qty}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onDelete}>
          <Text style={[s.deleteIcon, { color: tk.destructive }]}>
            🗑️
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

// -------------------- Screen --------------------

export default function WarehouseScreen() {
  const { t } = useTranslation()
  const { isDark } = useThemeStore()

  const tk = useMemo(
    () => (isDark ? tokens.dark : tokens.light),
    [isDark]
  )

  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)

  const { data, isLoading } = useProducts({
    page: 1,
    limit: 50,
    sortDirection: "desc",
    search: deferredSearch,
  })

  const createProduct = useCreateProduct()
  const deleteProduct = useDeleteProduct()

  const [showAddModal, setShowAddModal] = useState(false)

  const [newName, setNewName] = useState("")
  const [newQty, setNewQty] = useState("0")
  const [newBuyPrice, setNewBuyPrice] = useState("")
  const [newSellPrice, setNewSellPrice] = useState("")

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return

    await createProduct.mutateAsync({
      name: newName.trim(),
      quantity: parseInt(newQty) || 0,
      buyPrice: parseFloat(newBuyPrice) || 0,
      sellPrice: parseFloat(newSellPrice) || 0,
      unit: "piece",
      minStockLevel: 5,
      category: "general",
      isActive: true,
    })

    setNewName("")
    setNewQty("0")
    setNewBuyPrice("")
    setNewSellPrice("")
    setShowAddModal(false)
  }, [newName, newQty, newBuyPrice, newSellPrice, createProduct])

  const handleDelete = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        t("action.delete"),
        `«${name}» حذف شود؟`,
        [
          { text: t("action.cancel"), style: "cancel" },
          {
            text: t("action.delete"),
            style: "destructive",
            onPress: () => deleteProduct.mutate(id),
          },
        ]
      )
    },
    [t, deleteProduct]
  )

  const totalValue = useMemo(() => {
    return (data?.products || []).reduce(
      (sum: number, p: any) =>
        sum + num(p.quantity) * num(p.sell_price ?? p.sellPrice),
      0
    )
  }, [data])

  // -------------------- UI --------------------

  return (
    <View style={s.fill}>
      <View style={[s.searchBox, { backgroundColor: tk.input }]}>
        <TextInput
          style={[s.searchInput, { color: tk.foreground }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t("action.search")}
          placeholderTextColor={tk.mutedFg}
        />
      </View>

      <TouchableOpacity
        style={[s.addBtn, { backgroundColor: tk.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={[s.addBtnText, { color: tk.primaryFg }]}>
          + محصول جدید
        </Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={{ padding: 20 }} />
      ) : (
        <FlashList
          data={(data?.products || []) as any[]}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <ProductCard
              p={item}
              tk={tk}
              onPress={() => {}}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          
          contentContainerStyle={s.list}
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: tk.card }]}>
            <Text style={{ color: tk.foreground, fontSize: 18 }}>
              محصول جدید
            </Text>

            <TextInput
              style={[s.modalInput, { backgroundColor: tk.input, color: tk.foreground }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="نام محصول"
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text>انصراف</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: tk.primary }]}
                onPress={handleAdd}
              >
                <Text style={{ color: tk.primaryFg }}>ذخیره</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// -------------------- STYLES (FIXED) --------------------

const s = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },

  searchBox: {
    margin: 12,
    padding: 10,
    borderRadius: 10,
  },

  searchInput: {
    fontSize: 14,
  },

  addBtn: {
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  addBtnText: {
    fontWeight: "600",
  },

  list: {
    padding: 12,
  },

  card: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  productEmoji: { fontSize: 18 },

  productName: { fontWeight: "600" },

  productMeta: { fontSize: 12 },

  productRight: {
    alignItems: "flex-end",
    marginLeft: "auto",
  },

  productPrice: { fontWeight: "700" },

  stockBadge: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },

  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },

  stockText: { fontSize: 10 },

  deleteIcon: { fontSize: 16, marginLeft: 8 },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  modalContent: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },

  modalInput: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },

  modalBtns: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },

  modalBtn: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderRadius: 10,
  },
})