"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"
import ProductCard from "@/components/product-card"
import CallWaiterModal from "@/components/call-waiter-modal"
import InstructionsModal from "@/components/instructions-modal"
import { ShoppingCart, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

// Datos de ejemplo - en una app real vendrían de una API
const mockProducts = [
  {
    id: "1",
    name: "Hamburguesa Clásica",
    description: "Carne de res, lechuga, tomate, cebolla y salsa especial",
    price: 12.99,
    category: "Hamburguesas",
  },
  {
    id: "2",
    name: "Pizza Margherita",
    description: "Salsa de tomate, mozzarella fresca y albahaca",
    price: 15.5,
    category: "Pizzas",
  },
  {
    id: "3",
    name: "Ensalada César",
    description: "Lechuga romana, pollo, crutones y aderezo césar",
    price: 9.99,
    category: "Ensaladas",
  },
  {
    id: "4",
    name: "Pasta Carbonara",
    description: "Espaguetis con panceta, huevo, queso parmesano y pimienta negra",
    price: 13.75,
    category: "Pastas",
  },
  {
    id: "5",
    name: "Tacos de Pollo",
    description: "Tres tacos con pollo marinado, cebolla, cilantro y salsa verde",
    price: 11.25,
    category: "Mexicana",
  },
  {
    id: "6",
    name: "Salmón Grillado",
    description: "Filete de salmón con vegetales asados y salsa de limón",
    price: 18.99,
    category: "Pescados",
  },
]

export default function MenuView() {
  const { state } = useCart()
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos")
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)

  const categories = ["Todos", ...Array.from(new Set(mockProducts.map((p) => p.category)))]

  const filteredProducts =
    selectedCategory === "Todos" ? mockProducts : mockProducts.filter((p) => p.category === selectedCategory)

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)

  // Mostrar el modal de instrucciones al cargar la página
  useEffect(() => {
    setShowInstructionsModal(true)
  }, [])

  const handleCallWaiter = () => {
    setShowCallWaiterModal(true)
  }

  const handleConfirmCallWaiter = () => {
    // Aquí iría la lógica para notificar al mozo
    // Por ejemplo: enviar notificación, llamada a API, etc.
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
              {/* Botón llamar mozo */}
              <Button
                onClick={handleCallWaiter}
                variant="outline"
                className="px-2 sm:px-3 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm border-primary/20 hover:bg-primary/5 touch-manipulation bg-transparent"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2 text-primary" />
                <span className="hidden sm:inline text-primary">Mozo</span>
              </Button>

              {/* Botón del carrito */}
              <Link href="/cart">
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
        {/* Filtros de categoría - Optimizado para móvil */}
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

        {/* Lista de productos - Grid responsivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>

      {/* Botón flotante para móvil cuando hay productos */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-20">
          <div className="flex gap-2">
            {/* Botón llamar mozo flotante en móvil */}
            <Button
              onClick={handleCallWaiter}
              variant="outline"
              className="bg-background border-primary/20 hover:bg-primary/5 text-primary px-4 py-4 rounded-xl font-medium shadow-lg touch-manipulation"
            >
              <Bell className="w-5 h-5" />
            </Button>

            {/* Botón carrito flotante */}
            <Link href="/cart" className="flex-1">
              <Button className="w-full bg-accent hover:bg-accent-hover text-white py-4 rounded-xl font-medium shadow-lg touch-manipulation">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Ver carrito ({totalItems})
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Modal para llamar al mozo */}
      <CallWaiterModal
        isOpen={showCallWaiterModal}
        onConfirm={handleConfirmCallWaiter}
        onCancel={handleCancelCallWaiter}
      />

      {/* Modal de instrucciones */}
      <InstructionsModal isOpen={showInstructionsModal} onClose={handleCloseInstructions} />
    </div>
  )
}
