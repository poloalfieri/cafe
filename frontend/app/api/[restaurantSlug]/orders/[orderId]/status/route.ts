import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/tenant-proxy"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; orderId: string }> },
) {
  const { restaurantSlug, orderId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/orders/${orderId}/status`)
}

