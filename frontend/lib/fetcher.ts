"use client"

import { supabase } from "@/lib/auth/supabase-browser"

export class FetchError extends Error {
  constructor(
    public status: number,
    public data: any,
    message?: string
  ) {
    super(message || `HTTP ${status}`)
    this.name = 'FetchError'
  }
}

async function getClientAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const cachedToken = getTokenFromSessionStorage() || getTokenFromLocalStorage()
  if (cachedToken) return cachedToken

  try {
    const { data: sessionRes } = await supabase.auth.getSession()
    let session = sessionRes?.session ?? null
    if (session?.access_token && isTokenExpired(session.access_token)) {
      const { data: refreshRes } = await supabase.auth.refreshSession()
      session = refreshRes?.session ?? null
    }
    const token = session?.access_token
    if (!token || isTokenExpired(token)) return null
    let user = null
    try {
      const { data: userRes } = await supabase.auth.getUser()
      user = userRes?.user ?? null
    } catch {
      user = null
    }
    try {
      sessionStorage.setItem('supabase_session', JSON.stringify({ session, user }))
    } catch {
      // ignore storage errors
    }
    return token
  } catch {
    return null
  }
}

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    const data = JSON.parse(json)
    return typeof data?.exp === 'number' ? data.exp : null
  } catch {
    return null
  }
}

function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const exp = decodeJwtExp(token)
  if (!exp) return false
  const now = Math.floor(Date.now() / 1000)
  return exp <= now + skewSeconds
}

function getTokenFromSessionStorage(): string | null {
  try {
    const stored = sessionStorage.getItem('supabase_session')
    if (!stored) return null
    const parsed = JSON.parse(stored)
    const token = parsed?.session?.access_token
    if (typeof token !== 'string') return null
    return isTokenExpired(token) ? null : token
  } catch {
    return null
  }
}

function getTokenFromLocalStorage(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const token = parsed?.access_token
      if (typeof token !== 'string') continue
      if (isTokenExpired(token)) continue
      try {
        sessionStorage.setItem('supabase_session', JSON.stringify({ session: { access_token: token }, user: parsed?.user ?? null }))
      } catch {
        // ignore storage errors
      }
      return token
    }
    return null
  } catch {
    return null
  }
}

export function getClientAuthHeader(): Record<string, string> {
  try {
    if (typeof window === 'undefined') return {}
    const token = getTokenFromSessionStorage() || getTokenFromLocalStorage()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export async function getClientAuthHeaderAsync(): Promise<Record<string, string>> {
  try {
    if (typeof window === 'undefined') return {}
    const token = await getClientAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export async function fetcher<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = await getClientAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    headers,
    ...options,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new FetchError(response.status, data, data.error || 'Request failed')
  }

  return data
}

export const api = {
  get: <T = any>(url: string) => fetcher<T>(url),
  post: <T = any>(url: string, body: any) => 
    fetcher<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T = any>(url: string, body: any) => 
    fetcher<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = any>(url: string, body?: any) => 
    fetcher<T>(url, { 
      method: 'DELETE', 
      body: body ? JSON.stringify(body) : undefined 
    }),
} 
