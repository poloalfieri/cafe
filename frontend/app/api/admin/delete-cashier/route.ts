import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRestaurantAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()
    if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 })

    const auth = await requireRestaurantAuth(req, ['admin', 'desarrollador'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const restaurantId = auth.restaurantId

    const admin = getSupabaseAdmin()
    const { data: targetRes, error: targetErr } = await admin.auth.admin.getUserById(userId)
    if (targetErr || !targetRes.user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const target = targetRes.user
    const targetRole = (target.app_metadata as any)?.role
    const targetOrg = (target.app_metadata as any)?.org_id
    if (targetRole !== 'caja' || targetOrg !== restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    // Remove from restaurant_users table
    await admin.from('restaurant_users').delete().eq('user_id', userId)

    // Delete the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
