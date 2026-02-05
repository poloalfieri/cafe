"use client"

import MenuView from "@/components/menu-view"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"

function UsuarioPageContent() {
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  useEffect(() => {
    if (!mesa_id || !token) return
    try {
      sessionStorage.setItem("mesa_session", JSON.stringify({ mesa_id, token }))
      if (typeof window !== "undefined") {
        const cleanUrl = `${window.location.origin}/usuario`
        window.history.replaceState({}, "", cleanUrl)
      }
    } catch (_) {
      // Ignore storage errors
    }
  }, [mesa_id, token])

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div>Cargando menú...</div>}>
        <MenuView />
      </Suspense>
    </div>
  )
}

export default function UsuarioPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <UsuarioPageContent />
    </Suspense>
  )
} 
