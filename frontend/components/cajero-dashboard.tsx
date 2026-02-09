"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { RefreshCw, Users, CheckCircle, Clock, Plus, Minus, Bell } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import WaiterCallCard from "./waiter-call-card"
import { api, getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useTranslations } from "next-intl"

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

interface WaiterCall {
  id: string
  mesa_id: string
  created_at: string
  status: "PENDING" | "COMPLETED" | "CANCELLED"
  message?: string
  payment_method: "CARD" | "CASH" | "QR"
}

const POLLING_INTERVAL_MS = 5000

export default function CajeroDashboard() {
  const t = useTranslations("cajero.dashboard")
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStock, setLowStock] = useState<Array<{ name: string; currentStock: number; minStock: number }>>([])
  const [showLowStockDialog, setShowLowStockDialog] = useState(false)
  const [branchName, setBranchName] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

  const fetchWaiterCalls = useCallback(async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/waiter/calls?status=PENDING`, {
        headers: {
          ...authHeader,
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.calls)) {
          setWaiterCalls(data.calls)
        }
      }
    } catch (error) {
      console.error(t("errors.fetchWaiterCalls"), error)
    }
  }, [backendUrl])

  useEffect(() => {
    fetchData()
    fetchWaiterCalls()
    fetchBranch()
    ;(async () => {
      try {
        const json = await api.get('/api/ingredients?page=1&pageSize=1000')
        const list = json.data?.ingredients || []
        const lows = list.filter((i: any) => i.trackStock && i.currentStock <= i.minStock)
          .map((i: any) => ({ name: i.name, currentStock: i.currentStock, minStock: i.minStock }))
        setLowStock(lows)
        setShowLowStockDialog(lows.length > 0)
      } catch (_) {}
    })()
  }, [])

  const fetchBranch = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches/me`, {
        headers: {
          ...authHeader,
        },
      })
      if (response.ok) {
        const data = await response.json()
        const name = data?.branch?.name
        if (name) {
          setBranchName(name)
        }
      }
    } catch (error) {
      console.error(t("errors.fetchBranch"), error)
    }
  }

  // Polling for waiter calls every 5 seconds
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchWaiterCalls()
    }, POLLING_INTERVAL_MS)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [fetchWaiterCalls])

  const fetchData = async () => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      // Fetch mesas
      const mesasResponse = await fetch(`${backendUrl}/mesa/list`, {
        headers: {
          ...authHeader,
        },
      })
      if (mesasResponse.ok) {
        const mesasData = await mesasResponse.json()
        setMesas(mesasData.mesas || [])
      } else {
        setMesas([])
      }

      // Fetch orders
      const ordersResponse = await fetch(`${backendUrl}/order`, {
        headers: {
          ...authHeader,
        },
      })
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrders(ordersData || [])
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error(t("errors.fetchData"), error)
      setMesas([])
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
      case "PAYMENT_PENDING": return "bg-red-100 text-red-800 border-red-200"
      case "PAID": return "bg-green-100 text-green-800 border-green-200"
      case "PAYMENT_APPROVED": return "bg-green-100 text-green-800 border-green-200"
      case "PAYMENT_REJECTED": return "bg-gray-100 text-gray-800 border-gray-200"
      case "IN_PREPARATION": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "READY": return "bg-blue-100 text-blue-800 border-blue-200"
      case "DELIVERED": return "bg-gray-100 text-gray-500 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "disponible": return t("status.available")
      case "esperando_pago": return t("status.waitingPayment")
      case "pagado": return t("status.paid")
      case "preparando": return t("status.preparing")
      case "listo": return t("status.readyToDeliver")
      case "ocupada": return t("status.occupied")
      case "PAYMENT_PENDING": return t("status.waitingPayment")
      case "PAID": return t("status.paid")
      case "PAYMENT_APPROVED": return t("status.paymentApproved")
      case "PAYMENT_REJECTED": return t("status.paymentRejected")
      case "IN_PREPARATION": return t("status.inPreparation")
      case "READY": return t("status.ready")
      case "DELIVERED": return t("status.delivered")
      default: return t("status.unknown")
    }
  }

  const activeOrders = orders.filter(order =>
    order.status !== "DELIVERED" && order.status !== "CANCELLED"
  )

  const getMesaOrders = (mesaId: string) => {
    return orders.filter(order => order.mesa_id === mesaId)
  }

  const getMesaTotal = (mesaId: string) => {
    const mesaOrders = getMesaOrders(mesaId)
    return mesaOrders.reduce((total, order) => total + order.total_amount, 0)
  }

  const updateCallStatus = async (callId: string, newStatus: WaiterCall["status"]) => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/waiter/calls/${callId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setWaiterCalls(prev => prev.filter(call => call.id !== callId))
      } else {
        const errorData = await response.json()
        console.error(t("errors.updateCallStatus"), errorData.error)
      }
    } catch (error) {
      console.error(t("errors.updateCallStatus"), error)
    }
  }

  const refreshData = () => {
    fetchData()
    fetchWaiterCalls()
  }

  const mesasDisponibles = mesas.filter(mesa => getMesaStatus(mesa.mesa_id) === "disponible")
  const mesasOcupadas = mesas.filter(mesa => getMesaStatus(mesa.mesa_id) !== "disponible")

  const handleMesaStatusChange = async (mesaId: string, newStatus: boolean) => {
    try {
      // En producción, aquí harías una llamada al backend para cambiar el estado
      console.log(t("logs.changeMesaStatus", { mesaId, status: newStatus ? t("status.active") : t("status.inactive") }))
      
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
      console.error(t("errors.updateMesaStatus"), error)
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
                <h1 className="text-2xl font-bold text-gray-900">
                  {branchName
                    ? t("header.titleWithBranch", { branch: branchName })
                    : t("header.title")}
                </h1>
                <p className="text-gray-600 text-sm">{t("header.subtitle")}</p>
              </div>
            </div>
            <Button
              onClick={refreshData}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {t("actions.refresh")}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{mesas.length}</p>
                  <p className="text-xs text-gray-600">{t("stats.totalTables")}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{mesasDisponibles.length}</p>
                  <p className="text-xs text-gray-600">{t("stats.available")}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-orange-600">{mesasOcupadas.length}</p>
                  <p className="text-xs text-gray-600">{t("stats.occupied")}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                  <p className="text-xs text-gray-600">{t("stats.totalOrders")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido con Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Dialog open={showLowStockDialog} onOpenChange={setShowLowStockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("lowStock.title")}</DialogTitle>
              <DialogDescription>
                {t("lowStock.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {lowStock.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span>
                    {t("lowStock.stockLine", {
                      current: i.currentStock.toFixed(2),
                      min: i.minStock.toFixed(2)
                    })}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Tabs defaultValue="pagos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white border border-gray-200">
            <TabsTrigger value="pagos" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <Bell className="w-4 h-4" />
              {t("tabs.payments", { count: waiterCalls.length })}
              {waiterCalls.length > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {waiterCalls.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mesas" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              {t("tabs.tables", { count: mesas.length })}
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              {t("tabs.orders", { count: activeOrders.length })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pagos">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">{t("payments.loading")}</p>
              </div>
            ) : waiterCalls.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("payments.emptyTitle")}</h3>
                <p className="text-gray-600">{t("payments.emptySubtitle")}</p>
                <p className="text-gray-400 text-sm mt-2">{t("payments.autoRefresh")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{t("payments.autoRefresh")}</p>
                {waiterCalls.map((call) => (
                  <WaiterCallCard
                    key={call.id}
                    call={call}
                    onStatusUpdate={updateCallStatus}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mesas">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">{t("tables.loading")}</p>
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
                          <CardTitle className="text-lg">{t("tables.tableLabel", { id: mesa.mesa_id })}</CardTitle>
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
                                {t("tables.ordersCount", { count: mesaOrders.length })}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {t("tables.total", { total: mesaTotal.toFixed(2) })}
                              </p>
                              <div className="text-xs text-gray-500">
                                {t("tables.lastUpdate", { value: new Date(mesa.updated_at).toLocaleTimeString() })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">{t("tables.noOrders")}</p>
                          )}
                          
                          {/* Controles de estado de mesa */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">{t("tables.statusLabel")}</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant={mesa.is_active ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleMesaStatusChange(mesa.mesa_id, true)}
                                  className={mesa.is_active ? "bg-green-600 hover:bg-green-700" : ""}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {t("tables.active")}
                                </Button>
                                <Button
                                  variant={!mesa.is_active ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleMesaStatusChange(mesa.mesa_id, false)}
                                  className={!mesa.is_active ? "bg-red-600 hover:bg-red-700" : ""}
                                >
                                  <Minus className="w-3 h-3 mr-1" />
                                  {t("tables.inactive")}
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

          <TabsContent value="pedidos">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">{t("orders.loading")}</p>
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("orders.emptyTitle")}</h3>
                <p className="text-gray-600">{t("orders.emptySubtitle")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {t("orders.tableLabel", { id: order.mesa_id })}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {t("orders.orderId", { id: order.id })}
                          </p>
                          <p className="text-sm text-gray-600">
                            {t("orders.total", { total: order.total_amount.toFixed(2) })}
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
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">{t("orders.itemsTitle")}</p>
                        {Array.isArray(order.items) && order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs text-gray-600">
                                <span className="truncate pr-2">
                                  {t("orders.itemLine", { name: item.name, quantity: item.quantity })}
                                </span>
                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">{t("orders.noItems")}</p>
                        )}
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
