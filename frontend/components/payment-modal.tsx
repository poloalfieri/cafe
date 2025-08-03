'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { 
  Wallet, 
  CreditCard, 
  DollarSign, 
  QrCode, 
  Loader2, 
  ExternalLink,
  CheckCircle,
  X,
  ShoppingCart,
  Clock
} from 'lucide-react'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  mesaId: string
  mesaToken: string
  totalAmount: number
  items: Array<{
    name: string
    price: number
    quantity: number
  }>
}

type PaymentMethod = 'billetera' | 'tarjeta' | 'efectivo' | 'qr'

interface PaymentMethodOption {
  id: PaymentMethod
  title: string
  description: string
  icon: React.ReactNode
  action: () => Promise<void>
  buttonText: string
  message?: string
  color: string
  bgColor: string
  borderColor: string
}

export default function PaymentModal({
  isOpen,
  onClose,
  mesaId,
  mesaToken,
  totalAmount,
  items
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleBilleteraPayment = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    
    try {
      const response = await fetch('http://localhost:5001/payment/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monto: totalAmount,
          mesa_id: mesaId,
          descripcion: `Pedido Mesa ${mesaId} - ${items.map(item => `${item.name} x${item.quantity}`).join(', ')}`
        }),
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success && data.payment_link) {
        // Abrir el link de pago en una nueva pestaña
        window.open(data.payment_link, '_blank')
        setSuccessMessage('¡Link de pago abierto! Completa tu pago en la nueva pestaña.')
      } else {
        throw new Error('Error al generar el link de pago')
      }
    } catch (error) {
      console.error('Error procesando pago con billetera:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

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
          usuario_id: 'cliente',
          message: `Solicitud de pago - ${motivo}`
        }),
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setSuccessMessage('¡Perfecto! El mozo ha sido notificado y llegará pronto.')
      } else {
        throw new Error('Error al notificar al mozo')
      }
    } catch (error) {
      console.error('Error notificando al mozo:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const paymentMethods: PaymentMethodOption[] = [
    {
      id: 'billetera',
      title: 'Billetera Digital',
      description: 'Paga con Mercado Pago, Ualá, o tu billetera preferida',
      icon: <Wallet className="w-6 h-6" />,
      action: handleBilleteraPayment,
      buttonText: 'Pagar Ahora',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'tarjeta',
      title: 'Tarjeta Física',
      description: 'El mozo traerá el posnet a tu mesa',
      icon: <CreditCard className="w-6 h-6" />,
      action: () => handleWaiterNotification('pago_tarjeta'),
      buttonText: 'Solicitar Posnet',
      message: 'El mozo llegará en 2-3 minutos con el posnet',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'efectivo',
      title: 'Efectivo',
      description: 'El mozo pasará a cobrar en efectivo',
      icon: <DollarSign className="w-6 h-6" />,
      action: () => handleWaiterNotification('pago_efectivo'),
      buttonText: 'Solicitar Cobro',
      message: 'El mozo llegará en 2-3 minutos a cobrar',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    {
      id: 'qr',
      title: 'QR del Mozo',
      description: 'Esperá que el mozo te acerque el QR',
      icon: <QrCode className="w-6 h-6" />,
      action: () => handleWaiterNotification('pago_qr'),
      buttonText: 'Solicitar QR',
      message: 'El mozo llegará en 2-3 minutos con el QR',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
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
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Método de Pago
                </DialogTitle>
                <p className="text-red-100 text-sm mt-1">
                  Elige cómo quieres pagar tu pedido
                </p>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Resumen del pedido */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-600" />
              Resumen del pedido
            </h3>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-300 pt-2 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total a pagar</span>
                  <span className="text-xl font-bold text-red-600">
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
                <p className="font-medium">{successMessage}</p>
                <p className="text-sm text-green-600 mt-1">
                  {selectedMethod === 'billetera' 
                    ? 'Completa el pago en la nueva pestaña' 
                    : 'El mozo llegará pronto a tu mesa'
                  }
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium">Error en el pago</p>
                <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Opciones de pago */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-lg mb-4">
              ¿Cómo quieres pagar?
            </h3>
            
            {paymentMethods.map((method) => (
              <Card 
                key={method.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                  selectedMethod === method.id 
                    ? `ring-2 ring-offset-2 ${method.borderColor.replace('border-', 'ring-')}` 
                    : 'hover:border-gray-300'
                }`}
                onClick={() => !isLoading && handleMethodSelect(method.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${method.bgColor} ${method.color}`}>
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className={`text-lg font-bold ${method.color}`}>
                        {method.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-1">
                        {method.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                {selectedMethod === method.id && (
                  <CardContent className="pt-0">
                    {method.message && (
                      <div className={`${method.bgColor} border ${method.borderColor} text-gray-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2`}>
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">{method.message}</span>
                      </div>
                    )}
                    
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMethodSelect(method.id)
                      }}
                      disabled={isLoading}
                      className={`w-full font-semibold py-3 text-base ${
                        method.id === 'billetera' 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          {method.id === 'billetera' && <ExternalLink className="w-5 h-5 mr-2" />}
                          {method.buttonText}
                        </>
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Información adicional */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 text-sm">
                  ¿Necesitas ayuda?
                </h4>
                <p className="text-blue-700 text-sm mt-1">
                  Si tienes problemas con el pago, el mozo puede ayudarte con cualquier método de pago.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 