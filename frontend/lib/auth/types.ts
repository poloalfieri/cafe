export type UserRole = "desarrollador" | "admin" | "caja"

export interface AuthUser {
  id: string
  email: string | null
  role: UserRole | null
}

export interface AuthSession {
  accessToken: string | null
  expiresAt: number | null
} 