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

    const response = await fetch(url.toString(), fetchOptions)

    const contentType = response.headers.get('content-type')
    let data
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Internal proxy error' },
      { status: 500 }
    )
  }
}
