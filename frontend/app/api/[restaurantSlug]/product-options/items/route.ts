import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string }> }
) {
  const { restaurantSlug } = await context.params
  return proxyToBackend(request, restaurantSlug, '/product-options/items')
}
