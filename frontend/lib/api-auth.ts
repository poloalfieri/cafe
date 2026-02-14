import 'server-only'
import { getServerSupabase } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { User } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type StaffRole = 'desarrollador' | 'admin' | 'caja' | 'owner'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
export function getBearer(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const [type, token] = h.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

/**
 * Extract the role from a Supabase user, checking app_metadata first
 * and falling back to user_metadata (same logic as auth-context).
 */
export function getUserRole(user: User): StaffRole | undefined {
  return (
    ((user.app_metadata as Record<string, unknown>)?.role as StaffRole) ??
    ((user.user_metadata as Record<string, unknown>)?.role as StaffRole) ??
    undefined
  )
}

/* ------------------------------------------------------------------ */
/*  requireStaffAuth                                                   */
/*  Validates Bearer token + checks role from metadata.                */
/*  Use for any API route that just needs role-based access control.   */
/* ------------------------------------------------------------------ */
export async function requireStaffAuth(
  req: Request,
  roles: StaffRole[],
): Promise<
  | { ok: true; user: User; role: StaffRole }
  | { ok: false; status: number; error: string }
> {
  const token = getBearer(req)
  if (!token) {
    return { ok: false, status: 401, error: 'No autorizado' }
  }

  const supabase = getServerSupabase()
  const { data: ures, error: uerr } = await supabase.auth.getUser(token)
  if (uerr || !ures.user) {
    return { ok: false, status: 401, error: 'Token inválido' }
  }

  const role = getUserRole(ures.user)
  if (!role || !roles.includes(role)) {
    return { ok: false, status: 403, error: 'No autorizado' }
  }

  return { ok: true, user: ures.user, role }
}

/* ------------------------------------------------------------------ */
/*  requireRestaurantAuth                                              */
/*  Same as requireStaffAuth but also fetches the restaurant_id from   */
/*  the restaurant_users table. Use for multi-tenant admin routes.     */
/* ------------------------------------------------------------------ */
export async function requireRestaurantAuth(
  req: Request,
  roles: StaffRole[],
): Promise<
  | { ok: true; user: User; role: StaffRole; restaurantId: string }
  | { ok: false; status: number; error: string }
> {
  const auth = await requireStaffAuth(req, roles)
  if (!auth.ok) return auth

  const admin = getSupabaseAdmin()
  const { data: ruRows, error: ruError } = await admin
    .from('restaurant_users')
    .select('restaurant_id, role')
    .eq('user_id', auth.user.id)
    .limit(10)

  if (ruError || !ruRows || ruRows.length === 0) {
    return { ok: false, status: 403, error: 'Sin acceso a restaurante' }
  }

  // Find first row whose role is in the allowed list
  const allowed = ruRows.find((r: Record<string, unknown>) =>
    roles.includes(r.role as StaffRole),
  )
  if (!allowed) {
    return { ok: false, status: 403, error: 'Rol no autorizado en restaurante' }
  }

  return {
    ok: true,
    user: auth.user,
    role: auth.role,
    restaurantId: allowed.restaurant_id as string,
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: build a NextResponse from a failed auth result             */
/* ------------------------------------------------------------------ */
export function authErrorResponse(result: { ok: false; status: number; error: string }) {
  const { NextResponse: NR } = require('next/server')
  return NR.json({ error: result.error }, { status: result.status })
}
