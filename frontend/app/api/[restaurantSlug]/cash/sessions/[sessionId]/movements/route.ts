import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; sessionId: string }> }
) {
  const { restaurantSlug, sessionId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/cash/sessions/${sessionId}/movements`)
}
