"use client"

import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface CallWaiterModalProps {
  isOpen: boolean
  onConfirm: (data: { message?: string, paymentMethod: 'CARD' | 'CASH' | 'QR' }) => void
  onCancel: () => void
}

export default function CallWaiterModal({ isOpen, onConfirm, onCancel }: CallWaiterModalProps) {
  const [message, setMessage] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH' | 'QR'>('CASH')

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm({
      message: message.trim() || undefined,
      paymentMethod
    })
  }

  const handleCancel = () => {
    setMessage("")
    setPaymentMethod('CASH')
    onCancel()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto border border-gray-200">
        {/* Header del modal */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900/10 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-gray-900" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Llamar al Mozo</h2>
          </div>
          <Button
            onClick={handleCancel}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-full hover:bg-gray-100 touch-manipulation"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Contenido del modal */}
        <div className="p-4 sm:p-6">
          <p className="text-gray-600 text-sm sm:text-base mb-4 leading-relaxed">
            ¿Necesitas ayuda con tu pedido o tienes alguna consulta? Un mozo se acercará a tu mesa en breve.
          </p>

          {/* Selección de método de pago */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Método de Pago
            </label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as 'CARD' | 'CASH' | 'QR')}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CASH" id="cash" />
                <Label htmlFor="cash">Efectivo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CARD" id="card" />
                <Label htmlFor="card">Tarjeta</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="QR" id="qr" />
                <Label htmlFor="qr">QR</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Campo de mensaje opcional */}
          <div className="mb-6">
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Motivo (opcional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej: Necesito más servilletas, ¿Pueden traer la cuenta?, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length}/200 caracteres
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 py-3 text-sm sm:text-base touch-manipulation bg-white border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 text-sm sm:text-base touch-manipulation"
            >
              Sí, llamar mozo
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
