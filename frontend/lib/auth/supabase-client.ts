"use client"

import type { AuthClient } from "@/lib/auth/interface"
import type { AuthSession, AuthUser, UserRole } from "@/lib/auth/types"
import { supabase } from "@/lib/auth/supabase-browser"

function mapUserRole(input: unknown): UserRole | null {
  if (input === "desarrollador" || input === "admin" || input === "caja") return input
  return null
}

export class SupabaseAuthClient implements AuthClient {
  async getSession(): Promise<AuthSession | null> {
    try {
      // Timeout de 2 segundos para evitar que se quede colgado
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: getSession tardó más de 2 segundos")), 2000)
      })
      
      const dataPromise = supabase.auth.getSession()
      
      const result = await Promise.race([dataPromise, timeoutPromise])
      const { data } = result as { data: { session: any } }
      const s = data?.session
      if (!s) {
        return null
      }
      const accessToken: string | null = typeof (s as any).access_token === "string" ? (s as any).access_token : null
      const expiresAt: number | null = typeof (s as any).expires_at === "number" ? (s as any).expires_at : null
      return {
        accessToken,
        expiresAt,
      }
    } catch (error) {
      // En lugar de lanzar error, retornar null para que la app no se quede colgada
      // Esto puede ocurrir por timeout o por error de red
      return null
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      // Timeout de 2 segundos para evitar que se quede colgado
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: getUser tardó más de 2 segundos")), 2000)
      })
      
      const dataPromise = supabase.auth.getUser()
      
      const result = await Promise.race([dataPromise, timeoutPromise])
      const { data } = result as { data: { user: any } }
      const u = data?.user
      if (!u) {
        return null
      }
      const appRole = mapUserRole((u.app_metadata as any)?.role)
      const userRole = mapUserRole((u.user_metadata as any)?.role)
      const role = appRole ?? userRole
      return {
        id: u.id,
        email: u.email ?? null,
        role,
      }
    } catch (error) {
      // En lugar de lanzar error, retornar null para que la app no se quede colgada
      // Esto puede ocurrir por timeout o por error de red
      return null
    }
  }

  async getRole(): Promise<UserRole | null> {
    const user = await this.getUser()
    return user?.role ?? null
  }

  onAuthStateChange(callback: (payload: { session: AuthSession | null; user: AuthUser | null }) => void) {
    const { data } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      // Convertir la sesión de Supabase directamente en lugar de llamar getSession()
      let session: AuthSession | null = null
      let user: AuthUser | null = null
      
      if (supabaseSession) {
        session = {
          accessToken: supabaseSession.access_token,
          expiresAt: supabaseSession.expires_at ?? null,
        }
        
        const u = supabaseSession.user
        if (u) {
          const appRole = mapUserRole((u.app_metadata as any)?.role)
          const userRole = mapUserRole((u.user_metadata as any)?.role)
          const role = appRole ?? userRole
          
          user = {
            id: u.id,
            email: u.email ?? null,
            role,
          }
        }
      }
      
      callback({ session, user })
    })
    return { unsubscribe: () => data.subscription.unsubscribe() }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  }
} 