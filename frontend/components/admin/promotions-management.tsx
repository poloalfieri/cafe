"use client"

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

export default function PromotionsManagement() {
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
    active: true
  })

  const promotionTypes = [
    { value: "discount", label: "Descuento Porcentual", icon: Percent },
    { value: "2x1", label: "2x1", icon: Tag },
    { value: "combo", label: "Combo", icon: TrendingUp },
    { value: "timeframe", label: "Descuento por Horario", icon: Clock }
  ]

  useEffect(() => {
    fetchPromotions()
  }, [])

  const fetchPromotions = async () => {
    setLoading(true)
    try {
      // Simular datos de promociones - en producción esto vendría de tu API
      const mockPromotions: Promotion[] = [
        {
          id: "1",
          name: "Happy Hour",
          type: "timeframe",
          value: 20,
          description: "20% de descuento en bebidas de 18:00 a 20:00",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          startTime: "18:00",
          endTime: "20:00",
          active: true
        },
        {
          id: "2",
          name: "2x1 en Cafés",
          type: "2x1",
          value: 0,
          description: "Lleva 2 cafés por el precio de 1",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          active: true
        },
        {
          id: "3",
          name: "Descuento Estudiantes",
          type: "discount",
          value: 15,
          description: "15% de descuento para estudiantes",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          active: false
        }
      ]
      setPromotions(mockPromotions)
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

    if (editingPromotion) {
      // Actualizar promoción existente
      setPromotions(promotions.map(p => p.id === editingPromotion.id ? promotionData : p))
    } else {
      // Crear nueva promoción
      setPromotions([...promotions, promotionData])
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
      active: promotion.active
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (promotionId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta promoción?")) {
      setPromotions(promotions.filter(p => p.id !== promotionId))
    }
  }

  const toggleActive = (promotionId: string) => {
    setPromotions(promotions.map(p => 
      p.id === promotionId ? { ...p, active: !p.active } : p
    ))
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
      active: true
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Promociones</h2>
          <p className="text-gray-600">Administra las promociones y ofertas del local</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="bg-gray-900 hover:bg-gray-800 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Promoción
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                {editingPromotion ? "Editar Promoción" : "Crear Nueva Promoción"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Promoción</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Happy Hour"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Promoción</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
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
                    {formData.type === "discount" || formData.type === "timeframe" ? "Porcentaje de Descuento" :
                     formData.type === "combo" ? "Precio del Combo" : "Valor"}
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder={formData.type === "discount" || formData.type === "timeframe" ? "20" : "0.00"}
                    required
                    className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active" className="text-gray-700 font-medium">Estado</Label>
                  <Select value={formData.active.toString()} onValueChange={(value) => setFormData({ ...formData, active: value === "true" })}>
                    <SelectTrigger className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">🟢 Activa</SelectItem>
                      <SelectItem value="false">⚪ Inactiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700 font-medium">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción detallada de la promoción"
                  required
                  className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-gray-700 font-medium">Fecha de Inicio</Label>
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
                  <Label htmlFor="endDate" className="text-gray-700 font-medium">Fecha de Fin</Label>
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
                    <Label htmlFor="startTime" className="text-gray-700 font-medium">Hora de Inicio</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-gray-700 font-medium">Hora de Fin</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
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
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white font-medium"
                >
                  {editingPromotion ? "Actualizar" : "Crear"}
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
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    promotion.active 
                      ? "bg-green-100 border-2 border-green-200" 
                      : "bg-gray-100 border-2 border-gray-200"
                  }`}>
                    <TypeIcon className={`w-6 h-6 ${
                      promotion.active ? "text-green-600" : "text-gray-600"
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg text-gray-900 truncate">{promotion.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        promotion.active 
                          ? "bg-green-100 text-green-700 border border-green-200" 
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}>
                        {promotion.active ? "🟢 Activa" : "⚪ Inactiva"}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-3 leading-relaxed">{promotion.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Período</p>
                          <p className="text-gray-600 text-xs">{promotion.startDate} - {promotion.endDate}</p>
                        </div>
                      </div>
                      
                      {promotion.startTime && promotion.endTime && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Horario</p>
                            <p className="text-gray-600 text-xs">{promotion.startTime} - {promotion.endTime}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Tag className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Valor</p>
                          <p className="text-gray-900 font-bold text-sm">{formatPromotionValue(promotion)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(promotion.id)}
                    className={`font-medium transition-all duration-200 ${
                      promotion.active 
                        ? "border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-800 bg-orange-50/50" 
                        : "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 hover:text-green-800 bg-green-50/50"
                    }`}
                  >
                    {promotion.active ? "Desactivar" : "Activar"}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay promociones</h3>
            <p className="text-gray-600 mb-4">Crea tu primera promoción para aumentar las ventas</p>
            <Button 
              onClick={() => setIsDialogOpen(true)} 
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Promoción
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 