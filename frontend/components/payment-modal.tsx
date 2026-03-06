'use client'

import React from 'react'

import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'
import { formatSelectedOptionLabel, type SelectedProductOption } from '@/lib/product-options'
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
  Shield,
  Truck
} from 'lucide-react'
import AddressAutocomplete from './address-autocomplete'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onWaiterCalled?: (message: string) => void
  mesaId: string
  branchId: string
  mesaToken: string
  totalAmount: number
  promotionDiscountAmount?: number
  extraDiscountAmount?: number
  serviceChargeAmount?: number
  allowedPaymentMethods?: string[]
  items: Array<{
    id?: string
    lineId?: string
    name: string
    price: number
    quantity: number
    basePrice?: number
    selectedOptions?: SelectedProductOption[]
  }>
}

type PaymentMethod = 'billetera' | 'tarjeta' | 'efectivo' | 'qr'
type DeliveryType = 'DELIVERY' | 'TAKE_AWAY'

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

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  MERCADOPAGO: 'billetera',
  CARD: 'tarjeta',
  CASH: 'efectivo',
  QR: 'qr',
}

export default function PaymentModal({
  isOpen,
  onClose,
  onWaiterCalled,
  mesaId,
  branchId,
  mesaToken,
  totalAmount,
  promotionDiscountAmount = 0,
  extraDiscountAmount = 0,
  serviceChargeAmount = 0,
  allowedPaymentMethods,
  items
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryStreet, setDeliveryStreet] = useState('')
  const [deliveryNumber, setDeliveryNumber] = useState('')
  const [deliveryFloorApt, setDeliveryFloorApt] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null)
  const t = useTranslations('usuario.payment')
  const isDelivery = mesaId === 'Delivery'
  const shouldShowDeliveryAddressForm = isDelivery && deliveryType === 'DELIVERY'
  
  // Detectar si los parámetros de mesa son inválidos
  const hasInvalidParams = !mesaId || !mesaToken || !branchId ||
    mesaId.toLowerCase() === 'null' || mesaToken.toLowerCase() === 'null' || branchId.toLowerCase() === 'null' ||
    mesaId.trim() === '' || mesaToken.trim() === '' || branchId.trim() === ''
  const subtotalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const promoDiscount = Math.max(0, promotionDiscountAmount)
  const extraDiscount = Math.max(0, extraDiscountAmount)
  const serviceCharge = Math.max(0, serviceChargeAmount)
  const hasSummaryAdjustments = promoDiscount > 0 || extraDiscount > 0 || serviceCharge > 0

  const handleBilleteraPayment = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    
    // Validar que mesaId y mesaToken sean validos
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
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Variables de entorno de Supabase no configuradas')
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-payment-preference`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mesa_id: mesaId,
            token: mesaToken,
            items: items.map(item => ({
              id: item.id,
              lineId: item.lineId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              basePrice: item.basePrice ?? item.price,
              selectedOptions: item.selectedOptions || [],
            })),
            total_amount: totalAmount,
            ...(isDelivery && deliveryType ? { delivery_type: deliveryType } : {}),
            ...(shouldShowDeliveryAddressForm && customerPhone ? { customer_phone: customerPhone } : {}),
            ...(shouldShowDeliveryAddressForm && deliveryStreet
              ? { delivery_address: `${deliveryStreet} ${deliveryNumber}`.trim() }
              : {}),
            ...(shouldShowDeliveryAddressForm && deliveryFloorApt
              ? { delivery_floor_apt: deliveryFloorApt }
              : {}),
            ...(shouldShowDeliveryAddressForm && deliveryInstructions
              ? { delivery_instructions: deliveryInstructions }
              : {}),
          }),
        }
      )

      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data.error || `Error ${response.status}: ${response.statusText}`
        throw new Error(errorMsg)
      }
      
      const paymentUrl = data.init_point
      
      if (data.success && paymentUrl) {
        window.open(paymentUrl, '_blank')
        setSuccessMessage(t('walletSuccess'))
      } else {
        throw new Error(data.error || t('payLinkError'))
      }
    } catch (error) {
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
      const { apiFetchTenant } = await import('@/lib/apiClient')
      await apiFetchTenant('/orders', {
        method: 'POST',
        body: JSON.stringify({
          mesa_id: mesaId,
          branch_id: branchId,
          items: items.map(item => ({
            id: item.id,
            lineId: item.lineId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            basePrice: item.basePrice ?? item.price,
            selectedOptions: item.selectedOptions || [],
          })),
          token: mesaToken,
          payment_method: paymentMethod,
          ...(isDelivery && deliveryType ? { delivery_type: deliveryType } : {}),
          ...(shouldShowDeliveryAddressForm && customerPhone ? { customer_phone: customerPhone } : {}),
          ...(shouldShowDeliveryAddressForm && deliveryStreet
            ? { delivery_address: `${deliveryStreet} ${deliveryNumber}`.trim() }
            : {}),
          ...(shouldShowDeliveryAddressForm && deliveryFloorApt
            ? { delivery_floor_apt: deliveryFloorApt }
            : {}),
          ...(shouldShowDeliveryAddressForm && deliveryInstructions
            ? { delivery_instructions: deliveryInstructions }
            : {}),
        }),
      })
      
      const message = isDelivery ? t('deliveryOrderConfirmed') : t('successWaiter')
      toast({
        title: isDelivery ? t('deliveryOrderConfirmedTitle') : t('waiterCalledTitle'),
        description: message
      })
      if (onWaiterCalled) {
        onWaiterCalled(message)
        handleClose()
      } else {
        setSuccessMessage(message)
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
      description: isDelivery ? t('deliveryCashDescription') : t('cashDescription'),
      icon: <DollarSign className="w-5 h-5" />,
      action: () => handleWaiterNotification('CASH'),
      buttonText: isDelivery ? t('deliveryRequestCash') : t('requestCash'),
      message: isDelivery ? t('deliveryCashMessage') : t('cashMessage'),
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

  const DELIVERY_ALLOWED_METHODS: PaymentMethod[] = ['billetera', 'efectivo']

  const filteredPaymentMethods = (() => {
    let methods = allowedPaymentMethods
      ? paymentMethods.filter((m) => {
          const allowedIds = allowedPaymentMethods.map((key) => PAYMENT_METHOD_MAP[key]).filter(Boolean)
          return allowedIds.includes(m.id)
        })
      : paymentMethods
    if (isDelivery) {
      methods = methods.filter((m) => DELIVERY_ALLOWED_METHODS.includes(m.id))
    }
    return methods
  })()

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  const handleMethodAction = async (method: PaymentMethod) => {
    if (isLoading) return
    if (isDelivery) {
      if (!deliveryType) {
        setErrorMessage(t('deliveryTypeRequired'))
        return
      }
      if (deliveryType === 'TAKE_AWAY') {
        const selectedOption = paymentMethods.find(m => m.id === method)
        if (selectedOption) {
          await selectedOption.action()
        }
        return
      }
      if (!customerPhone.trim()) {
        setErrorMessage(t('deliveryPhoneRequired'))
        return
      }
      if (!deliveryStreet.trim()) {
        setErrorMessage(t('deliveryStreetRequired'))
        return
      }
      if (!deliveryNumber.trim()) {
        setErrorMessage(t('deliveryNumberRequired'))
        return
      }
    }
    const selectedOption = paymentMethods.find(m => m.id === method)
    if (selectedOption) {
      await selectedOption.action()
    }
  }

  const handleClose = () => {
    setSelectedMethod(null)
    setSuccessMessage(null)
    setErrorMessage(null)
    setCustomerPhone('')
    setDeliveryStreet('')
    setDeliveryNumber('')
    setDeliveryFloorApt('')
    setDeliveryInstructions('')
    setDeliveryType(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md mx-auto p-0 overflow-hidden bg-white rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header con botón de cierre */}
        <DialogHeader className="bg-white text-gray-900 p-4 border-b">
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
                <div key={index} className="text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium truncate flex-1 mr-2">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="text-gray-900 font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {item.selectedOptions.map((option) => (
                        <p key={`${item.name}-${option.groupId}-${option.id}`} className="text-[11px] text-gray-500 pl-1">
                          • {formatSelectedOptionLabel(option)}
                          {option.priceAddition > 0 ? ` (+$${option.priceAddition.toFixed(2)})` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {items.length > 3 && (
                <div className="text-xs text-gray-500 text-center py-1">
                  {t('moreItems', {count: items.length - 3})}
                </div>
              )}
              {hasSummaryAdjustments && (
                <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">{t('subtotal')}</span>
                    <span className="text-gray-900">${subtotalAmount.toFixed(2)}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-green-700 font-medium">{t('promoSavings')}</span>
                      <span className="text-green-700 font-semibold">-${promoDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {extraDiscount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">{t('otherDiscounts')}</span>
                      <span className="text-gray-900">-${extraDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {serviceCharge > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">{t('serviceFee')}</span>
                      <span className="text-gray-900">${serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
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

          {/* Tipo de pedido delivery/take away */}
          {isDelivery && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-blue-900 text-sm">{t('deliveryTypeTitle')}</h3>
              </div>
              <p className="text-xs text-blue-700">{t('deliveryTypeSubtitle')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    deliveryType === 'TAKE_AWAY'
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-blue-200 bg-white text-blue-900 hover:bg-blue-100'
                  }`}
                  onClick={() => setDeliveryType('TAKE_AWAY')}
                >
                  {t('takeAwayOption')}
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    deliveryType === 'DELIVERY'
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-blue-200 bg-white text-blue-900 hover:bg-blue-100'
                  }`}
                  onClick={() => setDeliveryType('DELIVERY')}
                >
                  {t('deliveryOption')}
                </button>
              </div>

              {deliveryType === 'TAKE_AWAY' && (
                <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-blue-800">
                  {t('takeAwayNoAddressHint')}
                </div>
              )}

              {shouldShowDeliveryAddressForm && (
                <>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">
                      {t('customerPhone')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                      placeholder={t('customerPhonePlaceholder')}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-600 mb-1 block">
                        {t('deliveryStreet')} <span className="text-red-500">*</span>
                      </label>
                      <AddressAutocomplete
                        value={deliveryStreet}
                        onChange={setDeliveryStreet}
                        placeholder={t('deliveryStreetPlaceholder')}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">
                        {t('deliveryNumber')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                        placeholder={t('deliveryNumberPlaceholder')}
                        value={deliveryNumber}
                        onChange={(e) => setDeliveryNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">{t('deliveryFloorApt')}</label>
                    <input
                      type="text"
                      className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                      placeholder={t('deliveryFloorAptPlaceholder')}
                      value={deliveryFloorApt}
                      onChange={(e) => setDeliveryFloorApt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">{t('deliveryInstructions')}</label>
                    <textarea
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                      rows={2}
                      placeholder={t('deliveryInstructionsPlaceholder')}
                      value={deliveryInstructions}
                      onChange={(e) => setDeliveryInstructions(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Opciones de pago con iconos más visibles */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-base mb-3">
              {t('howPay')}
            </h3>
            
            {filteredPaymentMethods.map((method) => (
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
