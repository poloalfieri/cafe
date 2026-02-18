"use client"

import { useCart, type CartItem as CartItemType } from "@/contexts/cart-context"
import { Plus, Minus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CartItemProps {
  item: CartItemType
}

export default function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart()

  const handleIncrease = () => {
    updateQuantity(item.lineId, item.quantity + 1)
  }

  const handleDecrease = () => {
    updateQuantity(item.lineId, item.quantity - 1)
  }

  const handleRemove = () => {
    removeItem(item.lineId)
  }

  return (
    <div className="bg-card rounded-lg p-3 sm:p-4 shadow-sm border border-border">
      {/* Layout móvil: vertical */}
      <div className="sm:hidden">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 mr-3">
            <h3 className="font-semibold text-text mb-1 text-sm">{item.name}</h3>
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-card-hover text-muted-foreground px-2 py-1 rounded">{item.category}</span>
              <span className="font-medium text-primary text-sm">${item.price.toFixed(2)} c/u</span>
            </div>
          </div>
          <Button
            onClick={handleRemove}
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 touch-manipulation"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDecrease}
              size="sm"
              variant="outline"
              className="w-8 h-8 p-0 rounded-full bg-transparent touch-manipulation"
            >
              <Minus className="w-3 h-3" />
            </Button>

            <span className="w-8 text-center font-medium text-text text-sm">{item.quantity}</span>

            <Button
              onClick={handleIncrease}
              size="sm"
              className="w-8 h-8 p-0 rounded-full bg-accent hover:bg-accent-hover touch-manipulation"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          <div className="font-bold text-primary text-lg">${(item.price * item.quantity).toFixed(2)}</div>
        </div>
      </div>

      {/* Layout desktop: horizontal */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-text mb-1">{item.name}</h3>
          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-card-hover text-muted-foreground px-2 py-1 rounded">{item.category}</span>
            <span className="font-medium text-primary">${item.price.toFixed(2)} c/u</span>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          {/* Controles de cantidad */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDecrease}
              size="sm"
              variant="outline"
              className="w-8 h-8 p-0 rounded-full bg-transparent"
            >
              <Minus className="w-4 h-4" />
            </Button>

            <span className="w-8 text-center font-medium text-text">{item.quantity}</span>

            <Button
              onClick={handleIncrease}
              size="sm"
              className="w-8 h-8 p-0 rounded-full bg-accent hover:bg-accent-hover"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Subtotal */}
          <div className="text-right min-w-[80px]">
            <div className="font-bold text-primary text-lg">${(item.price * item.quantity).toFixed(2)}</div>
          </div>

          {/* Botón eliminar */}
          <Button
            onClick={handleRemove}
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
