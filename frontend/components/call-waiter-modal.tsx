"use client"

import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CallWaiterModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function CallWaiterModal({ isOpen, onConfirm, onCancel }: CallWaiterModalProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    // Aquí enviarías la llamada al sistema de gestión
    // Por ejemplo, hacer un POST a /api/waiter-calls
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-auto border border-border">
        {/* Header del modal */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-text">Llamar al Mozo</h2>
          </div>
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-full hover:bg-card-hover touch-manipulation"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Contenido del modal */}
        <div className="p-4 sm:p-6">
          <p className="text-muted-foreground text-sm sm:text-base mb-6 leading-relaxed">
            ¿Necesitas ayuda con tu pedido o tienes alguna consulta? Un mozo se acercará a tu mesa en breve.
          </p>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 py-3 text-sm sm:text-base touch-manipulation bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-primary hover:bg-primary-hover text-white py-3 text-sm sm:text-base touch-manipulation"
            >
              Sí, llamar mozo
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
