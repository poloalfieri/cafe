import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string }> }
) {
  const { restaurantSlug } = await context.params
  return proxyToBackend(request, restaurantSlug, '/mesas')
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string }> }
) {
  const { restaurantSlug } = await context.params
  return proxyToBackend(request, restaurantSlug, '/mesas')
}
