"use client"

import { Clock, Bell, CheckCircle, XCircle, CreditCard, Banknote, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WaiterCall {
  id: string
  mesa_id: string
  created_at: string
  status: "PENDING" | "COMPLETED" | "CANCELLED"
  message?: string
  payment_method: "CARD" | "CASH" | "QR"
}

interface WaiterCallCardProps {
  call: WaiterCall
  onStatusUpdate: (callId: string, newStatus: WaiterCall["status"]) => void
}

export default function WaiterCallCard({ call, onStatusUpdate }: WaiterCallCardProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimeElapsed = (dateString: string) => {
    const now = new Date()
    const callTime = new Date(dateString)
    const diffMinutes = Math.floor((now.getTime() - callTime.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return "Ahora"
    if (diffMinutes < 60) return `${diffMinutes}m`
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}h ${minutes}m`
  }

  const getPaymentMethodIcon = (method: WaiterCall["payment_method"]) => {
    switch (method) {
      case "CARD":
        return <CreditCard className="w-4 h-4" />
      case "CASH":
        return <Banknote className="w-4 h-4" />
      case "QR":
        return <QrCode className="w-4 h-4" />
    }
  }

  const getPaymentMethodText = (method: WaiterCall["payment_method"]) => {
    switch (method) {
      case "CARD":
        return "Pago con Tarjeta"
      case "CASH":
        return "Pago en Efectivo"
      case "QR":
        return "Pago con QR"
    }
  }

  const timeElapsed = getTimeElapsed(call.created_at)
  const isUrgent =
    timeElapsed.includes("h") ||
    (timeElapsed.includes("m") && Number.parseInt(timeElapsed) > 10)

  const isPending = call.status === "PENDING"

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 ${
        isUrgent ? "ring-2 ring-red-100" : "ring-1 ring-orange-50"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isUrgent ? "bg-red-500" : "bg-orange-500"
              }`}
            >
              <span className="text-white font-bold text-lg">
                {call.mesa_id.replace('Mesa ', '')}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className={`w-4 h-4 ${isUrgent ? "text-red-500" : "text-orange-500"}`} />
                {call.mesa_id}
              </h3>
              <p className="text-xs text-gray-600">#{call.id.slice(0, 8)}</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full ${
              isUrgent ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span className="text-xs font-medium">
              {timeElapsed}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Llamada: {formatTime(call.created_at)}</span>
          {isUrgent && (
            <span className="text-red-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
              Urgente
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {/* Metodo de Pago */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-gray-900">
            {getPaymentMethodIcon(call.payment_method)}
            <p className="text-sm font-medium">{getPaymentMethodText(call.payment_method)}</p>
          </div>
        </div>

        {call.message && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-900">
              <span className="font-medium text-gray-600">Mensaje:</span> {call.message}
            </p>
          </div>
        )}

        {/* Acciones - solo visibles si esta PENDING */}
        {isPending && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onStatusUpdate(call.id, "COMPLETED")}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Completar
            </Button>
            <Button
              onClick={() => onStatusUpdate(call.id, "CANCELLED")}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
