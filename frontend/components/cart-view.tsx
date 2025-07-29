"use client"

import { useState } from "react"
import { ArrowLeft, Minus, Plus, Trash2, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/contexts/cart-context"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import CallWaiterModal from "./call-waiter-modal"

export default function CartView() {
  const { state, updateQuantity, removeItem, clearCart } = useCart()
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  // Mantener exactamente la misma lógica de pago que ya tienes
  const handlePayment = async () => {
    setError("")
    setSuccess("")
    if (!mesa_id || !token) {
      setError("Faltan datos de la mesa o token QR.")
      return
    }
    setLoading(true)
    try {
      // Crear preferencia de pago en Mercado Pago
      const response = await fetch("http://localhost:5001/payment/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_amount: state.total,
          items: state.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          mesa_id: mesa_id
        }),
      })
      
      const data = await response.json()
      if (response.ok && data.success) {
        // Redirigir a Mercado Pago
        window.location.href = data.init_point
      } else {
        setError(data.error || "Error al procesar el pago")
      }
    } catch (e) {
      setError("No se pudo conectar con el servidor de pagos")
    } finally {
      setLoading(false)
    }
  }

  const handleCallWaiter = () => {
    setShowCallWaiterModal(true)
  }

  const handleConfirmCallWaiter = () => {
    console.log("Llamando al mozo desde el carrito...")
    alert("¡Mozo llamado! Te atenderemos en breve.")
    setShowCallWaiterModal(false)
  }

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/usuario">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Carrito</h1>
              </div>
              <Button 
                onClick={handleCallWaiter}
                variant="ghost" 
                size="icon" 
                className="rounded-full"
              >
                <Bell className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4 opacity-30">🛒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tu carrito está vacío</h2>
          <p className="text-gray-500 mb-6">Agrega algunos productos deliciosos para comenzar</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/usuario">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Carrito</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
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
                className="rounded-full"
              >
                <Bell className="w-5 h-5" />
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
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
                  <p className="text-xs text-gray-500">{item.description || "Delicioso platillo"}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-red-500">${item.price.toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full border-gray-200"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      
                      <span className="font-semibold text-gray-900 min-w-[30px] text-center">
                        {item.quantity}
                      </span>
                      
                      <Button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        size="icon"
                        className="h-8 w-8 rounded-full bg-gray-900 hover:bg-gray-800"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky bottom-4">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Items seleccionados</span>
              <span className="font-semibold">${state.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cargo por servicio</span>
              <span className="font-semibold">$0.00</span>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-red-500">${state.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handlePayment}
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-2xl font-semibold text-base"
          >
            {loading ? "Procesando..." : "Proceder al Pago"}
          </Button>
        </div>
      </div>

      <CallWaiterModal
        isOpen={showCallWaiterModal}
        onConfirm={handleConfirmCallWaiter}
        onCancel={() => setShowCallWaiterModal(false)}
      />
    </div>
  )
}
