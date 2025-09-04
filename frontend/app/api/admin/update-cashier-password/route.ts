import 'server-only'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function getBearer(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const [type, token] = h.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export async function POST(req: Request) {
  try {
    const { userId, newPassword } = await req.json()
    if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
    if (typeof newPassword !== 'string' || newPassword.length < 6) return NextResponse.json({ error: 'Contraseña demasiado corta' }, { status: 400 })

    const token = getBearer(req)
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = getServerSupabase()
    const { data: meRes, error: meErr } = await supabase.auth.getUser(token)
    if (meErr || !meRes.user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const me = meRes.user
    const meRole = (me.app_metadata as any)?.role
    const meOrg = (me.app_metadata as any)?.org_id
    if (meRole !== 'admin' && meRole !== 'desarrollador') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (!meOrg) return NextResponse.json({ error: 'Falta org_id' }, { status: 403 })

    const admin = getSupabaseAdmin()
    const { data: targetRes, error: targetErr } = await admin.auth.admin.getUserById(userId)
    if (targetErr || !targetRes.user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const target = targetRes.user
    const targetRole = (target.app_metadata as any)?.role
    const targetOrg = (target.app_metadata as any)?.org_id
    if (targetRole !== 'caja' || targetOrg !== meOrg) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
} 