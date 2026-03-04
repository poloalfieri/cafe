import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/tenant-proxy"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; invoiceId: string }> },
) {
  const { restaurantSlug, invoiceId } = await context.params
  return proxyToBackend(request, restaurantSlug, `/api/invoices/${invoiceId}`)
}
