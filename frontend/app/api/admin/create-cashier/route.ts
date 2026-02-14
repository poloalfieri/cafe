import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRestaurantAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const { email, password, branchId } = await req.json()
    if (typeof email !== 'string' || !email.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    if (typeof password !== 'string' || password.length < 6) return NextResponse.json({ error: 'Contraseña demasiado corta' }, { status: 400 })
    if (typeof branchId !== 'string' || !branchId) return NextResponse.json({ error: 'branchId inválido' }, { status: 400 })

    const auth = await requireRestaurantAuth(req, ['admin', 'desarrollador'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const restaurantId = auth.restaurantId

    const admin = getSupabaseAdmin()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

    const uid = created.user?.id
    if (uid) {
      // Set role and org info in app_metadata
      await admin.auth.admin.updateUserById(uid, {
        app_metadata: { role: 'caja', org_id: restaurantId, branch_id: branchId },
      })

      // Also add to restaurant_users table for consistency
      await admin.from('restaurant_users').insert({
        user_id: uid,
        restaurant_id: restaurantId,
        branch_id: branchId,
        role: 'caja',
      })
    }

    return NextResponse.json({ ok: true, id: uid })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
