'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Loader2, CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react'

interface PaymentHandlerProps {
  mesaId: string
  mesaToken: string
  items: Array<{
    name: string
    price: number
    quantity: number
  }>
  totalAmount: number
  onPaymentComplete?: (orderId: string, status: string) => void
  onPaymentError?: (error: string) => void
}

interface PaymentResponse {
  success: boolean
  order_id: string
  token: string
  init_point: string
  preference_id: string
  total_amount: number
}

export function PaymentHandler({
  mesaId,
  mesaToken,
  items,
  totalAmount,
  onPaymentComplete,
  onPaymentError
}: PaymentHandlerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <p className="text-red-600">Error: Variables de entorno de Supabase no configuradas</p>
        </CardContent>
      </Card>
    )
  }

  const createPaymentPreference = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-preference`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mesa_id: mesaId,
          token: mesaToken,
          items: items.map(item => ({
            id: (item as any).id || '',
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          total_amount: totalAmount
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setPaymentUrl(data.init_point)
        // Redirect to Mercado Pago
        window.location.href = data.init_point
      } else {
        throw new Error(data.error || 'Error al crear la preferencia de pago')
      }
    } catch (error) {
      onPaymentError?.(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualRedirect = () => {
    if (paymentUrl) {
      window.location.href = paymentUrl
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Pago con Mercado Pago
        </CardTitle>
        <CardDescription>
          Total a pagar: ${totalAmount.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Resumen del pedido:</h4>
          <div className="space-y-1">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.name} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-medium">
                <span>Total:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={createPaymentPreference}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pagar con Mercado Pago
            </>
          )}
        </Button>

        {paymentUrl && (
          <Button
            onClick={handleManualRedirect}
            variant="outline"
            className="w-full"
          >
            Ir a Mercado Pago
          </Button>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Serás redirigido a Mercado Pago para completar el pago de forma segura
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para mostrar el estado del pago
export function PaymentStatus({ status, orderId }: { status: string; orderId: string }) {
  const getStatusInfo = () => {
    switch (status) {
      case 'PAYMENT_APPROVED':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-500" />,
          title: '¡Pago Aprobado!',
          description: 'Tu pedido ha sido confirmado y está siendo preparado.',
          color: 'text-green-600'
        }
      case 'PAYMENT_REJECTED':
        return {
          icon: <XCircle className="w-8 h-8 text-red-500" />,
          title: 'Pago Rechazado',
          description: 'Hubo un problema con el pago. Por favor, intenta nuevamente.',
          color: 'text-red-600'
        }
      case 'PAYMENT_PENDING':
        return {
          icon: <Clock className="w-8 h-8 text-yellow-500" />,
          title: 'Pago Pendiente',
          description: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          color: 'text-yellow-600'
        }
      default:
        return {
          icon: <Clock className="w-8 h-8 text-gray-500" />,
          title: 'Estado Desconocido',
          description: 'No se pudo determinar el estado del pago.',
          color: 'text-gray-600'
        }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          {statusInfo.icon}
        </div>
        <CardTitle className={statusInfo.color}>
          {statusInfo.title}
        </CardTitle>
        <CardDescription>
          {statusInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          ID del pedido: {orderId}
        </p>
      </CardContent>
    </Card>
  )
} 