"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PaymentErrorPage() {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
            <p className="text-muted-foreground mb-4">
              {getErrorMessage()}
            </p>
            <p className="text-sm text-muted-foreground">
              {getErrorDescription()}
            </p>
          </div>
          
          <div className="flex flex-col gap-2 pt-4">
            <Link href="/usuario">
              <Button className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Menú
              </Button>
            </Link>
            
            <Link href="/">
              <Button variant="outline" className="w-full">
                Ir al Inicio
              </Button>
            </Link>
          </div>
          
          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground">
              Si el problema persiste, contacta al local directamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 