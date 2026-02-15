import CartView from "@/components/cart-view"
import { Suspense } from "react"

export default function UsuarioCartPage() {
  return (
    <Suspense fallback={<div>Cargando carrito...</div>}>
      <CartView />
    </Suspense>
  )
} 
