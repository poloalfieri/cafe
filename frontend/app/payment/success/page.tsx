"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"

interface OrderStatus {
  order_id: number
  status: string
  payment_status: string
  total_amount: number
  created_at: string
  payment_approved_at: string | null
  payment_rejected_at: string | null
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const token = searchParams.get("token")
  
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrderStatus()
      // Polling cada 5 segundos para verificar cambios de estado
      const interval = setInterval(fetchOrderStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [orderId])

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch(`http://localhost:5001/payment/order-status/${orderId}`)
      if (response.ok) {
        const data = await response.json()
        setOrderStatus(data)
      } else {
        setError("Error al obtener el estado del pedido")
      }
    } catch (error) {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = () => {
    if (!orderStatus) return <Clock className="w-8 h-8 text-blue-500" />
    
    switch (orderStatus.status) {
      case "PAYMENT_APPROVED":
        return <CheckCircle className="w-8 h-8 text-green-500" />
      case "IN_PREPARATION":
        return <Clock className="w-8 h-8 text-orange-500" />
      case "READY":
        return <CheckCircle className="w-8 h-8 text-green-500" />
      case "PAYMENT_REJECTED":
        return <AlertCircle className="w-8 h-8 text-red-500" />
      default:
        return <Clock className="w-8 h-8 text-blue-500" />
    }
  }

  const getStatusMessage = () => {
    if (!orderStatus) return "Verificando estado del pedido..."
    
    switch (orderStatus.status) {
      case "PAYMENT_APPROVED":
        return "¡Pago exitoso! Tu pedido está siendo revisado por el local."
      case "IN_PREPARATION":
        return "¡Tu pedido fue aceptado! Está siendo preparado."
      case "READY":
        return "¡Tu pedido está listo! Puedes retirarlo."
      case "PAYMENT_REJECTED":
        return "El pedido fue rechazado. Se procesará el reembolso."
      default:
        return "Procesando tu pedido..."
    }
  }

  const getStatusDescription = () => {
    if (!orderStatus) return ""
    
    switch (orderStatus.status) {
      case "PAYMENT_APPROVED":
        return "El local revisará tu pedido y te notificará cuando esté listo."
      case "IN_PREPARATION":
        return "Tu pedido está siendo preparado. Te avisaremos cuando esté listo."
      case "READY":
        return "Tu pedido está listo para retirar. ¡Disfruta!"
      case "PAYMENT_REJECTED":
        return "El local no pudo aceptar tu pedido. El reembolso se procesará automáticamente."
      default:
        return "Estamos procesando tu pedido..."
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Verificando pago...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link href="/">
              <Button>Volver al inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-xl">
            {getStatusMessage()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {getStatusDescription()}
            </p>
            
            {orderStatus && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pedido #:</span>
                  <span className="font-medium">{orderStatus.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">${orderStatus.total_amount.toFixed(2)}</span>
                </div>
                {orderStatus.payment_approved_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pago confirmado:</span>
                    <span className="font-medium">
                      {new Date(orderStatus.payment_approved_at).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2 pt-4">
            <Link href="/">
              <Button variant="outline" className="w-full">
                Volver al inicio
              </Button>
            </Link>
            
            {orderStatus?.status === "PAYMENT_REJECTED" && (
              <p className="text-xs text-muted-foreground text-center">
                El reembolso se procesará automáticamente. Puede tardar hasta 5 días hábiles.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 