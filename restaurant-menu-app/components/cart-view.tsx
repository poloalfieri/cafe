"use client"

import { useState } from "react"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"
import CartItem from "@/components/cart-item"
import CallWaiterModal from "@/components/call-waiter-modal"
import { ArrowLeft, CreditCard, Trash2, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CartView() {
  const { state, clearCart } = useCart()
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false)

  const handlePayment = () => {
    // Función vacía para implementar el sistema de pago más adelante
    console.log("Procesando pago...", state)
    alert(`Procesando pago por $${state.total.toFixed(2)}. Función de pago por implementar.`)
  }

  const handleCallWaiter = () => {
    setShowCallWaiterModal(true)
  }

  const handleConfirmCallWaiter = () => {
    console.log("Llamando al mozo desde el carrito...")
    alert("¡Mozo llamado! Te atenderemos en breve.")
    setShowCallWaiterModal(false)
  }

  const handleCancelCallWaiter = () => {
    setShowCallWaiterModal(false)
  }

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" className="mr-2 sm:mr-4 p-2 touch-manipulation">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">Tu Carrito</h1>
            </div>

            <Button
              onClick={handleCallWaiter}
              variant="outline"
              size="sm"
              className="text-primary border-primary/20 hover:bg-primary/5 px-2 sm:px-4 touch-manipulation bg-transparent"
            >
              <Bell className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Mozo</span>
            </Button>
          </div>

          <div className="text-center py-8 sm:py-12">
            <div className="text-5xl sm:text-6xl mb-4 opacity-30">🛒</div>
            <h2 className="text-lg sm:text-xl font-semibold text-text mb-2">Tu carrito está vacío</h2>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base px-4">
              Agrega algunos productos deliciosos para comenzar
            </p>
            <Link href="/">
              <Button className="bg-accent hover:bg-accent-hover text-white px-6 py-3 text-sm sm:text-base">
                Ver Menú
              </Button>
            </Link>
          </div>
        </div>

        <CallWaiterModal
          isOpen={showCallWaiterModal}
          onConfirm={handleConfirmCallWaiter}
          onCancel={handleCancelCallWaiter}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-6">
      {/* Header - Sticky en móvil */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="container mx-auto px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" className="mr-2 sm:mr-4 p-2 touch-manipulation">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-primary">Tu Carrito</h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {state.items.length} {state.items.length === 1 ? "producto" : "productos"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleCallWaiter}
                variant="outline"
                size="sm"
                className="text-primary border-primary/20 hover:bg-primary/5 px-2 sm:px-4 touch-manipulation bg-transparent"
              >
                <Bell className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Mozo</span>
              </Button>

              <Button
                onClick={clearCart}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 bg-transparent text-xs sm:text-sm px-2 sm:px-4 touch-manipulation"
              >
                <Trash2 className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Lista de productos */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          {state.items.map((item) => (
            <CartItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Resumen - Fijo en la parte inferior en móvil */}
      <div className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto bg-background border-t sm:border-t-0 border-border sm:bg-transparent">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-0">
          <div className="bg-card rounded-none sm:rounded-lg p-4 sm:p-6 shadow-none sm:shadow-md border-0 sm:border border-border">
            <div className="flex justify-between items-center mb-4">
              <span className="text-base sm:text-lg font-semibold text-text">Total:</span>
              <span className="text-xl sm:text-2xl font-bold text-primary">${state.total.toFixed(2)}</span>
            </div>

            <Button
              onClick={handlePayment}
              className="w-full bg-secondary hover:bg-secondary-hover text-white py-3 sm:py-4 text-base sm:text-lg font-medium touch-manipulation"
            >
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Ir a pagar
            </Button>
          </div>
        </div>
      </div>

      <CallWaiterModal
        isOpen={showCallWaiterModal}
        onConfirm={handleConfirmCallWaiter}
        onCancel={handleCancelCallWaiter}
      />
    </div>
  )
}
