"use client"

import { useCart, type Product } from "@/contexts/cart-context"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, removeOneByProductId, getProductQuantity } = useCart()
  const quantity = getProductQuantity(product.id)

  const handleIncrease = () => {
    addItem(product)
  }

  const handleDecrease = () => {
    if (quantity > 0) {
      removeOneByProductId(product.id)
    }
  }

  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-border">
      {/* Imagen placeholder */}
      <div className="h-32 sm:h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
        <div className="text-4xl sm:text-6xl opacity-30">🍽️</div>
      </div>

      {/* Contenido */}
      <div className="p-3 sm:p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-base sm:text-lg font-semibold text-text flex-1 mr-2">{product.name}</h3>
          <span className="text-base sm:text-lg font-bold text-primary whitespace-nowrap">
            ${product.price.toFixed(2)}
          </span>
        </div>

        <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{product.description}</p>

        {/* Controles de cantidad */}
        <div className="flex items-center justify-between">
          <span className="text-xs bg-card-hover text-muted-foreground px-2 py-1 rounded">{product.category}</span>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={handleDecrease}
              disabled={quantity === 0}
              size="sm"
              variant="outline"
              className="w-8 h-8 sm:w-9 sm:h-9 p-0 rounded-full bg-transparent touch-manipulation"
            >
              <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>

            <span className="w-6 sm:w-8 text-center font-medium text-text text-sm sm:text-base">{quantity}</span>

            <Button
              onClick={handleIncrease}
              size="sm"
              className="w-8 h-8 sm:w-9 sm:h-9 p-0 rounded-full bg-accent hover:bg-accent-hover touch-manipulation"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
