"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Store, DollarSign, Users, Settings, Eye, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Business {
  id: string
  name: string
  owner: string
  email: string
  plan: "básico" | "premium" | "enterprise"
  status: "activo" | "inactivo" | "suspendido"
  created_at: string
  monthly_revenue: number
  total_orders: number
  locations: number
}

interface Plan {
  id: string
  name: string
  price: number
  features: string[]
  max_locations: number
  commission_rate: number
}

export default function SuperAdminDashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateBusiness, setShowCreateBusiness] = useState(false)
  const [showEditPlan, setShowEditPlan] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  // Estados para crear negocio
  const [newBusiness, setNewBusiness] = useState({
    name: "",
    owner: "",
    email: "",
    plan: "básico" as const
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // En producción, estas llamadas irían al backend
      // Por ahora, uso datos de ejemplo
      setBusinesses([
        {
          id: "1",
          name: "Café Central",
          owner: "Juan Pérez",
          email: "juan@cafecentral.com",
          plan: "premium",
          status: "activo",
          created_at: "2024-01-15",
          monthly_revenue: 15000,
          total_orders: 450,
          locations: 2
        },
        {
          id: "2",
          name: "Pizzería Roma",
          owner: "María García",
          email: "maria@pizzeriaroma.com",
          plan: "básico",
          status: "activo",
          created_at: "2024-02-10",
          monthly_revenue: 8500,
          total_orders: 280,
          locations: 1
        },
        {
          id: "3",
          name: "Resto El Jardín",
          owner: "Carlos López",
          email: "carlos@eljardin.com",
          plan: "enterprise",
          status: "suspendido",
          created_at: "2023-11-20",
          monthly_revenue: 25000,
          total_orders: 720,
          locations: 5
        }
      ])

      setPlans([
        {
          id: "1",
          name: "básico",
          price: 29.99,
          features: ["Hasta 50 pedidos/mes", "1 sucursal", "Soporte básico"],
          max_locations: 1,
          commission_rate: 5
        },
        {
          id: "2",
          name: "premium",
          price: 79.99,
          features: ["Hasta 200 pedidos/mes", "3 sucursales", "Soporte prioritario", "Analytics básicos"],
          max_locations: 3,
          commission_rate: 3
        },
        {
          id: "3",
          name: "enterprise",
          price: 199.99,
          features: ["Pedidos ilimitados", "Sucursales ilimitadas", "Soporte 24/7", "Analytics avanzados", "API personalizada"],
          max_locations: -1,
          commission_rate: 2
        }
      ])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBusiness = async () => {
    try {
      // En producción, esto haría una llamada al backend
      const business: Business = {
        id: Date.now().toString(),
        ...newBusiness,
        status: "activo",
        created_at: new Date().toISOString().split('T')[0],
        monthly_revenue: 0,
        total_orders: 0,
        locations: 1
      }
      
      setBusinesses([...businesses, business])
      setNewBusiness({ name: "", owner: "", email: "", plan: "básico" })
      setShowCreateBusiness(false)
    } catch (error) {
      console.error("Error creating business:", error)
    }
  }

  const handleToggleBusinessStatus = async (businessId: string) => {
    try {
      setBusinesses(businesses.map(business => 
        business.id === businessId 
          ? { ...business, status: business.status === "activo" ? "inactivo" : "activo" }
          : business
      ))
    } catch (error) {
      console.error("Error toggling business status:", error)
    }
  }

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return
    
    try {
      setPlans(plans.map(plan => 
        plan.id === selectedPlan.id ? selectedPlan : plan
      ))
      setShowEditPlan(false)
      setSelectedPlan(null)
    } catch (error) {
      console.error("Error updating plan:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "activo": return "bg-green-100 text-green-800 border-green-200"
      case "inactivo": return "bg-gray-100 text-gray-800 border-gray-200"
      case "suspendido": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "básico": return "bg-blue-100 text-blue-800 border-blue-200"
      case "premium": return "bg-purple-100 text-purple-800 border-purple-200"
      case "enterprise": return "bg-orange-100 text-orange-800 border-orange-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const totalRevenue = businesses.reduce((sum, business) => sum + business.monthly_revenue, 0)
  const activeBusinesses = businesses.filter(b => b.status === "activo").length
  const totalOrders = businesses.reduce((sum, business) => sum + business.total_orders, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">⚡</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
                <p className="text-gray-600 text-sm">Panel de administración global</p>
              </div>
            </div>
            <Button
              onClick={fetchData}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-purple-600">{businesses.length}</p>
                  <p className="text-xs text-gray-600">Total Negocios</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{activeBusinesses}</p>
                  <p className="text-xs text-gray-600">Negocios Activos</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">${totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">Ingresos Mensuales</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                  <p className="text-xs text-gray-600">Total Pedidos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido con Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="negocios" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white border border-gray-200">
            <TabsTrigger value="negocios" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Store className="w-4 h-4" />
              Negocios ({businesses.length})
            </TabsTrigger>
            <TabsTrigger value="planes" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Settings className="w-4 h-4" />
              Planes ({plans.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="negocios">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Gestión de Negocios</h2>
              <Dialog open={showCreateBusiness} onOpenChange={setShowCreateBusiness}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Negocio
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Negocio</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nombre del Negocio</Label>
                      <Input
                        id="name"
                        value={newBusiness.name}
                        onChange={(e) => setNewBusiness({...newBusiness, name: e.target.value})}
                        placeholder="Ej: Café Central"
                      />
                    </div>
                    <div>
                      <Label htmlFor="owner">Propietario</Label>
                      <Input
                        id="owner"
                        value={newBusiness.owner}
                        onChange={(e) => setNewBusiness({...newBusiness, owner: e.target.value})}
                        placeholder="Ej: Juan Pérez"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newBusiness.email}
                        onChange={(e) => setNewBusiness({...newBusiness, email: e.target.value})}
                        placeholder="Ej: juan@cafecentral.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan">Plan</Label>
                      <Select value={newBusiness.plan} onValueChange={(value: any) => setNewBusiness({...newBusiness, plan: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.name}>
                              {plan.name} - ${plan.price}/mes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateBusiness} className="w-full">
                      Crear Negocio
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
                <p className="text-gray-600">Cargando negocios...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {businesses.map((business) => (
                  <Card key={business.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{business.name}</h3>
                            <Badge className={`${getStatusColor(business.status)} border`}>
                              {business.status}
                            </Badge>
                            <Badge className={`${getPlanColor(business.plan)} border`}>
                              {business.plan}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Propietario:</span> {business.owner}
                            </div>
                            <div>
                              <span className="font-medium">Email:</span> {business.email}
                            </div>
                            <div>
                              <span className="font-medium">Ingresos:</span> ${business.monthly_revenue.toLocaleString()}/mes
                            </div>
                            <div>
                              <span className="font-medium">Pedidos:</span> {business.total_orders}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleBusinessStatus(business.id)}
                          >
                            {business.status === "activo" ? (
                              <ToggleRight className="w-4 h-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-600" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="planes">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Gestión de Planes</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card key={plan.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
                      <Badge className={`${getPlanColor(plan.name)} border`}>
                        ${plan.price}/mes
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Comisión:</span> {plan.commission_rate}%
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Sucursales:</span> {plan.max_locations === -1 ? "Ilimitadas" : plan.max_locations}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Características:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {plan.features.map((feature, index) => (
                            <li key={index}>• {feature}</li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelectedPlan(plan)
                          setShowEditPlan(true)
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar Plan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Editar Plan */}
      <Dialog open={showEditPlan} onOpenChange={setShowEditPlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plan: {selectedPlan?.name}</DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="price">Precio Mensual ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={selectedPlan.price}
                  onChange={(e) => setSelectedPlan({...selectedPlan, price: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="commission">Tasa de Comisión (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  value={selectedPlan.commission_rate}
                  onChange={(e) => setSelectedPlan({...selectedPlan, commission_rate: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="locations">Máximo de Sucursales</Label>
                <Input
                  id="locations"
                  type="number"
                  value={selectedPlan.max_locations === -1 ? "" : selectedPlan.max_locations}
                  onChange={(e) => setSelectedPlan({...selectedPlan, max_locations: e.target.value === "" ? -1 : parseInt(e.target.value)})}
                  placeholder="Dejar vacío para ilimitadas"
                />
              </div>
              <Button onClick={handleUpdatePlan} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 