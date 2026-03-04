"use client"

import React, { useEffect, useMemo, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { UserRole } from "@/lib/auth/types"
import { useAuth } from "@/contexts/auth-context"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"

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

  useEffect(() => {
    const run = async () => {
      if (loading || !session || !hasAccess) return
      const segments = pathname.split("/").filter(Boolean)
      if (segments.length === 0) return
      const slug = segments[0]
      if (!slug) return

      try {
        const authHeader = await getClientAuthHeaderAsync()
        const sessionHeader = session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {}
        const response = await fetch("/api/restaurants/me", {
          headers: {
            ...authHeader,
            ...sessionHeader,
          },
        })
        if (!response.ok) return
        const data = await response.json()
        const restaurantSlug = data?.restaurant?.slug
        if (!restaurantSlug || restaurantSlug === slug) return
        const rest = segments.slice(1).join("/")
        const qs = searchParams.toString()
        const nextPath = rest ? `/${restaurantSlug}/${rest}` : `/${restaurantSlug}`
        router.replace(qs ? `${nextPath}?${qs}` : nextPath)
      } catch {
        // ignore
      }
    }
    void run()
  }, [hasAccess, loading, pathname, router, searchParams, session])

  if (loading) return <div className="p-6">Cargando...</div>
  if (!session) return null
  if (!hasAccess) return null

  return <>{children}</>
} 
