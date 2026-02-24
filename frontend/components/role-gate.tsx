"use client"

import React, { useEffect, useMemo, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { UserRole } from "@/lib/auth/types"
import { useAuth } from "@/contexts/auth-context"

export function RoleGate({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { role, session, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const redirectingRef = useRef(false)

  const hasAccess = useMemo(() => {
    return !!role && allow.includes(role)
  }, [allow, role])

  useEffect(() => {
    if (!loading && !session) {
      const qs = searchParams.toString()
      const next = qs ? `${pathname}?${qs}` : pathname
      let errorParam = ""
      try {
        const stored = sessionStorage.getItem("login_error")
        if (stored === "forbidden") {
          errorParam = "&error=forbidden"
          sessionStorage.removeItem("login_error")
        }
      } catch {
        // ignore storage errors
      }
      router.replace(`/login?next=${encodeURIComponent(next)}${errorParam}`)
    }
  }, [loading, router, session, pathname, searchParams])

  useEffect(() => {
    if (redirectingRef.current) return
    if (!loading && session && !hasAccess) {
      redirectingRef.current = true
      const qs = searchParams.toString()
      const next = qs ? `${pathname}?${qs}` : pathname
      try {
        sessionStorage.setItem("login_error", "forbidden")
      } catch {
        // ignore
      }
      Promise.resolve(signOut()).finally(() => {
        router.replace(`/login?error=forbidden&next=${encodeURIComponent(next)}`)
      })
    }
  }, [hasAccess, loading, pathname, router, searchParams, session, signOut])

  if (loading) return <div className="p-6">Cargando...</div>
  if (!session) return null
  if (!hasAccess) return null

  return <>{children}</>
} 
