import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; groupId: string }> }
) {
  const { restaurantSlug, groupId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/product-options/groups/${groupId}`)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; groupId: string }> }
) {
  const { restaurantSlug, groupId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/product-options/groups/${groupId}`)
}
