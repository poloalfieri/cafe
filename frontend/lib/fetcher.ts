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
  try {
    const stored = sessionStorage.getItem('supabase_session')
    if (stored) {
      const parsed = JSON.parse(stored)
      const token = parsed?.session?.access_token
      if (typeof token === 'string') return token
    }
  } catch {
    // ignore
  }

  try {
    const { data: sessionRes } = await supabase.auth.getSession()
    const session = sessionRes?.session
    if (!session?.access_token) return null
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user ?? null
    try {
      sessionStorage.setItem('supabase_session', JSON.stringify({ session, user }))
    } catch {
      // ignore storage errors
    }
    return session.access_token
  } catch {
    return null
  }
}

export function getClientAuthHeader(): Record<string, string> {
  try {
    const stored = sessionStorage.getItem('supabase_session')
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    const token = parsed?.session?.access_token
    return typeof token === 'string' ? { Authorization: `Bearer ${token}` } : {}
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
