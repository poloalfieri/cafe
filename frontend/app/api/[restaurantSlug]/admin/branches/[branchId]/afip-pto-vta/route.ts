import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/tenant-proxy"

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; branchId: string }> },
) {
  const { restaurantSlug, branchId } = await context.params
  return proxyToBackend(
    request,
    restaurantSlug,
    `/api/admin/branches/${branchId}/afip-pto-vta`,
  )
}
