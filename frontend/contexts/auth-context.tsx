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
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  const client: AuthClient = useMemo(() => new SupabaseAuthClient(), [])

  useEffect(() => {
    let isMounted = true
    
    // Primero suscribirse a cambios de auth (esto es lo más confiable)
    const sub = client.onAuthStateChange(async ({ session: s, user: u }) => {
      if (isMounted) {
        setSession(s)
        setUser(u)
        // Si es la primera vez, marcar como completado
        if (!initialCheckDone) {
          setInitialCheckDone(true)
          setLoading(false)
        }
      }
    })
    
    // Intentar obtener sesión inicial (con timeout corto)
    ;(async () => {
      try {
        const [s, u] = await Promise.all([client.getSession(), client.getUser()])
        
        if (!isMounted) {
          return
        }
        
        // Si Supabase no devolvió sesión, intentar leer del sessionStorage
        if (!s || !u) {
          const stored = sessionStorage.getItem('supabase_session')
          if (stored) {
            try {
              const { session: storedSession, user: storedUser } = JSON.parse(stored)
              
              // Convertir a nuestro formato
              const recoveredSession = {
                accessToken: storedSession.access_token,
                expiresAt: storedSession.expires_at
              }
              
              const appRole = storedUser.app_metadata?.role
              const userRole = storedUser.user_metadata?.role
              const role = appRole || userRole
              
              const recoveredUser = {
                id: storedUser.id,
                email: storedUser.email,
                role: (role === "desarrollador" || role === "admin" || role === "caja") ? role : null
              }
              
              setSession(recoveredSession)
              setUser(recoveredUser)
              setInitialCheckDone(true)
              setLoading(false)
              return
            } catch (e) {
            }
          }
        }
        
        setSession(s)
        setUser(u)
      } catch (error) {
        // En caso de error, asegurar que no hay sesión
        if (isMounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        // Siempre terminar el loading después de 2 segundos máximo
        setTimeout(() => {
          if (isMounted && !initialCheckDone) {
            setInitialCheckDone(true)
            setLoading(false)
          }
        }, 2000)
      }
    })()
    
    return () => {
      isMounted = false
      sub.unsubscribe()
    }
  }, [client, initialCheckDone])

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