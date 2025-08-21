"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Users, CheckCircle, Clock, QrCode, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MesaQRGenerator } from "./mesa-qr-generator"

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Order {
  id: string
  mesa_id: string
  status: string
  total_amount: number
  created_at: string
  items: any[]
}

export default function CajeroDashboard() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMesa, setSelectedMesa] = useState<string>("1")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch mesas
      const mesasResponse = await fetch("http://localhost:5001/mesa/list")
      if (mesasResponse.ok) {
        const mesasData = await mesasResponse.json()
        setMesas(mesasData.mesas || [])
      } else {
        // Fallback data
        setMesas([
          { id: "1", mesa_id: "1", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "2", mesa_id: "2", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "3", mesa_id: "3", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "4", mesa_id: "4", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "5", mesa_id: "5", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "6", mesa_id: "6", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ])
      }

      // Fetch orders
      const ordersResponse = await fetch("http://localhost:5001/order")
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrders(ordersData || [])
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      // Fallback data
      setMesas([
        { id: "1", mesa_id: "1", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "2", mesa_id: "2", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "3", mesa_id: "3", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "4", mesa_id: "4", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "5", mesa_id: "5", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "6", mesa_id: "6", is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ])
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const getMesaStatus = (mesaId: string) => {
    const mesaOrders = orders.filter(order => order.mesa_id === mesaId)
    if (mesaOrders.length === 0) return "disponible"
    
    const activeOrder = mesaOrders.find(order => 
      order.status === "PAYMENT_PENDING" || 
      order.status === "PAID" || 
      order.status === "IN_PREPARATION" || 
      order.status === "READY"
    )
    
    if (activeOrder) {
      switch (activeOrder.status) {
        case "PAYMENT_PENDING": return "esperando_pago"
        case "PAID": return "pagado"
        case "IN_PREPARATION": return "preparando"
        case "READY": return "listo"
        default: return "ocupada"
      }
    }
    
    return "disponible"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponible": return "bg-green-100 text-green-800 border-green-200"
      case "esperando_pago": return "bg-red-100 text-red-800 border-red-200"
      case "pagado": return "bg-blue-100 text-blue-800 border-blue-200"
      case "preparando": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "listo": return "bg-purple-100 text-purple-800 border-purple-200"
      case "ocupada": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "disponible": return "Disponible"
      case "esperando_pago": return "Esperando Pago"
      case "pagado": return "Pagado"
      case "preparando": return "Preparando"
      case "listo": return "Listo para Entregar"
      case "ocupada": return "Ocupada"
      default: return "Desconocido"
    }
  }

  const getMesaOrders = (mesaId: string) => {
    return orders.filter(order => order.mesa_id === mesaId)
  }

  const getMesaTotal = (mesaId: string) => {
    const mesaOrders = getMesaOrders(mesaId)
    return mesaOrders.reduce((total, order) => total + order.total_amount, 0)
  }

  const refreshData = () => {
    fetchData()
  }

  const mesasDisponibles = mesas.filter(mesa => getMesaStatus(mesa.mesa_id) === "disponible")
  const mesasOcupadas = mesas.filter(mesa => getMesaStatus(mesa.mesa_id) !== "disponible")

  const handleMesaStatusChange = async (mesaId: string, newStatus: boolean) => {
    try {
      // En producción, aquí harías una llamada al backend para cambiar el estado
      console.log(`Cambiando estado de mesa ${mesaId} a ${newStatus ? 'activa' : 'inactiva'}`)
      
      // Actualizar localmente para demo
      setMesas(prevMesas =>
        prevMesas.map(mesa =>
          mesa.mesa_id === mesaId
            ? { ...mesa, is_active: newStatus, updated_at: new Date().toISOString() }
            : mesa
        )
      )
      
      // Aquí podrías hacer la llamada al backend:
      // const response = await fetch(`http://localhost:5001/mesa/${mesaId}/status`, {
      //   method: "PUT",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ is_active: newStatus })
      // })
      
    } catch (error) {
      console.error("Error updating mesa status:", error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">💰</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Cajero</h1>
                <p className="text-gray-600 text-sm">Gestión de mesas y pagos</p>
              </div>
            </div>
            <Button
              onClick={refreshData}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{mesas.length}</p>
                  <p className="text-xs text-gray-600">Total Mesas</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{mesasDisponibles.length}</p>
                  <p className="text-xs text-gray-600">Disponibles</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-orange-600">{mesasOcupadas.length}</p>
                  <p className="text-xs text-gray-600">Ocupadas</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                  <p className="text-xs text-gray-600">Total Pedidos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido con Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="mesas" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white border border-gray-200">
            <TabsTrigger value="mesas" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <span>🪑</span>
              Mesas ({mesas.length})
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <QrCode className="w-4 h-4" />
              Generar QR
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <span>📋</span>
              Pedidos ({orders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mesas">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">Cargando mesas...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mesas.map((mesa) => {
                  const status = getMesaStatus(mesa.mesa_id)
                  const mesaOrders = getMesaOrders(mesa.mesa_id)
                  const mesaTotal = getMesaTotal(mesa.mesa_id)
                  
                  return (
                    <Card key={mesa.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Mesa {mesa.mesa_id}</CardTitle>
                          <Badge className={`${getStatusColor(status)} border`}>
                            {getStatusText(status)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {mesaOrders.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600">
                                Pedidos: {mesaOrders.length}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                Total: ${mesaTotal.toFixed(2)}
                              </p>
                              <div className="text-xs text-gray-500">
                                Último: {new Date(mesa.updated_at).toLocaleTimeString()}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Sin pedidos</p>
                          )}
                          
                          {/* Controles de estado de mesa */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Estado:</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant={mesa.is_active ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleMesaStatusChange(mesa.mesa_id, true)}
                                  className={mesa.is_active ? "bg-green-600 hover:bg-green-700" : ""}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Activa
                                </Button>
                                <Button
                                  variant={!mesa.is_active ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleMesaStatusChange(mesa.mesa_id, false)}
                                  className={!mesa.is_active ? "bg-red-600 hover:bg-red-700" : ""}
                                >
                                  <Minus className="w-3 h-3 mr-1" />
                                  Inactiva
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="qr">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Generador de QR Codes
                </h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Mesa
                  </label>
                  <select
                    value={selectedMesa}
                    onChange={(e) => setSelectedMesa(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  >
                    {mesas.map((mesa) => (
                      <option key={mesa.id} value={mesa.mesa_id}>
                        Mesa {mesa.mesa_id}
                      </option>
                    ))}
                  </select>
                </div>
                
                <MesaQRGenerator mesaId={selectedMesa} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pedidos">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">Cargando pedidos...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay pedidos</h3>
                <p className="text-gray-600">No se han realizado pedidos aún</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Mesa {order.mesa_id}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Total: ${order.total_amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(order.status)} border`}>
                            {getStatusText(order.status)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 