"use client"

import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QuantityStepperProps {
  quantity: number
  onIncrease: () => void
  onDecrease: () => void
  /** Tamaño del stepper: 'default' para lista de productos, 'small' para secciones compactas */
  size?: 'default' | 'small'
  /** Color del botón de incremento: 'dark' (gris oscuro) o 'green' (verde) */
  incrementColor?: 'dark' | 'green'
  /** Clase CSS adicional para personalización */
  className?: string
  /** Si es true, deshabilita el botón de decremento cuando quantity === 1 */
  disableDecreaseAtOne?: boolean
}

/**
 * QuantityStepper - Control de cantidad consistente tipo píldora
 * 
 * Características HCI:
 * - Altura mínima 44px (tap target móvil cómodo)
 * - Botones simétricos con buen peso visual
 * - Contador con ancho fijo para evitar "saltos" (1-9 vs 10+)
 * - Estado deshabilitado visible (no oculto) con menor opacidad
 * - Accesibilidad: aria-labels, roles, focus visible
 * - Iconos con stroke 2px para buen contraste
 */
export default function QuantityStepper({ 
  quantity, 
  onIncrease, 
  onDecrease,
  size = 'default',
  incrementColor = 'dark',
  className = '',
  disableDecreaseAtOne = false
}: QuantityStepperProps) {
  const isSmall = size === 'small'
  const isGreen = incrementColor === 'green'
  
  // Determinar si el botón de decremento debe estar deshabilitado
  const isDecreaseDisabled = disableDecreaseAtOne && quantity <= 1
  
  // Clases base para el contenedor tipo píldora
  const containerClasses = `
    flex items-center gap-2 bg-gray-50 rounded-full 
    ${isSmall ? 'px-2 py-1.5 min-h-[36px]' : 'px-3 py-2 min-h-[44px]'}
    ${className}
  `.trim()
  
  // Clases para los botones (simétricos)
  const buttonSize = isSmall ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'
  
  // Clases para el botón de decremento
  const decreaseButtonClasses = `
    ${buttonSize} rounded-full hover:bg-white p-0 transition-all duration-200
    ${isDecreaseDisabled 
      ? 'opacity-40 cursor-not-allowed' 
      : 'hover:scale-105 active:scale-95'
    }
  `.trim()
  
  // Clases para el botón de incremento (igual que el de decremento para simetría)
  const increaseButtonClasses = `
    ${buttonSize} rounded-full p-0 transition-all duration-200 hover:scale-105 active:scale-95
    ${isGreen 
      ? 'bg-green-500 hover:bg-green-600 text-white' 
      : 'hover:bg-white'
    }
  `.trim()
  
  // Ancho fijo del contador para evitar que "baile"
  const counterClasses = `
    font-semibold text-gray-900 text-center
    ${isSmall ? 'min-w-[28px] text-sm' : 'min-w-[32px] text-base'}
  `.trim()

  return (
    <div className={containerClasses}>
      {/* Botón de decremento */}
      <Button
        onClick={onDecrease}
        disabled={isDecreaseDisabled}
        size="icon"
        variant="ghost"
        className={decreaseButtonClasses}
        aria-label="Disminuir cantidad"
        aria-disabled={isDecreaseDisabled}
      >
        <Minus 
          className={`${iconSize} text-gray-700`} 
          strokeWidth={2}
        />
      </Button>
      
      {/* Contador con ancho fijo */}
      <span 
        className={counterClasses}
        role="status"
        aria-live="polite"
        aria-label={`Cantidad: ${quantity}`}
      >
        {quantity}
      </span>
      
      {/* Botón de incremento */}
      <Button
        onClick={onIncrease}
        size="icon"
        variant="ghost"
        className={increaseButtonClasses}
        aria-label="Aumentar cantidad"
      >
        <Plus 
          className={`${iconSize} text-gray-700`} 
          strokeWidth={2}
        />
      </Button>
    </div>
  )
}
