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

export async function fetcher<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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