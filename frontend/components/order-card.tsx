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
  status: "PAYMENT_PENDING" | "PAYMENT_APPROVED" | "PAYMENT_REJECTED" | "PAID" | "IN_PREPARATION" | "READY" | "DELIVERED"
  created_at: string
  paid_at?: string
  payment_status?: string
}

interface OrderCardProps {
  order: Order
  onStatusUpdate: (orderId: string, newStatus: Order["status"]) => void
  onAcceptOrder?: (orderId: string) => void
  onRejectOrder?: (orderId: string) => void
}

export default function OrderCard({ order, onStatusUpdate, onAcceptOrder, onRejectOrder }: OrderCardProps) {
  const getStatusInfo = (status: Order["status"]) => {
    switch (status) {
      case "PAYMENT_PENDING":
        return {
          icon: AlertCircle,
          text: "Pendiente de Pago",
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        }
      case "PAYMENT_APPROVED":
        return {
          icon: CheckCircle,
          text: "Pago Aprobado",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        }
      case "PAYMENT_REJECTED":
        return {
          icon: AlertCircle,
          text: "Pago Rechazado",
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        }
      case "PAID":
        return {
          icon: CheckCircle,
          text: "Pagado",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        }
      case "IN_PREPARATION":
        return {
          icon: ChefHat,
          text: "En Preparación",
          color: "text-gray-900",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
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
      default:
        return {
          icon: AlertCircle,
          text: "Desconocido",
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
  const canMarkReady = order.status === "IN_PREPARATION"
  const canMarkDelivered = order.status === "READY"

  return (
    <div
      className={`bg-white rounded-2xl border-2 ${statusInfo.borderColor} shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {order.mesa_id.replace('Mesa ', '')}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{order.mesa_id}</h3>
              <p className="text-xs text-gray-600">#{order.id}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusInfo.bgColor}`}>
            <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
            <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
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
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                {item.quantity > 1 && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    x{item.quantity}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total:</span>
            <span className="text-lg font-bold text-gray-900">${order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {canStartPreparing && (
            <Button
              onClick={() => onStatusUpdate(order.id, "IN_PREPARATION")}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
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
              <p className="text-xs text-gray-600">Esperando confirmación de pago...</p>
            </div>
          )}

          {order.status === "PAYMENT_APPROVED" && onAcceptOrder && onRejectOrder && (
            <div className="space-y-2">
              <Button
                onClick={() => onAcceptOrder(order.id)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aceptar Pedido
              </Button>
              <Button
                onClick={() => onRejectOrder(order.id)}
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Rechazar y Reembolsar
              </Button>
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
