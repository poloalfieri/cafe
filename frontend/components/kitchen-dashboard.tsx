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
  status: "PAYMENT_PENDING" | "PAID" | "PREPARING" | "READY" | "DELIVERED"
  created_at: string
  paid_at?: string
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
    fetch("http://localhost:5000/order")
      .then((res) => res.json())
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const refreshData = async () => {
    setLoading(true)
    // Simular llamada a API
    setTimeout(() => {
      setLoading(false)
    }, 500)
  }

  const updateOrderStatus = (orderId: string, newStatus: Order["status"]) => {
    setOrders(orders.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)))
  }

  const updateCallStatus = (callId: string, newStatus: WaiterCall["status"]) => {
    setWaiterCalls(waiterCalls.map((call) => (call.id === callId ? { ...call, status: newStatus } : call)))
  }

  const createOrderFromCall = (mesa_id: string) => {
    // Aquí implementarías la lógica para crear un nuevo pedido
    console.log(`Creando pedido para mesa ${mesa_id}`)
    // Por ejemplo, redirigir a una página de creación de pedido o abrir un modal
  }

  const filteredOrders = orders.filter((order) => {
    // Excluir pedidos entregados
    if (order.status === "DELIVERED") return false

    if (filter === "paid") return order.status === "PAID" || order.status === "PREPARING" || order.status === "READY"
    if (filter === "pending") return order.status === "PAYMENT_PENDING"
    return true
  })

  const pendingCalls = waiterCalls.filter((call) => call.status === "PENDING")

  const getStatusStats = () => {
    const activeOrders = orders.filter((o) => o.status !== "DELIVERED")
    const paid = activeOrders.filter(
      (o) => o.status === "PAID" || o.status === "PREPARING" || o.status === "READY",
    ).length
    const pending = activeOrders.filter((o) => o.status === "PAYMENT_PENDING").length
    const preparing = activeOrders.filter((o) => o.status === "PREPARING").length

    return { paid, pending, preparing, total: activeOrders.length }
  }

  const stats = getStatusStats()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🍽️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">Panel de Gestión</h1>
                <p className="text-muted-foreground text-sm">Pedidos y llamadas en tiempo real</p>
              </div>
            </div>
            <Button
              onClick={refreshData}
              disabled={loading}
              className="bg-secondary hover:bg-secondary-hover text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-2xl font-bold text-accent">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Sin Pagar</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold text-secondary">{stats.paid}</p>
                  <p className="text-xs text-muted-foreground">Pagados</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.preparing}</p>
                  <p className="text-xs text-muted-foreground">Preparando</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <div>
                  <p className="text-2xl font-bold text-text">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2">
                <Bell className={`w-5 h-5 ${pendingCalls.length > 0 ? "text-orange-500" : "text-gray-400"}`} />
                <div>
                  <p className={`text-2xl font-bold ${pendingCalls.length > 0 ? "text-orange-500" : "text-gray-400"}`}>
                    {pendingCalls.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Llamadas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido con Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <span>📋</span>
              Pedidos ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="calls" className="flex items-center gap-2">
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
                className={filter === "all" ? "bg-primary text-white" : "bg-transparent"}
              >
                Todos ({stats.total})
              </Button>
              <Button
                onClick={() => setFilter("pending")}
                variant={filter === "pending" ? "default" : "outline"}
                size="sm"
                className={
                  filter === "pending"
                    ? "bg-accent text-white"
                    : "bg-transparent border-accent/20 text-accent hover:bg-accent/5"
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
                    ? "bg-secondary text-white"
                    : "bg-transparent border-secondary/20 text-secondary hover:bg-secondary/5"
                }
              >
                Pagados ({stats.paid})
              </Button>
            </div>

            {/* Lista de pedidos */}
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Cargando pedidos...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📋</div>
                <h3 className="text-xl font-semibold text-text mb-2">No hay pedidos</h3>
                <p className="text-muted-foreground">
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
                  <OrderCard key={order.id} order={order} onStatusUpdate={updateOrderStatus} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calls">
            {/* Lista de llamadas */}
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Cargando llamadas...</p>
              </div>
            ) : pendingCalls.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">🔔</div>
                <h3 className="text-xl font-semibold text-text mb-2">No hay llamadas pendientes</h3>
                <p className="text-muted-foreground">Todas las mesas están atendidas</p>
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
