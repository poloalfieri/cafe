"use client"

import MenuView from "@/components/menu-view"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

function UsuarioPageContent() {
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const branch_id = searchParams.get("branch_id")
  const t = useTranslations("usuario.page")

  useEffect(() => {
    if (!mesa_id || !branch_id) return
    ;(async () => {
      try {
        const { apiFetchTenant } = await import('@/lib/apiClient')
        const data = await apiFetchTenant('/mesas/session', {
          method: "POST",
          body: JSON.stringify({ mesa_id, branch_id }),
        })
        if (data?.token) {
          sessionStorage.setItem(
            "mesa_session",
            JSON.stringify({ mesa_id, branch_id, token: data.token })
          )
        }
      } catch (_) {
        // Ignore
      } finally {
        if (typeof window !== "undefined") {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`
          window.history.replaceState({}, "", cleanUrl)
        }
      }
    })()
  }, [mesa_id])

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div>{t("loading")}</div>}>
        <MenuView />
      </Suspense>
    </div>
  )
}

export default function UsuarioPage() {
  const t = useTranslations("usuario.page")
  return (
    <Suspense fallback={<div>{t("loading")}</div>}>
      <UsuarioPageContent />
    </Suspense>
  )
} 
