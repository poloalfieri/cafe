import { NextResponse } from "next/server"
import { requireStaffAuth } from "@/lib/api-auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

type AllowedRole = "desarrollador" | "admin" | "caja"

const ALLOWED_ROLES: AllowedRole[] = ["desarrollador", "admin", "caja"]

interface Scope {
  restaurantId: string
  restaurantName: string | null
  branchId: string | null
}

interface ResolveScopeResult {
  ok: true
  scope: Scope
}

interface ResolveScopeError {
  ok: false
  response: NextResponse
}

type ResolveScope = ResolveScopeResult | ResolveScopeError

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function resolvePrebillScope(
  req: Request,
  restaurantSlug: string,
): Promise<ResolveScope> {
  const auth = await requireStaffAuth(req, ALLOWED_ROLES)
  if (!auth.ok) {
    return { ok: false, response: errorResponse(auth.error, auth.status) }
  }

  const admin = getSupabaseAdmin()

  const { data: restaurantRow, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, name")
    .eq("slug", restaurantSlug)
    .maybeSingle()

  if (restaurantError) {
    return {
      ok: false,
      response: errorResponse(
        restaurantError.message || "No se pudo resolver restaurante",
        500,
      ),
    }
  }

  if (!restaurantRow?.id) {
    return { ok: false, response: errorResponse("Restaurante no encontrado", 404) }
  }

  const { data: memberships, error: membershipError } = await admin
    .from("restaurant_users")
    .select("restaurant_id, branch_id, role")
    .eq("user_id", auth.user.id)
    .eq("restaurant_id", restaurantRow.id)
    .limit(20)

  if (membershipError) {
    return {
      ok: false,
      response: errorResponse(
        membershipError.message || "No se pudo validar acceso al restaurante",
        500,
      ),
    }
  }

  // Desarrollador puede acceder globalmente, sin restricción de sucursal.
  if (auth.role === "desarrollador") {
    return {
      ok: true,
      scope: {
        restaurantId: restaurantRow.id,
        restaurantName: restaurantRow.name ?? null,
        branchId: null,
      },
    }
  }

  const roleSet = new Set(["admin", "caja", "owner", "desarrollador"])
  const membership = (memberships || []).find((row) => roleSet.has(String(row.role || "")))

  if (membership) {
    return {
      ok: true,
      scope: {
        restaurantId: restaurantRow.id,
        restaurantName: restaurantRow.name ?? null,
        branchId: membership.branch_id || null,
      },
    }
  }

  // Fallback a metadata cuando no existe fila en restaurant_users.
  const appMeta = (auth.user.app_metadata || {}) as Record<string, unknown>
  const orgId = String(appMeta.org_id || "")
  if (orgId && orgId === restaurantRow.id) {
    const metaBranch = appMeta.branch_id ? String(appMeta.branch_id) : null
    return {
      ok: true,
      scope: {
        restaurantId: restaurantRow.id,
        restaurantName: restaurantRow.name ?? null,
        branchId: metaBranch,
      },
    }
  }

  return { ok: false, response: errorResponse("Sin acceso a restaurante", 403) }

}

export async function getScopedOrder(
  orderId: string,
  restaurantId: string,
  branchId: string | null,
) {
  const admin = getSupabaseAdmin()
  let query = admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .limit(1)

  if (branchId) {
    query = query.eq("branch_id", branchId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(error.message || "No se pudo cargar el pedido")
  }
  return data
}
