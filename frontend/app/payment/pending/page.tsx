"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, AlertCircle } from "lucide-react"
import Link from "next/link"

interface OrderStatus {
  order_id: number
  status: string
  payment_status: string
  total_amount: number
  created_at: string
}

function PaymentPendingContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrderStatus()
      // Polling cada 10 segundos para verificar cambios de estado
      const interval = setInterval(fetchOrderStatus, 10000)
      return () => clearInterval(interval)
    }
  }, [orderId])

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch(`http://localhost:5001/payment/order-status/${orderId}`)
      if (response.ok) {
        const data = await response.json()
        setOrderStatus(data)
        
        // Si el pago ya no está pendiente, redirigir
        if (data.payment_status !== "pending") {
          window.location.href = `/payment/success?order_id=${orderId}`
        }
      } else {
        setError("Error al obtener el estado del pedido")
      }
    } catch (error) {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-3 text-gray-700">Verificando estado del pago...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/">
              <Button className="bg-gray-900 hover:bg-gray-800">Volver al inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Clock className="w-12 h-12 text-orange-500" />
          </div>
          <CardTitle className="text-xl text-gray-900">
            Pago en Proceso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Tu pago está siendo procesado. Esto puede tomar unos minutos.
            </p>
            <p className="text-sm text-gray-600">
              Te notificaremos automáticamente cuando el pago se confirme.
            </p>
            
            {orderStatus && (
              <div className="space-y-2 text-sm mt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pedido #:</span>
                  <span className="font-medium text-gray-900">{orderStatus.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-medium text-gray-900">${orderStatus.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className="font-medium text-orange-600">Pendiente</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-orange-800 mb-1">¿Qué hacer ahora?</p>
                <ul className="text-orange-700 space-y-1">
                  <li>• No cierres esta página</li>
                  <li>• Espera a que se confirme el pago</li>
                  <li>• Si pasan más de 10 minutos, contacta al local</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-4">
            <Link href="/usuario">
              <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50">
                Volver al Menú
              </Button>
            </Link>
            
            <p className="text-xs text-gray-600 text-center">
              Esta página se actualizará automáticamente cuando el pago se confirme.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-3 text-gray-700">Cargando...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentPendingContent />
    </Suspense>
  )
} 