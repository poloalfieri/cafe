import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getScopedOrder, resolvePrebillScope } from "../shared"

export async function POST(
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

    if (order.prebill_printed_at) {
      return NextResponse.json(
        {
          ok: true,
          updated: false,
          prebill_printed_at: order.prebill_printed_at,
        },
        { status: 200 },
      )
    }

    const nowIso = new Date().toISOString()
    const admin = getSupabaseAdmin()
    let updateQuery = admin
      .from("orders")
      .update({ prebill_printed_at: nowIso })
      .eq("id", orderId)
      .eq("restaurant_id", scope.scope.restaurantId)
      .is("prebill_printed_at", null)

    if (scope.scope.branchId) {
      updateQuery = updateQuery.eq("branch_id", scope.scope.branchId)
    }

    const { data: updatedRows, error: updateError } = await updateQuery
      .select("prebill_printed_at")

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "No se pudo marcar la precuenta" },
        { status: 500 },
      )
    }

    if (Array.isArray(updatedRows) && updatedRows.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          updated: true,
          prebill_printed_at: updatedRows[0]?.prebill_printed_at || nowIso,
        },
        { status: 200 },
      )
    }

    const latest = await getScopedOrder(
      orderId,
      scope.scope.restaurantId,
      scope.scope.branchId,
    )

    return NextResponse.json(
      {
        ok: true,
        updated: false,
        prebill_printed_at: latest?.prebill_printed_at ?? null,
      },
      { status: 200 },
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo marcar la precuenta" },
      { status: 500 },
    )
  }
}
