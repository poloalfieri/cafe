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
    const { data } = await supabase.auth.getSession()
    const s = data.session
    if (!s) return null
    const accessToken: string | null = typeof (s as any).access_token === "string" ? (s as any).access_token : null
    const expiresAt: number | null = typeof (s as any).expires_at === "number" ? (s as any).expires_at : null
    return {
      accessToken,
      expiresAt,
    }
  }

  async getUser(): Promise<AuthUser | null> {
    const { data } = await supabase.auth.getUser()
    const u = data.user
    if (!u) return null
    const appRole = mapUserRole((u.app_metadata as any)?.role)
    const userRole = mapUserRole((u.user_metadata as any)?.role)
    const role = appRole ?? userRole
    return {
      id: u.id,
      email: u.email,
      role,
    }
  }

  async getRole(): Promise<UserRole | null> {
    const user = await this.getUser()
    return user?.role ?? null
  }

  onAuthStateChange(callback: (payload: { session: AuthSession | null; user: AuthUser | null }) => void) {
    const { data } = supabase.auth.onAuthStateChange(async () => {
      const [session, user] = await Promise.all([this.getSession(), this.getUser()])
      callback({ session, user })
    })
    return { unsubscribe: () => data.subscription.unsubscribe() }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  }
} 