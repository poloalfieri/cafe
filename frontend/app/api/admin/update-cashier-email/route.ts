import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRestaurantAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const { userId, newEmail } = await req.json()
    if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
    if (typeof newEmail !== 'string' || !newEmail.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

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

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
