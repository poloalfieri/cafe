import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; registerId: string }> }
) {
  const { restaurantSlug, registerId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/cash/registers/${registerId}/assign`)
}
