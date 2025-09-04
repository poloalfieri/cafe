"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { AuthSession, AuthUser, UserRole } from "@/lib/auth/types"
import type { AuthClient } from "@/lib/auth/interface"
import { SupabaseAuthClient } from "@/lib/auth/supabase-client"

interface AuthContextValue {
  session: AuthSession | null
  user: AuthUser | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const client: AuthClient = useMemo(() => new SupabaseAuthClient(), [])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const [s, u] = await Promise.all([client.getSession(), client.getUser()])
      if (!isMounted) return
      setSession(s)
      setUser(u)
      setLoading(false)
    })()

    const sub = client.onAuthStateChange(async ({ session: s, user: u }) => {
      setSession(s)
      setUser(u)
    })
    return () => {
      isMounted = false
      sub.unsubscribe()
    }
  }, [client])

  const value: AuthContextValue = useMemo(
    () => ({ session, user, role: user?.role ?? null, loading, signOut: () => client.signOut() }),
    [client, loading, session, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
} 