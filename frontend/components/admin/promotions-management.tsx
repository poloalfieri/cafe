"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  Calendar,
  Clock,
  Percent,
  Tag
} from "lucide-react"
import { useTranslations } from "next-intl"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"

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
}

interface PromotionsManagementProps {
  branchId?: string
}

export default function PromotionsManagement({ branchId }: PromotionsManagementProps) {
  const t = useTranslations("admin.promotions")
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
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
    allDay: false
  })

  const promotionTypes = [
    { value: "discount", label: t("types.discount"), icon: Percent },
    { value: "2x1", label: t("types.twoForOne"), icon: Tag },
    { value: "combo", label: t("types.combo"), icon: TrendingUp },
    { value: "timeframe", label: t("types.timeframe"), icon: Clock }
  ]

  const backendUrl = getTenantApiBase()

  useEffect(() => {
    fetchPromotions()
  }, [branchId])

  const fetchPromotions = async () => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const query = branchId ? `?branch_id=${branchId}` : ""
      const response = await fetch(`${backendUrl}/promotions${query}`, {
        headers: {
          ...authHeader,
        },
      })
      if (!response.ok) {
        throw new Error("No se pudieron cargar promociones")
      }
      const data = await response.json()
      const list = Array.isArray(data?.promotions) ? data.promotions : []
      const normalized = list.map((p: any) => ({
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
        applicableProducts: p.applicable_products || []
      }))
      setPromotions(normalized)
    } catch (error) {
      console.error("Error fetching promotions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
      const promotionData: Promotion = {
        ...formData,
        value: parseFloat(formData.value),
        id: editingPromotion?.id || Date.now().toString(),
        type: formData.type as "discount" | "2x1" | "combo" | "timeframe"
      }

    try {
      const authHeader = await getClientAuthHeaderAsync()
      if (editingPromotion) {
        const response = await fetch(`${backendUrl}/promotions/${editingPromotion.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({
            name: promotionData.name,
            type: promotionData.type,
            value: promotionData.value,
            description: promotionData.description,
            start_date: promotionData.startDate,
            end_date: promotionData.endDate,
            start_time: promotionData.startTime,
            end_time: promotionData.endTime,
            active: promotionData.active,
            branch_id: branchId || null
          }),
        })
        if (!response.ok) {
          throw new Error("No se pudo actualizar promoción")
        }
      } else {
        const response = await fetch(`${backendUrl}/promotions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({
            name: promotionData.name,
            type: promotionData.type,
            value: promotionData.value,
            description: promotionData.description,
            start_date: promotionData.startDate,
            end_date: promotionData.endDate,
            start_time: promotionData.startTime,
            end_time: promotionData.endTime,
            active: promotionData.active,
            branch_id: branchId || null
          }),
        })
        if (!response.ok) {
          throw new Error("No se pudo crear promoción")
        }
      }
      await fetchPromotions()
    } catch (e) {
      console.error("Error saving promotion:", e)
    }

    resetForm()
    setIsDialogOpen(false)
  }

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)
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
      allDay: !promotion.startTime && !promotion.endTime
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
          headers: {
            ...authHeader,
          },
        })
        if (!response.ok) {
          throw new Error("No se pudo eliminar promoción")
        }
        setPromotions(promotions.filter(p => p.id !== promotionId))
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
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({ active: !current.active }),
        })
        if (!response.ok) {
          throw new Error("No se pudo actualizar promoción")
        }
        await fetchPromotions()
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
      allDay: false
    })
    setEditingPromotion(null)
  }

  const getPromotionTypeInfo = (type: string) => {
    return promotionTypes.find(t => t.value === type) || promotionTypes[0]
  }

  const formatPromotionValue = (promotion: Promotion) => {
    switch (promotion.type) {
      case "discount":
        return `${promotion.value}%`
      case "2x1":
        return "2x1"
      case "combo":
        return `$${promotion.value}`
      case "timeframe":
        return `${promotion.value}%`
      default:
        return promotion.value.toString()
    }
  }

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
          <DialogContent className="sm:max-w-[600px] bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                {editingPromotion ? t("dialog.editTitle") : t("dialog.newTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
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
                    required
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

              {(formData.type === "timeframe") && (
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
                  <div className="col-span-2 flex items-center gap-2 pt-1">
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

              <div className="flex justify-end space-x-3 pt-6">
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

      {/* Lista de promociones */}
      <div className="grid gap-6">
        {promotions.map((promotion) => {
          const typeInfo = getPromotionTypeInfo(promotion.type)
          const TypeIcon = typeInfo.icon
          
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
