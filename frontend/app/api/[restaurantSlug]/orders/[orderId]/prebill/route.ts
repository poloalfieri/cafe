import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getScopedOrder, resolvePrebillScope } from "./shared"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantSlug: string; orderId: string }> },
) {
  try {
    const { restaurantSlug, orderId } = await context.params
    const scope = await resolvePrebillScope(request, restaurantSlug)
    if (!scope.ok) return scope.response

    const order = await getScopedOrder(
      orderId,
      scope.scope.restaurantId,
      scope.scope.branchId,
    )
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    let branchName: string | null = null
    if (order.branch_id) {
      const admin = getSupabaseAdmin()
      const { data: branchRow } = await admin
        .from("branches")
        .select("name")
        .eq("id", order.branch_id)
        .eq("restaurant_id", scope.scope.restaurantId)
        .maybeSingle()
      branchName = branchRow?.name ?? null
    }

    const createdAt = order.creation_date || order.created_at || new Date().toISOString()
    return NextResponse.json(
      {
        id: order.id,
        mesa_id: order.mesa_id,
        items: Array.isArray(order.items) ? order.items : [],
        total_amount: order.total_amount ?? 0,
        created_at: createdAt,
        creation_date: order.creation_date || createdAt,
        prebill_printed_at: order.prebill_printed_at ?? null,
        restaurant_name: scope.scope.restaurantName,
        branch_name: branchName,
      },
      { status: 200 },
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo cargar la precuenta" },
      { status: 500 },
    )
  }
}
