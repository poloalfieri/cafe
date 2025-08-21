'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { 
  CreditCard, 
  DollarSign, 
  QrCode, 
  Loader2, 
  CheckCircle,
  X,
  ShoppingCart,
  Clock,
  Shield
} from 'lucide-react'

interface MozoPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  mesaId: string
  totalAmount: number
  items: Array<{
    name: string
    price: number
    quantity: number
  }>
}

type PaymentMethod = 'tarjeta' | 'efectivo' | 'qr'

interface PaymentMethodOption {
  id: PaymentMethod
  title: string
  description: string
  icon: React.ReactNode
  action: () => Promise<void>
  buttonText: string
  message?: string
  color: string
  features: string[]
}

export default function MozoPaymentModal({
  isOpen,
  onClose,
  mesaId,
  totalAmount,
  items
}: MozoPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleWaiterNotification = async (motivo: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    
    try {
      const response = await fetch('http://localhost:5001/waiter/notificar-mozo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesa_id: mesaId,
          motivo: motivo,
          usuario_id: 'mozo',
          message: `Solicitud de pago - ${motivo}`
        }),
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setSuccessMessage('¡Perfecto! El cliente ha sido notificado.')
      } else {
        throw new Error('Error al notificar al cliente')
      }
    } catch (error) {
      console.error('Error notificando al cliente:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const paymentMethods: PaymentMethodOption[] = [
    {
      id: 'tarjeta',
      title: 'Tarjeta Física',
      description: 'El cliente usará el posnet',
      icon: <CreditCard className="w-5 h-5" />,
      action: () => handleWaiterNotification('pago_tarjeta'),
      buttonText: 'Confirmar Pago con Tarjeta',
      message: 'El cliente pagará con tarjeta',
      color: 'text-gray-600',
      features: ['Acepta todas las tarjetas', 'Pago en cuotas']
    },
    {
      id: 'efectivo',
      title: 'Efectivo',
      description: 'El cliente pagará en efectivo',
      icon: <DollarSign className="w-5 h-5" />,
      action: () => handleWaiterNotification('pago_efectivo'),
      buttonText: 'Confirmar Pago en Efectivo',
      message: 'El cliente pagará en efectivo',
      color: 'text-gray-600',
      features: ['Pago directo', 'Sin comisiones']
    },
    {
      id: 'qr',
      title: 'QR del Mozo',
      description: 'El cliente escaneará el QR',
      icon: <QrCode className="w-5 h-5" />,
      action: () => handleWaiterNotification('pago_qr'),
      buttonText: 'Confirmar Pago con QR',
      message: 'El cliente pagará escaneando QR',
      color: 'text-gray-600',
      features: ['Pago móvil', 'Escaneo rápido']
    }
  ]

  const handleMethodSelect = async (method: PaymentMethod) => {
    setSelectedMethod(method)
    setSuccessMessage(null)
    setErrorMessage(null)
    
    const selectedOption = paymentMethods.find(m => m.id === method)
    if (selectedOption) {
      await selectedOption.action()
    }
  }

  const handleClose = () => {
    setSelectedMethod(null)
    setSuccessMessage(null)
    setErrorMessage(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md mx-auto p-0 overflow-hidden bg-white rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header con botón de cierre */}
        <DialogHeader className="bg-white text-gray-900 p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Método de Pago - Mesa {mesaId}
                </DialogTitle>
                <p className="text-blue-500 text-xs">
                  Selecciona cómo pagará el cliente
                </p>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Resumen compacto */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              Resumen del Pedido
            </h3>
            <div className="space-y-2">
              {items.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span className="text-blue-700 font-medium truncate flex-1 mr-2">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-blue-900 font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {items.length > 3 && (
                <div className="text-xs text-blue-500 text-center py-1">
                  +{items.length - 3} productos más
                </div>
              )}
              <div className="border-t border-blue-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-blue-900">Total</span>
                  <span className="text-lg font-bold text-blue-900">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mensajes de estado */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{successMessage}</p>
                <p className="text-xs text-green-600 mt-1">
                  El cliente puede proceder con el pago
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Error en la notificación</p>
                <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Opciones de pago con iconos más visibles */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-base mb-3">
              ¿Cómo pagará el cliente?
            </h3>
            
            {paymentMethods.map((method) => (
              <Card 
                key={method.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md border ${
                  selectedMethod === method.id 
                    ? `ring-1 ring-blue-400 border-blue-400 bg-blue-50` 
                    : 'hover:border-blue-300 border-gray-200'
                }`}
                onClick={() => !isLoading && handleMethodSelect(method.id)}
              >
                <CardHeader className="pb-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-600 text-white">
                      {method.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-bold text-gray-700 truncate">
                        {method.title}
                      </CardTitle>
                      <CardDescription className="text-gray-500 text-xs mt-1">
                        {method.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                {selectedMethod === method.id && (
                  <CardContent className="pt-0 px-4 pb-4">
                    {/* Features compactos */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {method.features.map((feature, index) => (
                        <span key={index} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                          {feature}
                        </span>
                      ))}
                    </div>
                    
                    {method.message && (
                      <div className="bg-blue-100 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-medium">{method.message}</span>
                      </div>
                    )}
                    
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMethodSelect(method.id)
                      }}
                      disabled={isLoading}
                      className="w-full font-semibold py-3 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        method.buttonText
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Información de seguridad compacta */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 text-sm mb-1">
                  Pago Seguro
                </h4>
                <p className="text-blue-600 text-xs leading-relaxed">
                  Todos los métodos están protegidos. El cliente puede proceder con confianza.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 