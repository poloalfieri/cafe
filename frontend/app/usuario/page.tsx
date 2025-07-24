"use client"

import MenuView from "@/components/menu-view"
import { Suspense } from "react"
import Link from "next/link"

export default function UsuarioPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div>Cargando menú...</div>}>
        <MenuView />
      </Suspense>
      {/* Link al carrito con mesa_id y token en la URL */}
      <Link href="/usuario/cart"></Link>
    </div>
  )
} 