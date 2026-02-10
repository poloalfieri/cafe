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
  const INACTIVITY_MS = 60 * 60 * 1000
  const ACTIVITY_KEY = "cafe_last_activity"
  const LOGIN_DAY_KEY = "cafe_last_login_day"

  const getLocalDateKey = () => {
    try {
      return new Date().toLocaleDateString("en-CA")
    } catch {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${y}-${m}-${day}`
    }
  }

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    // Función para finalizar el loading de forma segura
    const finishLoading = () => {
      if (isMounted && !initialCheckDone) {
        setInitialCheckDone(true)
        setLoading(false)
      }
    }
    
    // Primero suscribirse a cambios de auth (esto es lo más confiable)
    const sub = client.onAuthStateChange(async ({ session: s, user: u }) => {
      if (isMounted) {
        setSession(s)
        setUser(u)
        // Si es la primera vez, marcar como completado y cancelar timeout
        if (!initialCheckDone) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
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
              
              // Validar que la sesión no haya expirado
              const expiresAt = storedSession.expires_at
              if (expiresAt && expiresAt * 1000 < Date.now()) {
                // Sesión expirada, limpiar
                sessionStorage.removeItem('supabase_session')
              } else {
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
                finishLoading()
                return
              }
            } catch (e) {
              // Error al parsear, limpiar sessionStorage corrupto
              sessionStorage.removeItem('supabase_session')
            }
          }
        }
        
        setSession(s)
        setUser(u)
        finishLoading()
      } catch (error) {
        // En caso de error, asegurar que no hay sesión
        if (isMounted) {
          setSession(null)
          setUser(null)
        }
        finishLoading()
      } finally {
        // Timeout de seguridad: siempre terminar el loading después de 2 segundos máximo
        timeoutId = setTimeout(() => {
          finishLoading()
        }, 2000)
      }
    })()
    
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      sub.unsubscribe()
    }
  }, [client, initialCheckDone])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!session) {
      try {
        localStorage.removeItem(ACTIVITY_KEY)
        localStorage.removeItem(LOGIN_DAY_KEY)
      } catch {
        // ignore
      }
      return
    }

    const markActivity = () => {
      try {
        localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
        localStorage.setItem(LOGIN_DAY_KEY, getLocalDateKey())
      } catch {
        // ignore
      }
    }

    const checkSessionPolicy = () => {
      try {
        const lastDay = localStorage.getItem(LOGIN_DAY_KEY)
        const today = getLocalDateKey()
        if (lastDay && lastDay !== today) {
          client.signOut()
          return
        }
        const last = Number(localStorage.getItem(ACTIVITY_KEY) || "0")
        if (last && Date.now() - last > INACTIVITY_MS) {
          client.signOut()
        }
      } catch {
        // ignore
      }
    }

    markActivity()
    checkSessionPolicy()

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"]
    const handler = () => markActivity()
    events.forEach((event) => window.addEventListener(event, handler, { passive: true }))
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        checkSessionPolicy()
        markActivity()
      }
    }
    document.addEventListener("visibilitychange", visibilityHandler)

    const intervalId = window.setInterval(checkSessionPolicy, 60 * 1000)

    return () => {
      events.forEach((event) => window.removeEventListener(event, handler))
      document.removeEventListener("visibilitychange", visibilityHandler)
      window.clearInterval(intervalId)
    }
  }, [client, session])

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
