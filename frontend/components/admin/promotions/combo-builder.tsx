"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type { MenuItem } from "./product-selector"

export interface ComboItem {
  productId: string
  quantity: number
}

interface ComboBuilderProps {
  items: ComboItem[]
  comboPrice: string
  products: MenuItem[]
  onChange: (items: ComboItem[]) => void
  onPriceChange: (price: string) => void
}

export default function ComboBuilder({
  items,
  comboPrice,
  products,
  onChange,
  onPriceChange,
}: ComboBuilderProps) {
  const t = useTranslations("admin.promotions.comboBuilder")

  const addItem = () => {
    onChange([...items, { productId: "", quantity: 1 }])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, updates: Partial<ComboItem>) => {
    const newItems = items.map((item, i) => (i === index ? { ...item, ...updates } : item))
    onChange(newItems)
  }

  const getProduct = (id: string) => products.find(p => p.id === id)

  const normalPrice = items.reduce((sum, item) => {
    const product = getProduct(item.productId)
    return sum + (product ? product.price * item.quantity : 0)
  }, 0)

  const comboPriceNum = parseFloat(comboPrice) || 0
  const savings = Math.max(0, normalPrice - comboPriceNum)
  const savingsPercent = normalPrice > 0 ? Math.round((savings / normalPrice) * 100) : 0

  // Products already used in other combo rows
  const usedProductIds = items.map(i => i.productId).filter(Boolean)

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium text-gray-700">{t("title")}</span>

      {items.length === 0 ? (
        <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 mb-2">{t("noItems")}</p>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" />
            {t("addProduct")}
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_36px] gap-2 text-xs font-medium text-gray-500 px-1">
            <span>{t("product")}</span>
            <span>{t("quantity")}</span>
            <span>{t("unitPrice")}</span>
            <span>{t("subtotal")}</span>
            <span></span>
          </div>

          {/* Rows */}
          {items.map((item, index) => {
            const product = getProduct(item.productId)
            const subtotal = product ? product.price * item.quantity : 0
            return (
              <div key={index} className="grid grid-cols-[1fr_80px_80px_80px_36px] gap-2 items-center">
                <Select
                  value={item.productId}
                  onValueChange={(value) => updateItem(index, { productId: value })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t("selectProduct")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        disabled={usedProductIds.includes(p.id) && p.id !== item.productId}
                      >
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="h-9 text-sm text-center"
                />
                <span className="text-sm text-gray-500 text-center">
                  {product ? `$${product.price.toFixed(0)}` : "-"}
                </span>
                <span className="text-sm font-medium text-center">
                  {product ? `$${subtotal.toFixed(0)}` : "-"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )
          })}

          <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
            <Plus className="w-4 h-4 mr-1" />
            {t("addProduct")}
          </Button>

          {/* Summary */}
          {items.some(i => i.productId) && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 border">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t("normalPrice")}</span>
                <span className="text-gray-500 line-through">${normalPrice.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span className="text-gray-600 font-medium">{t("comboPrice")}</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={comboPrice}
                    onChange={(e) => onPriceChange(e.target.value)}
                    className="h-8 w-24 text-sm text-right font-bold"
                    placeholder="0"
                  />
                </div>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-sm pt-1 border-t">
                  <span className="text-green-700 font-semibold">{t("savings")}</span>
                  <span className="text-green-700 font-bold">
                    ${savings.toFixed(0)} ({savingsPercent}%)
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
