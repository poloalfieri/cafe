"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/auth/types"
import { useAuth } from "@/contexts/auth-context"

export function RoleGate({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { role, session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login")
    }
  }, [loading, router, session])

  if (loading) return <div className="p-6">Cargando...</div>

  if (!session) return null

  if (!role || !allow.includes(role)) {
    return <div className="p-6">No tienes permiso para acceder a esta sección.</div>
  }

  return <>{children}</>
} 