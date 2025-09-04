import type { AuthSession, AuthUser, UserRole } from "@/lib/auth/types"

export type AuthStateChangeCallback = (payload: {
  session: AuthSession | null
  user: AuthUser | null
}) => void

export interface AuthClient {
  getSession(): Promise<AuthSession | null>
  getUser(): Promise<AuthUser | null>
  getRole(): Promise<UserRole | null>
  onAuthStateChange(callback: AuthStateChangeCallback): { unsubscribe: () => void }
  signOut(): Promise<void>
} 