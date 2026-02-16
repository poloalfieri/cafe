import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; itemId: string }> }
) {
  const { restaurantSlug, itemId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/product-options/items/${itemId}`)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; itemId: string }> }
) {
  const { restaurantSlug, itemId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/product-options/items/${itemId}`)
}
