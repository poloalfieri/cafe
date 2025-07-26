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
          <h2 className="text-2xl font-bold text-text">Gestión de Promociones</h2>
          <p className="text-muted-foreground">Administra las promociones y ofertas del local</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Promoción
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
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
                  <Label htmlFor="value">
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active">Estado</Label>
                  <Select value={formData.active.toString()} onValueChange={(value) => setFormData({ ...formData, active: value === "true" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Activa</SelectItem>
                      <SelectItem value="false">Inactiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción detallada de la promoción"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha de Fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              {(formData.type === "timeframe") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Hora de Inicio</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Hora de Fin</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPromotion ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de promociones */}
      <div className="grid gap-4">
        {promotions.map((promotion) => {
          const typeInfo = getPromotionTypeInfo(promotion.type)
          const TypeIcon = typeInfo.icon
          
          return (
            <div
              key={promotion.id}
              className={`bg-card rounded-lg border border-border p-4 ${
                promotion.active ? "ring-1 ring-green-200" : "opacity-75"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    promotion.active ? "bg-green-100" : "bg-gray-100"
                  }`}>
                    <TypeIcon className={`w-5 h-5 ${
                      promotion.active ? "text-green-600" : "text-gray-600"
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-text">{promotion.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        promotion.active 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {promotion.active ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">{promotion.description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{promotion.startDate} - {promotion.endDate}</span>
                      </div>
                      {promotion.startTime && promotion.endTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{promotion.startTime} - {promotion.endTime}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span className="font-medium text-primary">{formatPromotionValue(promotion)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(promotion.id)}
                  >
                    {promotion.active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(promotion)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(promotion.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
        
        {promotions.length === 0 && (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No hay promociones registradas</p>
          </div>
        )}
      </div>
    </div>
  )
} 