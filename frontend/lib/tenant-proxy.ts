import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'
const INTERNAL_PROXY_KEY = process.env.INTERNAL_PROXY_KEY

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
    const url = new URL(backendPath, BACKEND_URL)
    
    const searchParams = request.nextUrl.searchParams
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Restaurant-Slug': restaurantSlug,
    }

    if (INTERNAL_PROXY_KEY) {
      headers['X-Internal-Key'] = INTERNAL_PROXY_KEY
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      cache: 'no-store',
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.text()
        if (body) {
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
