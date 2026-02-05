"use client"

import MenuView from "@/components/menu-view"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"

function UsuarioPageContent() {
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")

  useEffect(() => {
    if (!mesa_id) return
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001"
    ;(async () => {
      try {
        const res = await fetch(`${backendUrl}/mesa/session/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mesa_id }),
        })
        const data = await res.json()
        if (res.ok && data?.token) {
          sessionStorage.setItem("mesa_session", JSON.stringify({ mesa_id, token: data.token }))
        }
      } catch (_) {
        // Ignore
      } finally {
        if (typeof window !== "undefined") {
          const cleanUrl = `${window.location.origin}/usuario`
          window.history.replaceState({}, "", cleanUrl)
        }
      }
    })()
  }, [mesa_id])

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
