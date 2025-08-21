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
  Clock,
  Shield
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
  features: string[]
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
        window.open(data.payment_link, '_blank')
        setSuccessMessage('¡Perfecto! Se abrió tu billetera digital.')
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
        setSuccessMessage('¡Genial! El mozo ya fue notificado.')
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
      description: 'Mercado Pago, Ualá, etc.',
      icon: <Wallet className="w-5 h-5" />,
      action: handleBilleteraPayment,
      buttonText: 'Pagar Ahora',
      color: 'text-gray-600',
      features: ['Pago instantáneo', '100% seguro']
    },
    {
      id: 'tarjeta',
      title: 'Tarjeta Física',
      description: 'El mozo traerá el posnet',
      icon: <CreditCard className="w-5 h-5" />,
      action: () => handleWaiterNotification('pago_tarjeta'),
      buttonText: 'Solicitar Posnet',
      message: 'Llegará en 2-3 minutos',
      color: 'text-gray-600',
      features: ['Acepta todas las tarjetas', 'Pago en cuotas']
    },
    {
      id: 'efectivo',
      title: 'Efectivo',
      description: 'El mozo pasará a cobrar',
      icon: <DollarSign className="w-5 h-5" />,
      action: () => handleWaiterNotification('pago_efectivo'),
      buttonText: 'Solicitar Cobro',
      message: 'Llegará en 2-3 minutos',
      color: 'text-gray-600',
      features: ['Pago directo', 'Sin comisiones']
    },
    {
      id: 'qr',
      title: 'QR del Mozo',
      description: 'Esperá que te acerque el QR',
      icon: <QrCode className="w-5 h-5" />,
      action: () => handleWaiterNotification('pago_qr'),
      buttonText: 'Solicitar QR',
      message: 'Llegará en 2-3 minutos',
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
              <div className="p-2 bg-gray-100 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Método de Pago
                </DialogTitle>
                <p className="text-gray-500 text-xs">
                  Elige cómo pagar
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
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-600" />
              Resumen
            </h3>
            <div className="space-y-2">
              {items.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 font-medium truncate flex-1 mr-2">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {items.length > 3 && (
                <div className="text-xs text-gray-500 text-center py-1">
                  +{items.length - 3} productos más
                </div>
              )}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mensajes de estado */}
          {successMessage && (
            <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{successMessage}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {selectedMethod === 'billetera' 
                    ? 'Completa el pago en la nueva pestaña' 
                    : 'El mozo llegará pronto'
                  }
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <X className="w-5 h-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Error en el pago</p>
                <p className="text-xs text-gray-600 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Opciones de pago con iconos más visibles */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-base mb-3">
              ¿Cómo quieres pagar?
            </h3>
            
            {paymentMethods.map((method) => (
              <Card 
                key={method.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md border ${
                  selectedMethod === method.id 
                    ? `ring-1 ring-gray-400 border-gray-400 bg-gray-50` 
                    : 'hover:border-gray-300 border-gray-200'
                }`}
                onClick={() => !isLoading && handleMethodSelect(method.id)}
              >
                <CardHeader className="pb-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-gray-900 text-white">
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
                        <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {feature}
                        </span>
                      ))}
                    </div>
                    
                    {method.message && (
                      <div className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg mb-3 flex items-center gap-2">
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
                      className="w-full font-semibold py-3 text-sm bg-gray-900 hover:bg-gray-800 text-white"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          {method.id === 'billetera' && <ExternalLink className="w-4 h-4 mr-2" />}
                          {method.buttonText}
                        </>
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Información de seguridad compacta */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                <Shield className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">
                  Pago Seguro
                </h4>
                <p className="text-gray-600 text-xs leading-relaxed">
                  Todos los métodos están protegidos. Tus datos están seguros.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 