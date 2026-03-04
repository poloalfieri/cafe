import { NextRequest, NextResponse } from 'next/server'

export interface ProxyOptions {
  requireAuth?: boolean
  allowedRoles?: string[]
}

export async function proxyToBackend(
  request: NextRequest,
  restaurantSlug: string,
  backendPath: string,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'
    const INTERNAL_PROXY_KEY = process.env.INTERNAL_PROXY_KEY

    const url = new URL(backendPath, BACKEND_URL)
    
    const searchParams = request.nextUrl.searchParams
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    const headers: HeadersInit = {
      'X-Restaurant-Slug': restaurantSlug,
    }

    if (INTERNAL_PROXY_KEY) {
      headers['X-Internal-Key'] = INTERNAL_PROXY_KEY
    }

    const requestContentType = request.headers.get('content-type')
    if (requestContentType) {
      headers['Content-Type'] = requestContentType
    }

    const accept = request.headers.get('accept')
    if (accept) {
      headers['Accept'] = accept
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const incomingContentType = request.headers.get('content-type')
    if (incomingContentType) {
      headers['Content-Type'] = incomingContentType
    } else if (request.method !== 'GET' && request.method !== 'HEAD') {
      headers['Content-Type'] = 'application/json'
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      cache: 'no-store',
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.arrayBuffer()
        if (body.byteLength > 0) {
          fetchOptions.body = body
        }
      } catch {
        // No body
      }
    }

    const response = await fetchWithRetry(
      url.toString(),
      fetchOptions,
      request.method
    )

    const responseContentType = response.headers.get('content-type') || ''

    if (responseContentType.includes('application/json')) {
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    }

    const passthroughHeaders = new Headers()
    if (responseContentType) passthroughHeaders.set('Content-Type', responseContentType)
    const disposition = response.headers.get('content-disposition')
    if (disposition) passthroughHeaders.set('Content-Disposition', disposition)
    const cacheControl = response.headers.get('cache-control')
    if (cacheControl) passthroughHeaders.set('Cache-Control', cacheControl)

    const body = await response.arrayBuffer()
    return new NextResponse(body, {
      status: response.status,
      headers: passthroughHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Internal proxy error' },
      { status: 500 }
    )
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  method: string
): Promise<Response> {
  const isSafeMethod = method === 'GET' || method === 'HEAD'
  const maxAttempts = isSafeMethod ? 2 : 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(url, options)
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !isTransientProxyError(error)) {
        throw error
      }
      await delay(100 * attempt)
    }
  }

  throw lastError ?? new Error('Unexpected proxy fetch error')
}

function isTransientProxyError(error: unknown): boolean {
  const text = String(error ?? '').toLowerCase()
  const cause = (error as { cause?: { code?: string } })?.cause
  const code = String(cause?.code ?? '').toUpperCase()

  if (code === 'UND_ERR_SOCKET') return true
  if (code === 'ECONNRESET') return true
  if (code === 'EPIPE') return true
  if (code === 'ETIMEDOUT') return true
  if (code === 'ECONNREFUSED') return true

  return (
    text.includes('other side closed') ||
    text.includes('socket hang up') ||
    text.includes('fetch failed')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
