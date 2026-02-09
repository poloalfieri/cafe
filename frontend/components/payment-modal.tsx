'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'
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
  onWaiterCalled?: (message: string) => void
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
  onWaiterCalled, 
  mesaId, 
  mesaToken, 
  totalAmount, 
  items 
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const t = useTranslations('usuario.payment')
  
  // Detectar si los parámetros de mesa son inválidos
  const hasInvalidParams = !mesaId || !mesaToken || 
    mesaId.toLowerCase() === 'null' || mesaToken.toLowerCase() === 'null' ||
    mesaId.trim() === '' || mesaToken.trim() === ''

  const handleBilleteraPayment = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    
    // Validar que mesaId y mesaToken sean válidos
    if (!isValidParam(mesaId)) {
      setErrorMessage(t('errorMesa'))
      setIsLoading(false)
      return
    }
    
    if (!isValidParam(mesaToken)) {
      setErrorMessage(t('errorToken'))
      setIsLoading(false)
      return
    }
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'
      const response = await fetch(`${backendUrl}/payment/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Enviar token en header Authorization para mayor seguridad (no aparece en logs/URLs)
          'Authorization': `Bearer ${mesaToken}`,
        },
        body: JSON.stringify({
          monto: totalAmount,
          mesa_id: mesaId,
          token: mesaToken,  // También en body para compatibilidad con código legacy
          items: items,  // Enviar items reales del carrito
          descripcion: `Pedido Mesa ${mesaId} - ${items.map(item => `${item.name} x${item.quantity}`).join(', ')}`
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data.error || `Error ${response.status}: ${response.statusText}`
        throw new Error(errorMsg)
      }
      
      // Soportar tanto init_point como payment_link (compatibilidad)
      const paymentUrl = data.init_point || data.payment_link
      
      if (data.success && paymentUrl) {
        window.open(paymentUrl, '_blank')
        setSuccessMessage(t('walletSuccess'))
      } else {
        throw new Error(data.error || t('payLinkError'))
      }
    } catch (error) {
      // Error ya manejado por setErrorMessage
      setErrorMessage(error instanceof Error ? error.message : t('unknownError'))
    } finally {
      setIsLoading(false)
    }
  }

  // Helper para validar que un valor no sea null/undefined/empty/"null"
  const isValidParam = (value: string | null | undefined): boolean => {
    if (!value) return false
    const trimmed = value.trim().toLowerCase()
    return trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined'
  }

  const handleWaiterNotification = async (paymentMethod: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    
    // Validar que mesaId y mesaToken sean validos antes de enviar
    if (!isValidParam(mesaId)) {
      setErrorMessage(t('errorMesa'))
      setIsLoading(false)
      return
    }
    
    if (!isValidParam(mesaToken)) {
      setErrorMessage(t('errorToken'))
      setIsLoading(false)
      return
    }
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'
      const response = await fetch(`${backendUrl}/waiter/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mesaToken}`,
        },
        body: JSON.stringify({
          mesa_id: mesaId,
          token: mesaToken,
          payment_method: paymentMethod,
          message: `Solicitud de pago - ${paymentMethod}`
        }),
      })

      const data = await response.json()
      
      // Manejar respuestas de error del backend
      if (!response.ok) {
        const errorMsg = data.error || `Error ${response.status}: ${response.statusText}`
        throw new Error(errorMsg)
      }
      
      if (data.success) {
        const message = t('successWaiter')
        toast({
          title: t('waiterCalledTitle'),
          description: message
        })
        if (onWaiterCalled) {
          onWaiterCalled(message)
          handleClose()
        } else {
          setSuccessMessage(message)
        }
      } else {
        throw new Error(data.error || t('waiterNotifyError'))
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('unknownError'))
    } finally {
      setIsLoading(false)
    }
  }

  const paymentMethods: PaymentMethodOption[] = [
    {
      id: 'billetera',
      title: t('walletTitle'),
      description: t('walletDescription'),
      icon: <Wallet className="w-5 h-5" />,
      action: handleBilleteraPayment,
      buttonText: t('payNow'),
      color: 'text-gray-600',
      features: [t('instantPay'), t('secure')]
    },
    {
      id: 'tarjeta',
      title: t('cardTitle'),
      description: t('cardDescription'),
      icon: <CreditCard className="w-5 h-5" />,
      action: () => handleWaiterNotification('CARD'),
      buttonText: t('requestPos'),
      message: t('posMessage'),
      color: 'text-gray-600',
      features: [t('allCards'), t('installments')]
    },
    {
      id: 'efectivo',
      title: t('cashTitle'),
      description: t('cashDescription'),
      icon: <DollarSign className="w-5 h-5" />,
      action: () => handleWaiterNotification('CASH'),
      buttonText: t('requestCash'),
      message: t('cashMessage'),
      color: 'text-gray-600',
      features: [t('directPay'), t('noFees')]
    },
    {
      id: 'qr',
      title: t('qrTitle'),
      description: t('qrDescription'),
      icon: <QrCode className="w-5 h-5" />,
      action: () => handleWaiterNotification('QR'),
      buttonText: t('requestCash'),
      message: t('cashMessage'),
      color: 'text-gray-600',
      features: [t('mobilePay'), t('fastScan')]
    }
  ]

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  const handleMethodAction = async (method: PaymentMethod) => {
    if (isLoading) return
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
                  {t('methodTitle')}
                </DialogTitle>
                <p className="text-gray-500 text-xs">
                  {t('methodSubtitle')}
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
          {/* Advertencia si faltan parámetros */}
          {hasInvalidParams && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <X className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{t('configErrorTitle')}</p>
                <p className="text-xs text-red-600 mt-1">
                  {t('configErrorBody')}
                </p>
              </div>
            </div>
          )}
          
          {/* Resumen compacto */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-600" />
              {t('summaryTitle')}
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
                  {t('moreItems', {count: items.length - 3})}
                </div>
              )}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">{t('total')}</span>
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
                    ? t('successPayNewTab') 
                    : t('successWait')
                  }
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <X className="w-5 h-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{t('errorPaymentTitle')}</p>
                <p className="text-xs text-gray-600 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Opciones de pago con iconos más visibles */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-base mb-3">
              {t('howPay')}
            </h3>
            
            {paymentMethods.map((method) => (
              <Card 
                key={method.id}
                className={`transition-all duration-200 border ${
                  hasInvalidParams 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:shadow-md'
                } ${
                  selectedMethod === method.id 
                    ? `ring-1 ring-gray-400 border-gray-400 bg-gray-50` 
                    : 'hover:border-gray-300 border-gray-200'
                }`}
                onClick={() => !isLoading && !hasInvalidParams && handleMethodSelect(method.id)}
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
                        handleMethodAction(method.id)
                      }}
                      disabled={isLoading}
                      className="w-full font-semibold py-3 text-sm bg-gray-900 hover:bg-gray-800 text-white"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('processing')}
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
                  {t('secureTitle')}
                </h4>
                <p className="text-gray-600 text-xs leading-relaxed">
                  {t('secureBody')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 
