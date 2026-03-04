import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/tenant-proxy"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string }> },
) {
  const { restaurantSlug } = await context.params
  const searchParams = request.nextUrl.searchParams.toString()
  const path = searchParams ? `/api/invoices?${searchParams}` : "/api/invoices"
  return proxyToBackend(request, restaurantSlug, path)
}
