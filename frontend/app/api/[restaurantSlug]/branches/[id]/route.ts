import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/tenant-proxy'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; id: string }> }
) {
  const { restaurantSlug, id } = await context.params
  return proxyToBackend(request, restaurantSlug, `/branches/${id}`)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; id: string }> }
) {
  const { restaurantSlug, id } = await context.params
  return proxyToBackend(request, restaurantSlug, `/branches/${id}`)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; id: string }> }
) {
  const { restaurantSlug, id } = await context.params
  return proxyToBackend(request, restaurantSlug, `/branches/${id}`)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; id: string }> }
) {
  const { restaurantSlug, id } = await context.params
  return proxyToBackend(request, restaurantSlug, `/branches/${id}`)
}
