"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Search, Check } from "lucide-react"

export interface MenuItem {
  id: string
  name: string
  category: string
  price: number
}

type SelectionMode = "all" | "products" | "category"

interface ProductSelectorProps {
  mode: SelectionMode
  selectedProducts: string[]
  selectedCategories: string[]
  products: MenuItem[]
  categories: string[]
  onModeChange: (mode: SelectionMode) => void
  onProductsChange: (products: string[]) => void
  onCategoriesChange: (categories: string[]) => void
}

export default function ProductSelector({
  mode,
  selectedProducts,
  selectedCategories,
  products,
  categories,
  onModeChange,
  onProductsChange,
  onCategoriesChange,
}: ProductSelectorProps) {
  const t = useTranslations("admin.promotions.productSelection")
  const [search, setSearch] = useState("")

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }, [products, search])

  const toggleProduct = (id: string) => {
    if (selectedProducts.includes(id)) {
      onProductsChange(selectedProducts.filter(p => p !== id))
    } else {
      onProductsChange([...selectedProducts, id])
    }
  }

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      onCategoriesChange(selectedCategories.filter(c => c !== cat))
    } else {
      onCategoriesChange([...selectedCategories, cat])
    }
  }

  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return counts
  }, [products])

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium text-gray-700">{t("title")}</span>

      {/* Mode selector */}
      <div className="flex gap-2">
        {(["all", "products", "category"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
              mode === m
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {m === "all" ? t("all") : m === "products" ? t("specific") : t("byCategory")}
          </button>
        ))}
      </div>

      {/* Product multi-select */}
      {mode === "products" && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Selected badges */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProducts.map(id => (
                <Badge key={id} variant="secondary" className="text-xs gap-1 pr-1">
                  {getProductName(id)}
                  <button type="button" onClick={() => toggleProduct(id)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Product list */}
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
            {filteredProducts.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">{t("noProducts")}</div>
            ) : (
              filteredProducts.map(p => {
                const isSelected = selectedProducts.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected ? "bg-gray-900 border-gray-900" : "border-gray-300"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-400 text-xs">{p.category}</span>
                    </div>
                    <span className="text-gray-500 text-xs">${p.price.toFixed(2)}</span>
                  </button>
                )
              })
            )}
          </div>
          <p className="text-xs text-gray-500">
            {t("selectedCount", { count: selectedProducts.length })}
          </p>
        </div>
      )}

      {/* Category selector */}
      {mode === "category" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {categories.map(cat => {
              const isSelected = selectedCategories.includes(cat)
              const count = productCountByCategory[cat] || 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-sm transition-all ${
                    isSelected
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span className="font-medium truncate">{cat}</span>
                  <span className={`text-xs ml-2 ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
          {selectedCategories.length > 0 && (
            <p className="text-xs text-gray-500">
              {t("selectedCount", {
                count: products.filter(p => selectedCategories.includes(p.category)).length,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
