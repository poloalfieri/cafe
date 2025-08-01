"use client"

import MenuView from "@/components/menu-view"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function UsuarioPage() {
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div>Cargando menú...</div>}>
        <MenuView />
      </Suspense>
      {/* Link al carrito con mesa_id y token en la URL */}
      <Link href={`/usuario/cart?mesa_id=${mesa_id}&token=${token}`}></Link>
    </div>
  )
} 