"use client"

import { Clock, CheckCircle, AlertCircle, ChefHat, Package } from "lucide-react"
import { Button } from "@/components/ui/button"

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

interface OrderCardProps {
  order: Order
  onStatusUpdate: (orderId: string, newStatus: Order["status"]) => void
}

export default function OrderCard({ order, onStatusUpdate }: OrderCardProps) {
  const getStatusInfo = (status: Order["status"]) => {
    switch (status) {
      case "PAYMENT_PENDING":
        return {
          icon: AlertCircle,
          text: "Pendiente de Pago",
          color: "text-accent",
          bgColor: "bg-accent/10",
          borderColor: "border-accent/20",
        }
      case "PAID":
        return {
          icon: CheckCircle,
          text: "Pagado",
          color: "text-secondary",
          bgColor: "bg-secondary/10",
          borderColor: "border-secondary/20",
        }
      case "PREPARING":
        return {
          icon: ChefHat,
          text: "Preparando",
          color: "text-primary",
          bgColor: "bg-primary/10",
          borderColor: "border-primary/20",
        }
      case "READY":
        return {
          icon: Package,
          text: "Listo",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        }
      case "DELIVERED":
        return {
          icon: CheckCircle,
          text: "Entregado",
          color: "text-gray-600",
          bgColor: "bg-gray-100",
          borderColor: "border-gray-200",
        }
    }
  }

  const statusInfo = getStatusInfo(order.status)
  const StatusIcon = statusInfo.icon

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimeElapsed = (dateString: string) => {
    const now = new Date()
    const orderTime = new Date(dateString)
    const diffMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return "Ahora"
    if (diffMinutes < 60) return `${diffMinutes}m`
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}h ${minutes}m`
  }

  const canStartPreparing = order.status === "PAID"
  const canMarkReady = order.status === "PREPARING"
  const canMarkDelivered = order.status === "READY"

  return (
    <div
      className={`bg-card rounded-lg border-2 ${statusInfo.borderColor} shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {order.mesa_id.replace('Mesa ', '')}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-text">{order.mesa_id}</h3>
              <p className="text-xs text-muted-foreground">#{order.id}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusInfo.bgColor}`}>
            <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
            <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Pedido: {formatTime(order.created_at)}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {getTimeElapsed(order.created_at)}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="p-4">
        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center">
              <div className="flex-1">
                <span className="text-sm font-medium text-text">{item.name}</span>
                {item.quantity > 1 && (
                  <span className="ml-2 text-xs bg-card-hover text-muted-foreground px-2 py-1 rounded">
                    x{item.quantity}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-primary">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-text">Total:</span>
            <span className="text-lg font-bold text-primary">${order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {canStartPreparing && (
            <Button
              onClick={() => onStatusUpdate(order.id, "PREPARING")}
              className="w-full bg-primary hover:bg-primary-hover text-white"
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Comenzar Preparación
            </Button>
          )}

          {canMarkReady && (
            <Button
              onClick={() => onStatusUpdate(order.id, "READY")}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Marcar como Listo
            </Button>
          )}

          {canMarkDelivered && (
            <Button
              onClick={() => onStatusUpdate(order.id, "DELIVERED")}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar como Entregado
            </Button>
          )}

          {order.status === "PAYMENT_PENDING" && (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground">Esperando confirmación de pago...</p>
            </div>
          )}

          {order.status === "READY" && (
            <div className="text-center py-2 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-700">✅ Pedido listo para entregar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
