"use client"

import { useCart } from "@/contexts/cart-context"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingBag } from "lucide-react"

export default function FloatingCartBar() {
  const { state } = useCart()
  
  // Solo mostrar si hay items en el carrito
  if (state.items.length === 0) {
    return null
  }

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-gray-900 to-gray-800 shadow-2xl border-t border-gray-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Total y cantidad de items */}
          <div className="flex flex-col">
            <span className="text-white/70 text-xs font-medium">Total ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
            <span className="text-white text-2xl font-bold">
              ${state.total.toFixed(0)}
            </span>
          </div>

          {/* Right side - Botón de acción */}
          <Link href="/usuario/cart" className="flex-shrink-0">
            <Button 
              size="lg"
              className="rounded-full bg-green-500 hover:bg-green-600 text-white px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3"
            >
              <ShoppingBag className="w-5 h-5" />
              Ver mi Pedido
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
