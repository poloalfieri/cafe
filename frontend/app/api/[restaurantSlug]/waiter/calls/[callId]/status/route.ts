import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; callId: string }> }
) {
  const { restaurantSlug, callId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/waiter/calls/${callId}/status`)
}
