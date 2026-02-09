"use client"

import { Clock, Bell, CheckCircle, XCircle, CreditCard, Banknote, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface WaiterCall {
  id: string | number
  mesa_id: string | number
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
  const t = useTranslations("cajero.waiterCall")
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

    if (diffMinutes < 1) return t("time.now")
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
        return t("payment.card")
      case "CASH":
        return t("payment.cash")
      case "QR":
        return t("payment.qr")
    }
  }

  const timeElapsed = getTimeElapsed(call.created_at)
  const isUrgent =
    timeElapsed.includes("h") ||
    (timeElapsed.includes("m") && Number.parseInt(timeElapsed) > 10)

  const isPending = call.status === "PENDING"
  const callId = typeof call.id === "string" ? call.id : String(call.id ?? "")
  const mesaLabel = typeof call.mesa_id === "string" ? call.mesa_id : String(call.mesa_id ?? "")
  const callIdShort = callId ? callId.slice(0, 8) : "--"

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
                {mesaLabel.replace('Mesa ', '')}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className={`w-4 h-4 ${isUrgent ? "text-red-500" : "text-orange-500"}`} />
              {mesaLabel}
            </h3>
            <p className="text-xs text-gray-600">#{callIdShort}</p>
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
          <span>{t("callTime", { time: formatTime(call.created_at) })}</span>
          {isUrgent && (
            <span className="text-red-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
              {t("urgent")}
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
              <span className="font-medium text-gray-600">{t("messageLabel")}</span> {call.message}
            </p>
          </div>
        )}

        {/* Acciones - solo visibles si esta PENDING */}
        {isPending && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onStatusUpdate(callId, "COMPLETED")}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!callId}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {t("actions.complete")}
            </Button>
            <Button
              onClick={() => onStatusUpdate(callId, "CANCELLED")}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              disabled={!callId}
            >
              <XCircle className="w-4 h-4 mr-2" />
              {t("actions.cancel")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
