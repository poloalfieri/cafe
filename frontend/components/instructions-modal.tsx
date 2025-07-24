"use client"

import { X, ShoppingCart, Plus, Minus, Bell, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InstructionsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-auto border border-border max-h-[90vh] overflow-y-auto">
        {/* Header del modal */}
        <div className="sticky top-0 bg-card rounded-t-2xl flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-lg">?</span>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-text">¿Cómo usar la app?</h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-full hover:bg-card-hover touch-manipulation"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Contenido del modal */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Bienvenida */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-text mb-2">¡Bienvenido!</h3>
            <p className="text-muted-foreground text-sm">Hacer tu pedido es muy fácil. Sigue estos simples pasos:</p>
          </div>

          {/* Paso 1: Seleccionar productos */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="font-semibold text-text mb-1">Selecciona tus productos</h4>
              <p className="text-muted-foreground text-sm mb-2">
                Navega por las categorías y encuentra tus platos favoritos.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card-hover p-2 rounded-lg">
                <span>Usa los filtros:</span>
                <span className="bg-primary text-white px-2 py-1 rounded-full">Pizzas</span>
                <span className="bg-card border border-border px-2 py-1 rounded-full">Pastas</span>
              </div>
            </div>
          </div>

          {/* Paso 2: Agregar cantidades */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="font-semibold text-text mb-1">Ajusta las cantidades</h4>
              <p className="text-muted-foreground text-sm mb-2">
                Usa los botones + y - para seleccionar cuántos quieres de cada producto.
              </p>
              <div className="flex items-center gap-2 bg-card-hover p-2 rounded-lg">
                <Button size="sm" variant="outline" className="w-6 h-6 p-0 rounded-full bg-transparent">
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-sm font-medium">2</span>
                <Button size="sm" className="w-6 h-6 p-0 rounded-full bg-accent">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Paso 3: Ver carrito */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">3</span>
            </div>
            <div>
              <h4 className="font-semibold text-text mb-1">Revisa tu pedido</h4>
              <p className="text-muted-foreground text-sm mb-2">
                Presiona el botón del carrito para ver todos tus productos seleccionados.
              </p>
              <div className="inline-flex items-center gap-2 bg-accent text-white px-3 py-2 rounded-lg text-sm">
                <ShoppingCart className="w-4 h-4" />
                <span>Ver carrito (3)</span>
              </div>
            </div>
          </div>

          {/* Paso 4: Pagar */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">4</span>
            </div>
            <div>
              <h4 className="font-semibold text-text mb-1">Procede al pago</h4>
              <p className="text-muted-foreground text-sm mb-2">
                Cuando estés listo, presiona "Ir a pagar" para finalizar tu pedido.
              </p>
              <div className="inline-flex items-center gap-2 bg-secondary text-white px-3 py-2 rounded-lg text-sm">
                <CreditCard className="w-4 h-4" />
                <span>Ir a pagar</span>
              </div>
            </div>
          </div>

          {/* Ayuda adicional */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-primary">¿Necesitas ayuda?</h4>
            </div>
            <p className="text-muted-foreground text-sm">
              Si tienes alguna duda o problema, presiona el botón "Mozo" y un miembro de nuestro equipo se acercará a tu
              mesa.
            </p>
          </div>

          {/* Botón para cerrar */}
          <Button
            onClick={onClose}
            className="w-full bg-primary hover:bg-primary-hover text-white py-3 text-base font-medium touch-manipulation"
          >
            ¡Entendido, empezar!
          </Button>
        </div>
      </div>
    </div>
  )
}
