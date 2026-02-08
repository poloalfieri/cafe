"use client"

import { useState } from "react"
import { ArrowLeft, Minus, Plus, Trash2, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/contexts/cart-context"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import CallWaiterModal from "./call-waiter-modal"
import PaymentModal from "./payment-modal"

export default function CartView() {
  const { state, updateQuantity, removeItem, clearCart } = useCart()
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showWaiterNotice, setShowWaiterNotice] = useState(false)
  const [waiterNoticeMessage, setWaiterNoticeMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  const getMesaSession = (): { mesa_id: string | null; token: string | null } => {
    if (mesa_id && token) return { mesa_id, token }
    if (typeof window === "undefined") return { mesa_id, token }
    try {
      const stored = sessionStorage.getItem("mesa_session")
      if (!stored) return { mesa_id, token }
      const parsed = JSON.parse(stored)
      return {
        mesa_id: typeof parsed?.mesa_id === "string" ? parsed.mesa_id : mesa_id,
        token: typeof parsed?.token === "string" ? parsed.token : token
      }
    } catch {
      return { mesa_id, token }
    }
  }
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'
  const mesaSession = getMesaSession()

  const handlePaymentComplete = (orderId: string, status: string) => {
    setSuccess(`Pago procesado. ID del pedido: ${orderId}`)
    // Aquí podrías limpiar el carrito o hacer otras acciones
  }

  const handlePaymentError = (error: string) => {
    setError(error)
  }

  const handleCallWaiter = () => {
    setShowCallWaiterModal(true)
  }

  const handleWaiterCalled = (message: string) => {
    setShowPaymentModal(false)
    clearCart()
    setWaiterNoticeMessage(message)
    setShowWaiterNotice(true)
  }

  const handleConfirmCallWaiter = async (data: { message?: string, paymentMethod: 'CARD' | 'CASH' | 'QR' }): Promise<void> => {
    try {
      const session = getMesaSession()
      if (!session.mesa_id || !session.token) {
        setShowCallWaiterModal(false)
        return
      }
      
      const response = await fetch(`${backendUrl}/waiter/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          mesa_id: session.mesa_id,
          token: session.token,
          payment_method: data.paymentMethod,
          message: data.message || ""
        }),
      })

      if (response.ok) {
        // Llamada al mozo exitosa
      } else {
        // Error ya manejado silenciosamente
      }
    } catch (error) {
      // Error ya manejado silenciosamente
    } finally {
      setShowCallWaiterModal(false)
    }
  }

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/usuario">
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                  </Button>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Carrito</h1>
              </div>
              <Button 
                onClick={handleCallWaiter}
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-gray-100"
              >
                <Bell className="w-5 h-5 text-gray-700" />
              </Button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4 opacity-30">🛒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tu carrito está vacío</h2>
          <p className="text-gray-600 mb-6">Agrega algunos productos deliciosos para comenzar</p>
          <Link href="/usuario">
            <Button className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-full">
              Ver Menú
            </Button>
          </Link>
        </div>

        <CallWaiterModal
          isOpen={showCallWaiterModal}
          onConfirm={handleConfirmCallWaiter}
          onCancel={() => setShowCallWaiterModal(false)}
        />
      </div>
    )
  }

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/usuario">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100">
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Carrito</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
                {totalItems}
              </span>
              <Button 
                onClick={clearCart}
                variant="ghost"
                size="icon"
                className="rounded-full text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button 
                onClick={handleCallWaiter}
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-gray-100"
              >
                <Bell className="w-5 h-5 text-gray-700" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Error/Success messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {state.items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4">
                {/* Product Image */}
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <span className="text-2xl">🍽️</span>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.name}</h3>
                  <p className="text-xs text-gray-600">{item.description || "Delicioso platillo"}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-red-600">${item.price.toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full border-gray-300 hover:bg-gray-50"
                      >
                        <Minus className="w-3 h-3 text-gray-700" />
                      </Button>
                      
                      <span className="font-semibold text-gray-900 min-w-[30px] text-center">
                        {item.quantity}
                      </span>
                      
                      <Button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        size="icon"
                        className="h-8 w-8 rounded-full bg-gray-900 hover:bg-gray-800"
                      >
                        <Plus className="w-3 h-3 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botón "Buscar más productos" con flecha hacia atrás */}
        <div className="mb-6">
          <Link href="/usuario">
            <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Buscar más productos
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer fijo con total del pedido - solo visible cuando hay productos */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="container mx-auto px-4 py-4">
          {/* Resumen del pedido */}
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            
            {/* Fila de descuentos - solo visible si existen */}
            {state.discounts > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Descuentos</span>
                <span className="font-semibold text-green-600">-${state.discounts.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">Tarifa de servicio</span>
              <span className="font-semibold text-gray-900">${state.serviceCharge.toFixed(2)}</span>
            </div>
            
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-red-600">${state.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Botón de pago */}
          {mesaSession.mesa_id && mesaSession.token ? (
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold text-lg"
              size="lg"
            >
              Pagar ${state.total.toFixed(2)}
            </Button>
          ) : (
            <div className="text-center text-red-600 p-4">
              Error: Faltan datos de la mesa o token QR.
            </div>
          )}
        </div>
      </div>

      <CallWaiterModal
        isOpen={showCallWaiterModal}
        onConfirm={handleConfirmCallWaiter}
        onCancel={() => setShowCallWaiterModal(false)}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onWaiterCalled={handleWaiterCalled}
        mesaId={mesaSession.mesa_id || ''}
        mesaToken={mesaSession.token || ''}
        totalAmount={state.total}
        items={state.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))}
      />

      {showWaiterNotice && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Mozo en camino</h3>
            <p className="text-sm text-gray-600 mt-2">
              {waiterNoticeMessage || "Ya se notificó al mozo. Se acercará a tu mesa en la brevedad."}
            </p>
            <Button
              onClick={() => {
                setShowWaiterNotice(false)
                router.push("/usuario")
              }}
              className="mt-4 w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Volver al menú
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
