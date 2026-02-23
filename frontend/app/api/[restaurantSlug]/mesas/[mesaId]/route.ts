import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; mesaId: string }> }
) {
  const { restaurantSlug, mesaId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/mesas/${mesaId}`)
}
