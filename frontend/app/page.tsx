"use client"

import MenuView from "@/components/menu-view"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function App() {
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  return (
    <div className="min-h-screen bg-background">
      <MenuView />
      {/* Link al carrito con mesa_id y token en la URL */}
      <Link href={`/cart?mesa_id=${mesa_id || ""}&token=${token || ""}`}></Link>
    </div>
  )
}
