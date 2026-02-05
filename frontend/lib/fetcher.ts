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

function getClientAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem('supabase_session')
    if (!stored) return null
    const parsed = JSON.parse(stored)
    const token = parsed?.session?.access_token
    return typeof token === 'string' ? token : null
  } catch {
    return null
  }
}

export function getClientAuthHeader(): Record<string, string> {
  const token = getClientAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetcher<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getClientAccessToken()
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
