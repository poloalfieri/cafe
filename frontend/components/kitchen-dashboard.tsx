"use client"

import { useState, useEffect } from "react"
import OrderCard from "@/components/order-card"
import WaiterCallCard from "@/components/waiter-call-card"
import { RefreshCw, Clock, CheckCircle, AlertCircle, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  mesa_id: string
  items: OrderItem[]
  total: number
  status: "PAYMENT_PENDING" | "PAYMENT_APPROVED" | "PAYMENT_REJECTED" | "PAID" | "IN_PREPARATION" | "READY" | "DELIVERED"
  created_at: string
  paid_at?: string
  payment_status?: string
}

interface WaiterCall {
  id: string
  mesa_id: string
  created_at: string
  status: "PENDING" | "ATTENDED"
  message?: string
}

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("all")

  // Simulación de datos - en producción esto vendría de tu API
  useEffect(() => {
    setLoading(true)
    
    // Fetch orders
    fetch("http://localhost:5001/order")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        // Ensure data is an array and has the expected structure
        const processedOrders = Array.isArray(data) ? data.map(order => ({
          ...order,
          items: order.items || [], // Add empty items array if not present
          total: order.total || 0, // Add total if not present
          paid_at: order.paid_at || undefined
        })) : []
        setOrders(processedOrders)
      })
      .catch((error) => {
        console.error("Error fetching orders:", error)
        // Add sample orders data when backend is not available
        const sampleOrders: Order[] = [
          {
            id: "1",
            mesa_id: "Mesa 1",
            items: [
              { id: "1", name: "Café Americano", quantity: 2, price: 3.50 },
              { id: "2", name: "Croissant", quantity: 1, price: 2.50 }
            ],
            total: 9.50,
            status: "PAYMENT_PENDING",
            created_at: new Date().toISOString(),
            paid_at: undefined
          },
          {
            id: "2",
            mesa_id: "Mesa 2", 
            items: [
              { id: "3", name: "Cappuccino", quantity: 1, price: 4.00 },
              { id: "4", name: "Tarta de Manzana", quantity: 1, price: 5.00 }
            ],
            total: 9.00,
            status: "PAID",
            created_at: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
            paid_at: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
          }
        ]
        setOrders(sampleOrders)
      })

    // Fetch waiter calls
    fetch("http://localhost:5001/waiter/calls")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (data.success && Array.isArray(data.calls)) {
          setWaiterCalls(data.calls)
        } else {
          console.error("Invalid waiter calls data format:", data)
          setWaiterCalls([])
        }
      })
      .catch((error) => {
        console.error("Error fetching waiter calls:", error)
        // Add sample waiter calls data for demonstration when backend is not available
        const sampleWaiterCalls: WaiterCall[] = [
          {
            id: "1",
            mesa_id: "Mesa 1",
            created_at: new Date().toISOString(),
            status: "PENDING",
            message: "Necesito más servilletas"
          },
          {
            id: "2", 
            mesa_id: "Mesa 3",
            created_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
            status: "PENDING",
            message: "¿Pueden traer la cuenta?"
          }
        ]
        setWaiterCalls(sampleWaiterCalls)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const refreshData = async () => {
    setLoading(true)
    
    try {
      // Refresh orders
      const ordersResponse = await fetch("http://localhost:5001/order")
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        const processedOrders = Array.isArray(ordersData) ? ordersData.map(order => ({
          ...order,
          items: order.items || [],
          total: order.total || 0,
          paid_at: order.paid_at || undefined
        })) : []
        setOrders(processedOrders)
      }

      // Refresh waiter calls
      const callsResponse = await fetch("http://localhost:5001/waiter/calls")
      if (callsResponse.ok) {
        const callsData = await callsResponse.json()
        if (callsData.success && Array.isArray(callsData.calls)) {
          setWaiterCalls(callsData.calls)
        }
      }
    } catch (error) {
      console.error("Error refreshing data:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = (orderId: string, newStatus: Order["status"]) => {
    setOrders(orders.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)))
  }

  const acceptOrder = async (orderId: string) => {
    try {
      const response = await fetch(`http://localhost:5001/payment/accept-order/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      
      if (response.ok) {
        const data = await response.json()
        setOrders(orders.map(order => 
          order.id === orderId ? { ...order, status: data.status } : order
        ))
      } else {
        console.error("Error accepting order")
      }
    } catch (error) {
      console.error("Error accepting order:", error)
    }
  }

  const rejectOrder = async (orderId: string) => {
    try {
      const response = await fetch(`http://localhost:5001/payment/reject-order/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      
      if (response.ok) {
        const data = await response.json()
        setOrders(orders.map(order => 
          order.id === orderId ? { ...order, status: data.status } : order
        ))
      } else {
        console.error("Error rejecting order")
      }
    } catch (error) {
      console.error("Error rejecting order:", error)
    }
  }

  const updateCallStatus = async (callId: string, newStatus: WaiterCall["status"]) => {
    try {
      const response = await fetch(`http://localhost:5001/waiter/calls/${callId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setWaiterCalls(waiterCalls.map((call) => 
          call.id === callId ? { ...call, status: newStatus } : call
        ))
        console.log("Estado de llamada actualizado:", data)
      } else {
        console.error("Error actualizando estado de llamada")
      }
    } catch (error) {
      console.error("Error actualizando estado de llamada:", error)
      // Fallback: actualizar localmente si falla la llamada al backend
      setWaiterCalls(waiterCalls.map((call) => (call.id === callId ? { ...call, status: newStatus } : call)))
    }
  }

  const createOrderFromCall = (mesa_id: string) => {
    // Aquí implementarías la lógica para crear un nuevo pedido
    console.log(`Creando pedido para mesa ${mesa_id}`)
    // Por ejemplo, redirigir a una página de creación de pedido o abrir un modal
  }

  const filteredOrders = orders.filter((order) => {
    // Excluir pedidos entregados
    if (order.status === "DELIVERED") return false

    if (filter === "paid") return order.status === "PAID" || order.status === "IN_PREPARATION" || order.status === "READY"
    if (filter === "pending") return order.status === "PAYMENT_PENDING"
    return true
  })

  const pendingCalls = waiterCalls.filter((call) => call.status === "PENDING")

  const getStatusStats = () => {
    const activeOrders = orders.filter((o) => o.status !== "DELIVERED")
    const paid = activeOrders.filter(
      (o) => o.status === "PAID" || o.status === "IN_PREPARATION" || o.status === "READY",
    ).length
    const pending = activeOrders.filter((o) => o.status === "PAYMENT_PENDING").length
    const preparing = activeOrders.filter((o) => o.status === "IN_PREPARATION").length

    return { paid, pending, preparing, total: activeOrders.length }
  }

  const stats = getStatusStats()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🍽️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Gestión</h1>
                <p className="text-gray-600 text-sm">Pedidos y llamadas en tiempo real</p>
              </div>
            </div>
            <Button
              onClick={refreshData}
              disabled={loading}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.pending}</p>
                  <p className="text-xs text-gray-600">Sin Pagar</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                  <p className="text-xs text-gray-600">Pagados</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-900" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.preparing}</p>
                  <p className="text-xs text-gray-600">Preparando</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Bell className={`w-5 h-5 ${pendingCalls.length > 0 ? "text-orange-500" : "text-gray-400"}`} />
                <div>
                  <p className={`text-2xl font-bold ${pendingCalls.length > 0 ? "text-orange-500" : "text-gray-400"}`}>
                    {pendingCalls.length}
                  </p>
                  <p className="text-xs text-gray-600">Llamadas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido con Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white border border-gray-200">
            <TabsTrigger value="orders" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <span>📋</span>
              Pedidos ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="calls" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <Bell className="w-4 h-4" />
              Llamadas ({pendingCalls.length})
              {pendingCalls.length > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCalls.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {/* Filtros de pedidos */}
            <div className="flex gap-2 mb-6">
              <Button
                onClick={() => setFilter("all")}
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                className={filter === "all" ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-white border-gray-300 hover:bg-gray-50"}
              >
                Todos ({stats.total})
              </Button>
              <Button
                onClick={() => setFilter("pending")}
                variant={filter === "pending" ? "default" : "outline"}
                size="sm"
                className={
                  filter === "pending"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white border-red-300 text-red-600 hover:bg-red-50"
                }
              >
                Sin Pagar ({stats.pending})
              </Button>
              <Button
                onClick={() => setFilter("paid")}
                variant={filter === "paid" ? "default" : "outline"}
                size="sm"
                className={
                  filter === "paid"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-white border-green-300 text-green-600 hover:bg-green-50"
                }
              >
                Pagados ({stats.paid})
              </Button>
            </div>

            {/* Lista de pedidos */}
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-900" />
                <p className="text-gray-600">Cargando pedidos...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay pedidos</h3>
                <p className="text-gray-600">
                  {filter === "all"
                    ? "No hay pedidos en este momento"
                    : filter === "pending"
                      ? "No hay pedidos pendientes de pago"
                      : "No hay pedidos pagados"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onStatusUpdate={updateOrderStatus}
                    onAcceptOrder={acceptOrder}
                    onRejectOrder={rejectOrder}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calls">
            {/* Lista de llamadas */}
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-900" />
                <p className="text-gray-600">Cargando llamadas...</p>
              </div>
            ) : pendingCalls.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">🔔</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay llamadas pendientes</h3>
                <p className="text-gray-600">Todas las mesas están atendidas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingCalls.map((call) => (
                  <WaiterCallCard
                    key={call.id}
                    call={call}
                    onStatusUpdate={updateCallStatus}
                    onCreateOrder={createOrderFromCall}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
