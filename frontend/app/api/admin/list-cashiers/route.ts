import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRestaurantAuth } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const auth = await requireRestaurantAuth(req, ['admin', 'desarrollador'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const restaurantId = auth.restaurantId
    const admin = getSupabaseAdmin()

    // Supabase admin.listUsers doesn't support filtering by app_metadata,
    // so we fetch all and filter by org_id matching the restaurant.
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const cashiers = (data?.users || [])
      .filter((u) => {
        const meta = (u.app_metadata as Record<string, unknown>) || {}
        return meta.role === 'caja' && meta.org_id === restaurantId
      })
      .map((u) => ({
        id: u.id,
        email: u.email,
        branch_id: (u.app_metadata as Record<string, unknown>)?.branch_id || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))

    return NextResponse.json({ cashiers })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
