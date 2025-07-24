"use client"

import { Clock, Bell, CheckCircle, Plus, User } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WaiterCall {
  id: string
  mesa_id: string
  created_at: string
  status: "PENDING" | "ATTENDED"
  message?: string
}

interface WaiterCallCardProps {
  call: WaiterCall
  onStatusUpdate: (callId: string, newStatus: WaiterCall["status"]) => void
  onCreateOrder: (mesa_id: string) => void
}

export default function WaiterCallCard({ call, onStatusUpdate, onCreateOrder }: WaiterCallCardProps) {
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

  const timeElapsed = getTimeElapsed(call.created_at)
  const isUrgent =
    getTimeElapsed(call.created_at).includes("h") ||
    (getTimeElapsed(call.created_at).includes("m") && Number.parseInt(getTimeElapsed(call.created_at)) > 10)

  return (
    <div
      className={`bg-card rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow ${
        isUrgent ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isUrgent ? "bg-red-500" : "bg-orange-500"
              }`}
            >
              <span className="text-white font-bold text-lg">{call.mesa_id}</span>
            </div>
            <div>
              <h3 className="font-semibold text-text flex items-center gap-2">
                <Bell className={`w-4 h-4 ${isUrgent ? "text-red-500" : "text-orange-500"}`} />
                Mesa {call.mesa_id}
              </h3>
              <p className="text-xs text-muted-foreground">#{call.id}</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full ${isUrgent ? "bg-red-100" : "bg-orange-100"}`}
          >
            <Clock className={`w-3 h-3 ${isUrgent ? "text-red-600" : "text-orange-600"}`} />
            <span className={`text-xs font-medium ${isUrgent ? "text-red-600" : "text-orange-600"}`}>
              {timeElapsed}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Llamada: {formatTime(call.created_at)}</span>
          {isUrgent && (
            <span className="text-red-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Urgente
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {call.message && (
          <div className="mb-4 p-3 bg-background rounded-lg border border-border">
            <p className="text-sm text-text">
              <span className="font-medium">Motivo:</span> {call.message}
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onStatusUpdate(call.id, "ATTENDED")}
              className="bg-secondary hover:bg-secondary-hover text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Atendido
            </Button>
            <Button
              onClick={() => onCreateOrder(call.mesa_id)}
              className="bg-primary hover:bg-primary-hover text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Pedido
            </Button>
          </div>

          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <User className="w-3 h-3" />
              Cliente esperando atención
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
