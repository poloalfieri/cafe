"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  Clock,
  Percent,
  Tag,
  ShoppingBag,
  CalendarDays,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import ProductSelector, { type MenuItem } from "./promotions/product-selector"
import ComboBuilder, { type ComboItem } from "./promotions/combo-builder"
import DaysOfWeekSelector from "./promotions/days-of-week-selector"

interface Promotion {
  id: string
  name: string
  type: "discount" | "2x1" | "combo" | "timeframe"
  value: number
  description: string
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string
  active: boolean
  applicableProducts?: string[]
  isManual?: boolean
  appliesToAll?: boolean
  comboItems?: { product_id: string; quantity: number }[]
  daysOfWeek?: number[]
}

interface PromotionsManagementProps {
  branchId?: string
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export default function PromotionsManagement({ branchId }: PromotionsManagementProps) {
  const t = useTranslations("admin.promotions")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    value: "",
    description: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    active: true,
    allDay: false,
    isManual: false,
    appliesToAll: false,
    productSelectionMode: "all" as "all" | "products" | "category",
    selectedProducts: [] as string[],
    selectedCategories: [] as string[],
    comboItems: [] as ComboItem[],
    daysOfWeek: [] as number[],
  })

  const promotionTypes = [
    { value: "discount", label: t("types.discount"), icon: Percent },
    { value: "2x1", label: t("types.twoForOne"), icon: Tag },
    { value: "combo", label: t("types.combo"), icon: TrendingUp },
    { value: "timeframe", label: t("types.timeframe"), icon: Clock }
  ]

  const backendUrl = getTenantApiBase()
  const queryClient = useQueryClient()

  // Fetch promotions
  const promotionsQuery = useQuery<Promotion[]>({
    queryKey: ["promotions", backendUrl, branchId || "all"],
    queryFn: async () => {
      const authHeader = await getClientAuthHeaderAsync()
      const query = branchId ? `?branch_id=${branchId}` : ""
      const response = await fetch(`${backendUrl}/promotions${query}`, { headers: authHeader })
      if (!response.ok) throw new Error("No se pudieron cargar promociones")
      const data = await response.json()
      const list = Array.isArray(data?.promotions) ? data.promotions : []
      return list.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        value: Number(p.value || 0),
        description: p.description || "",
        startDate: p.start_date,
        endDate: p.end_date,
        startTime: p.start_time || "",
        endTime: p.end_time || "",
        active: !!p.active,
        applicableProducts: p.applicable_products || [],
        isManual: !!p.is_manual,
        appliesToAll: !!p.applies_to_all,
        comboItems: p.combo_items || [],
        daysOfWeek: p.days_of_week || [],
      }))
    },
  })

  // Fetch menu products
  const menuQuery = useQuery<MenuItem[]>({
    queryKey: ["menu-products", backendUrl, branchId],
    queryFn: async () => {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(
        `${backendUrl}/menu${branchId ? `?branch_id=${branchId}` : ""}`,
        { headers: authHeader }
      )
      if (!response.ok) throw new Error("Error cargando productos")
      const data = await response.json()
      return (Array.isArray(data) ? data : []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        category: p.category || "",
        price: Number(p.price || 0),
      }))
    },
  })

  const products = menuQuery.data ?? []
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [products])

  const promotions = promotionsQuery.data ?? []

  const invalidatePromotions = () =>
    queryClient.invalidateQueries({ queryKey: ["promotions", backendUrl, branchId || "all"] })

  const resolveApplicableProducts = (): string[] | null => {
    if (formData.productSelectionMode === "all") return null
    if (formData.productSelectionMode === "products") {
      return formData.selectedProducts.length > 0 ? formData.selectedProducts : null
    }
    // category mode: resolve to product IDs
    if (formData.selectedCategories.length === 0) return null
    return products
      .filter(p => formData.selectedCategories.includes(p.category))
      .map(p => p.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const applicableProducts = formData.type === "combo" ? null : resolveApplicableProducts()
    const daysOfWeek = formData.daysOfWeek.length === 0 || formData.daysOfWeek.length === 7
      ? null
      : formData.daysOfWeek

    // 2x1 no usa value pero la DB lo requiere NOT NULL
    const value = formData.type === "2x1" ? 0 : parseFloat(formData.value)

    const payload: any = {
      name: formData.name,
      type: formData.type,
      value,
      description: formData.description,
      start_date: formData.startDate,
      end_date: formData.endDate,
      start_time: formData.startTime || null,
      end_time: formData.endTime || null,
      active: formData.active,
      branch_id: branchId || null,
      is_manual: formData.isManual,
      applies_to_all: formData.appliesToAll,
      applicable_products: applicableProducts,
      days_of_week: daysOfWeek,
    }

    if (formData.type === "combo") {
      payload.combo_items = formData.comboItems
        .filter(ci => ci.productId)
        .map(ci => ({ product_id: ci.productId, quantity: ci.quantity }))
    }

    try {
      const authHeader = await getClientAuthHeaderAsync()
      if (editingPromotion) {
        const response = await fetch(`${backendUrl}/promotions/${editingPromotion.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("No se pudo actualizar promoción")
      } else {
        const response = await fetch(`${backendUrl}/promotions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("No se pudo crear promoción")
      }
      await invalidatePromotions()
    } catch (e) {
      console.error("Error saving promotion:", e)
    }

    resetForm()
    setIsDialogOpen(false)
  }

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)

    // Derive productSelectionMode from data
    let mode: "all" | "products" | "category" = "all"
    let selectedCats: string[] = []
    const ap = promotion.applicableProducts || []
    if (ap.length > 0) {
      // Check if the products match one or more full categories
      const productCats = new Set(
        ap.map(id => products.find(p => p.id === id)?.category).filter(Boolean)
      )
      const allMatch = Array.from(productCats).every(cat => {
        const catProductIds = products.filter(p => p.category === cat).map(p => p.id)
        return catProductIds.every(id => ap.includes(id))
      })
      if (allMatch && productCats.size > 0) {
        mode = "category"
        selectedCats = Array.from(productCats) as string[]
      } else {
        mode = "products"
      }
    }

    setFormData({
      name: promotion.name,
      type: promotion.type,
      value: promotion.value.toString(),
      description: promotion.description,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      startTime: promotion.startTime || "",
      endTime: promotion.endTime || "",
      active: promotion.active,
      allDay: !promotion.startTime && !promotion.endTime,
      isManual: promotion.isManual ?? false,
      appliesToAll: promotion.appliesToAll ?? false,
      productSelectionMode: promotion.type === "combo" ? "all" : mode,
      selectedProducts: ap,
      selectedCategories: selectedCats,
      comboItems: (promotion.comboItems || []).map(ci => ({
        productId: String(ci.product_id),
        quantity: ci.quantity,
      })),
      daysOfWeek: promotion.daysOfWeek || [],
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (promotionId: string) => {
    if (!confirm(t("confirmDelete"))) return
    ;(async () => {
      try {
        const authHeader = await getClientAuthHeaderAsync()
        const response = await fetch(`${backendUrl}/promotions/${promotionId}`, {
          method: "DELETE",
          headers: authHeader,
        })
        if (!response.ok) throw new Error("No se pudo eliminar promoción")
        await invalidatePromotions()
      } catch (e) {
        console.error("Error deleting promotion:", e)
      }
    })()
  }

  const toggleActive = (promotionId: string) => {
    const current = promotions.find(p => p.id === promotionId)
    if (!current) return
    ;(async () => {
      try {
        const authHeader = await getClientAuthHeaderAsync()
        const response = await fetch(`${backendUrl}/promotions/${promotionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ active: !current.active }),
        })
        if (!response.ok) throw new Error("No se pudo actualizar promoción")
        await invalidatePromotions()
      } catch (e) {
        console.error("Error toggling promotion:", e)
      }
    })()
  }

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      value: "",
      description: "",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      active: true,
      allDay: false,
      isManual: false,
      appliesToAll: false,
      productSelectionMode: "all",
      selectedProducts: [],
      selectedCategories: [],
      comboItems: [],
      daysOfWeek: [],
    })
    setEditingPromotion(null)
  }

  const getPromotionTypeInfo = (type: string) => {
    return promotionTypes.find(t => t.value === type) || promotionTypes[0]
  }

  const formatPromotionValue = (promotion: Promotion) => {
    switch (promotion.type) {
      case "discount":
      case "timeframe":
        return `${promotion.value}%`
      case "2x1":
        return "2x1"
      case "combo":
        return `$${promotion.value}`
      default:
        return promotion.value.toString()
    }
  }

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || `#${id}`

  const formatProductInfo = (promotion: Promotion) => {
    if (promotion.type === "combo") {
      const items = promotion.comboItems || []
      if (items.length === 0) return null
      return items.map(ci => `${ci.quantity}x ${getProductName(String(ci.product_id))}`).join(" + ")
    }
    const ap = promotion.applicableProducts || []
    if (ap.length === 0) return t("card.allProducts")
    if (ap.length <= 3) return ap.map(id => getProductName(id)).join(", ")
    return t("card.productsCount", { count: ap.length })
  }

  const formatDaysInfo = (promotion: Promotion) => {
    const days = promotion.daysOfWeek || []
    if (days.length === 0 || days.length === 7) return null
    return days.map(d => DAY_LABELS[d]).join(", ")
  }

  const showProductSelector = formData.type === "discount" || formData.type === "2x1" || formData.type === "timeframe"
  const showComboBuilder = formData.type === "combo"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t("header.title")}</h2>
          <p className="text-sm text-gray-600">{t("header.subtitle")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="bg-gray-900 hover:bg-gray-800 text-white self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" />
              {t("actions.new")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                {editingPromotion ? t("dialog.editTitle") : t("dialog.newTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Section 1: Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("form.name")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("form.namePlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{t("form.type")}</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value, comboItems: value === "combo" ? formData.comboItems : [], selectedProducts: [], selectedCategories: [], productSelectionMode: "all" })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("form.typePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {promotionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="w-4 h-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type && formData.type !== "2x1" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value" className="text-gray-700 font-medium">
                      {formData.type === "discount" || formData.type === "timeframe"
                        ? t("form.discountPercent")
                        : formData.type === "combo"
                          ? t("form.comboPrice")
                          : t("form.value")}
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder={formData.type === "discount" || formData.type === "timeframe" ? t("form.percentPlaceholder") : t("form.valuePlaceholder")}
                      required={formData.type !== "combo"}
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="active" className="text-gray-700 font-medium">{t("form.status")}</Label>
                    <Select value={formData.active.toString()} onValueChange={(value) => setFormData({ ...formData, active: value === "true" })}>
                      <SelectTrigger className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{t("status.active")}</SelectItem>
                        <SelectItem value="false">{t("status.inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {formData.type === "2x1" && (
                <div className="space-y-2">
                  <Label htmlFor="active" className="text-gray-700 font-medium">{t("form.status")}</Label>
                  <Select value={formData.active.toString()} onValueChange={(value) => setFormData({ ...formData, active: value === "true" })}>
                    <SelectTrigger className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900 w-1/2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{t("status.active")}</SelectItem>
                      <SelectItem value="false">{t("status.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700 font-medium">{t("form.description")}</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("form.descriptionPlaceholder")}
                  required
                  className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>

              {/* Section 2: Product Selection (discount, 2x1, timeframe) */}
              {showProductSelector && (
                <div className="border-t pt-4">
                  <ProductSelector
                    mode={formData.productSelectionMode}
                    selectedProducts={formData.selectedProducts}
                    selectedCategories={formData.selectedCategories}
                    products={products}
                    categories={categories}
                    onModeChange={(mode) => setFormData({ ...formData, productSelectionMode: mode, selectedProducts: [], selectedCategories: [] })}
                    onProductsChange={(p) => setFormData({ ...formData, selectedProducts: p })}
                    onCategoriesChange={(c) => setFormData({ ...formData, selectedCategories: c })}
                  />
                </div>
              )}

              {/* Section 3: Combo Builder */}
              {showComboBuilder && (
                <div className="border-t pt-4">
                  <ComboBuilder
                    items={formData.comboItems}
                    comboPrice={formData.value}
                    products={products}
                    onChange={(items) => setFormData({ ...formData, comboItems: items })}
                    onPriceChange={(price) => setFormData({ ...formData, value: price })}
                  />
                </div>
              )}

              {/* Section 4: Schedule */}
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-gray-700 font-medium">{t("form.startDate")}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-gray-700 font-medium">{t("form.endDate")}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
                  </div>
                </div>

                {/* Days of week */}
                <DaysOfWeekSelector
                  selectedDays={formData.daysOfWeek}
                  onChange={(days) => setFormData({ ...formData, daysOfWeek: days })}
                />

                {/* Time window (timeframe only) */}
                {formData.type === "timeframe" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startTime" className="text-gray-700 font-medium">{t("form.startTime")}</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={formData.allDay ? "" : formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                          disabled={formData.allDay}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime" className="text-gray-700 font-medium">{t("form.endTime")}</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={formData.allDay ? "" : formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                          disabled={formData.allDay}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="allDay"
                        type="checkbox"
                        checked={formData.allDay}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allDay: e.target.checked,
                            startTime: e.target.checked ? "" : formData.startTime,
                            endTime: e.target.checked ? "" : formData.endTime
                          })
                        }
                      />
                      <Label htmlFor="allDay" className="text-gray-700 font-medium">
                        {t("form.allDay")}
                      </Label>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Options */}
              <div className="border-t pt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isManual"
                    type="checkbox"
                    checked={formData.isManual}
                    onChange={(e) => setFormData({ ...formData, isManual: e.target.checked })}
                  />
                  <Label htmlFor="isManual" className="text-gray-700 font-medium">
                    {t("form.isManual")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="appliesToAll"
                    type="checkbox"
                    checked={formData.appliesToAll}
                    onChange={(e) => setFormData({ ...formData, appliesToAll: e.target.checked })}
                  />
                  <Label htmlFor="appliesToAll" className="text-gray-700 font-medium">
                    {t("form.appliesToAll")}
                  </Label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white font-medium"
                >
                  {editingPromotion ? t("actions.update") : t("actions.create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Promotion Cards */}
      <div className="grid gap-6">
        {promotions.map((promotion) => {
          const typeInfo = getPromotionTypeInfo(promotion.type)
          const TypeIcon = typeInfo.icon
          const productInfo = formatProductInfo(promotion)
          const daysInfo = formatDaysInfo(promotion)

          return (
            <div
              key={promotion.id}
              className={`bg-white rounded-xl border-2 p-6 shadow-sm hover:shadow-md transition-all duration-200 ${
                promotion.active
                  ? "border-green-200 bg-green-50/30"
                  : "border-gray-200 bg-gray-50/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 sm:gap-4 flex-1">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                    promotion.active
                      ? "bg-green-100 border-2 border-green-200"
                      : "bg-gray-100 border-2 border-gray-200"
                  }`}>
                    <TypeIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      promotion.active ? "text-green-600" : "text-gray-600"
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{promotion.name}</h3>
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        promotion.active
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}>
                        {promotion.active ? t("status.active") : t("status.inactive")}
                      </span>
                    </div>

                    <p className="text-gray-700 mb-3 leading-relaxed text-sm sm:text-base">{promotion.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{t("card.period")}</p>
                          <p className="text-gray-600 text-xs truncate">{promotion.startDate} - {promotion.endDate}</p>
                        </div>
                      </div>

                      {promotion.startTime && promotion.endTime && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{t("card.schedule")}</p>
                            <p className="text-gray-600 text-xs">{promotion.startTime} - {promotion.endTime}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Tag className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{t("card.value")}</p>
                          <p className="text-gray-900 font-bold text-sm">{formatPromotionValue(promotion)}</p>
                        </div>
                      </div>

                      {/* Products info */}
                      {productInfo && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">{t("card.products")}</p>
                            <p className="text-gray-600 text-xs truncate">{productInfo}</p>
                          </div>
                        </div>
                      )}

                      {/* Days info */}
                      {daysInfo && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{t("card.activeDays")}</p>
                            <div className="flex gap-1 mt-0.5">
                              {(promotion.daysOfWeek || []).map(d => (
                                <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {DAY_LABELS[d]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(promotion.id)}
                    className={`text-xs sm:text-sm font-medium transition-all duration-200 ${
                      promotion.active
                        ? "border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-800 bg-orange-50/50"
                        : "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 hover:text-green-800 bg-green-50/50"
                    }`}
                  >
                    {promotion.active ? t("actions.deactivate") : t("actions.activate")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(promotion)}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-800 bg-blue-50/50 font-medium transition-all duration-200"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(promotion.id)}
                    className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 hover:text-red-800 bg-red-50/50 font-medium transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

        {promotions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("empty.title")}</h3>
            <p className="text-gray-600 mb-4">{t("empty.subtitle")}</p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("actions.create")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
