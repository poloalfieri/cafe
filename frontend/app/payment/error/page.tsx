"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

function PaymentErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get("message")

  const getErrorMessage = () => {
    switch (message) {
      case "payment_failed":
        return "El pago no pudo ser procesado. Por favor, intenta nuevamente."
      case "order_not_found":
        return "No se encontró el pedido. Contacta al local si el problema persiste."
      case "missing_parameters":
        return "Información de pago incompleta. Intenta realizar el pedido nuevamente."
      case "payment_info_error":
        return "Error al verificar el pago. Contacta al local para confirmar."
      case "internal_error":
        return "Error interno del sistema. Por favor, intenta más tarde."
      default:
        return "Ocurrió un error durante el proceso de pago. Por favor, intenta nuevamente."
    }
  }

  const getErrorDescription = () => {
    switch (message) {
      case "payment_failed":
        return "El pago fue rechazado por el proveedor de pagos. Verifica que tu método de pago esté habilitado."
      case "order_not_found":
        return "El pedido no existe en nuestro sistema. Esto puede ocurrir si hubo un problema de conexión."
      case "missing_parameters":
        return "Faltan datos necesarios para procesar el pago. Intenta realizar el pedido desde el inicio."
      case "payment_info_error":
        return "No pudimos verificar el estado del pago. El local podrá confirmar si el pago fue exitoso."
      case "internal_error":
        return "Nuestro sistema experimentó un problema temporal. Intenta en unos minutos."
      default:
        return "Algo salió mal durante el proceso de pago. Te recomendamos intentar nuevamente."
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <CardTitle className="text-xl text-red-600">
            Error en el Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              {getErrorMessage()}
            </p>
            <p className="text-sm text-gray-600">
              {getErrorDescription()}
            </p>
          </div>
          
          <div className="flex flex-col gap-2 pt-4">
            <Link href="/">
              <Button className="w-full bg-gray-900 hover:bg-gray-800">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Menú
              </Button>
            </Link>
            
            <Link href="/">
              <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50">
                Ir al Inicio
              </Button>
            </Link>
          </div>
          
          <div className="text-center pt-4">
            <p className="text-xs text-gray-600">
              Si el problema persiste, contacta al local directamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentErrorPage() {
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
      <PaymentErrorContent />
    </Suspense>
  )
} 