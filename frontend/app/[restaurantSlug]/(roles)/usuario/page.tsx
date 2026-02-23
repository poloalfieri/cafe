"use client"

import MenuView from "@/components/menu-view"
import { Suspense, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  normalizeSessionValue,
  readStoredMesaSession,
  persistMesaSession,
} from "@/lib/mesa-session"

function UsuarioPageContent() {
  const searchParams = useSearchParams()
  const mesa_id = normalizeSessionValue(searchParams.get("mesa_id"))
  const branch_id = normalizeSessionValue(searchParams.get("branch_id"))
  const t = useTranslations("usuario.page")
  const initializedSessionRef = useRef<string | null>(null)

  useEffect(() => {
    const storedSession = readStoredMesaSession()
    const resolvedMesaId = mesa_id || storedSession.mesa_id
    const resolvedBranchId = branch_id || storedSession.branch_id
    if (!resolvedMesaId || !resolvedBranchId) return

    const sessionKey = `${resolvedMesaId}|${resolvedBranchId}`
    if (initializedSessionRef.current === sessionKey) return
    initializedSessionRef.current = sessionKey

    const hasQuerySession = Boolean(mesa_id && branch_id)

    ;(async () => {
      let sessionPersisted = false
      try {
        const { apiFetchTenant } = await import('@/lib/apiClient')
        const data = await apiFetchTenant('/mesas/session', {
          method: "POST",
          body: JSON.stringify({ mesa_id: resolvedMesaId, branch_id: resolvedBranchId }),
        })
        const refreshedToken = normalizeSessionValue(data?.token)
        if (refreshedToken) {
          persistMesaSession(resolvedMesaId, resolvedBranchId, refreshedToken)
          sessionPersisted = true
        }
      } catch (_) {
        // Ignore
      } finally {
        if (typeof window !== "undefined" && hasQuerySession && sessionPersisted) {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`
          window.history.replaceState({}, "", cleanUrl)
        }
      }
    })()
  }, [mesa_id, branch_id])

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
