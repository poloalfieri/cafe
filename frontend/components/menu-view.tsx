"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"
import ProductCard from "@/components/product-card"
import CallWaiterModal from "@/components/call-waiter-modal"
import InstructionsModal from "@/components/instructions-modal"
import { ShoppingCart, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MenuView() {
  const { state } = useCart()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos")
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)

  useEffect(() => {
    setShowInstructionsModal(true)
  }, [])

  useEffect(() => {
    async function fetchMenu() {
      setLoading(true)
              try {
          const res = await fetch("http://localhost:5001/menu")
          console.log("Respuesta fetch:", res)
        if (!res.ok) throw new Error("Error al obtener el menú")
        const data = await res.json()
        console.log("Datos del menú:", data)
        setProducts(data)
      } catch (e) {
        console.error("Error al cargar el menú:", e)
        setError("No se pudo cargar el menú")
      } finally {
        setLoading(false)
      }
    }
    fetchMenu()
  }, [])

  const categories = [
    "Todos",
    ...Array.from(new Set(products.map((p: any) => p.category)))
  ]

  const filteredProducts =
    selectedCategory === "Todos"
      ? products
      : products.filter((p: any) => p.category === selectedCategory)

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)

  const handleCallWaiter = () => {
    setShowCallWaiterModal(true)
  }

  const handleConfirmCallWaiter = () => {
    console.log("Llamando al mozo...")
    alert("¡Mozo llamado! Te atenderemos en breve.")
    setShowCallWaiterModal(false)
  }

  const handleCancelCallWaiter = () => {
    setShowCallWaiterModal(false)
  }

  const handleCloseInstructions = () => {
    setShowInstructionsModal(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header minimalista - Espacio para logo */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo del restaurante */}
            <div className="flex items-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm sm:text-base">R</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-primary">Restaurante</h1>
            </div>
            {/* Botones de acción */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button onClick={handleCallWaiter} variant="outline" className="px-2 sm:px-3 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm border-primary/20 hover:bg-primary/5 touch-manipulation bg-transparent">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2 text-primary" />
                <span className="hidden sm:inline text-primary">Mozo</span>
              </Button>
              <Link href="/usuario/cart">
                <Button className="relative bg-accent hover:bg-accent-hover text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm touch-manipulation">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                  <span className="hidden sm:inline">Carrito</span>
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-secondary text-white text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-bold">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Filtros de categoría */}
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? "bg-primary text-white"
                  : "bg-card text-text hover:bg-card-hover border border-border"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        {/* Loading/Error */}
        {loading && <div className="text-center py-8">Cargando menú...</div>}
        {error && <div className="text-center text-red-500 py-8">{error}</div>}
        {/* Lista de productos */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProducts.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
      {/* Botón flotante para móvil cuando hay productos */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-20">
          <div className="flex gap-2">
            <Button onClick={handleCallWaiter} variant="outline" className="bg-background border-primary/20 hover:bg-primary/5 text-primary px-4 py-4 rounded-xl font-medium shadow-lg touch-manipulation">
              <Bell className="w-5 h-5" />
            </Button>
            <Link href="/cart" className="flex-1">
              <Button className="w-full bg-accent hover:bg-accent-hover text-white py-4 rounded-xl font-medium shadow-lg touch-manipulation">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Ver carrito ({totalItems})
              </Button>
            </Link>
          </div>
        </div>
      )}
      <CallWaiterModal isOpen={showCallWaiterModal} onConfirm={handleConfirmCallWaiter} onCancel={handleCancelCallWaiter} />
      <InstructionsModal isOpen={showInstructionsModal} onClose={handleCloseInstructions} />
    </div>
  )
}
