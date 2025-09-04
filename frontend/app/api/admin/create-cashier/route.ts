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
    const { email, password, branchId } = await req.json()
    if (typeof email !== 'string' || !email.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    if (typeof password !== 'string' || password.length < 6) return NextResponse.json({ error: 'Contraseña demasiado corta' }, { status: 400 })
    if (typeof branchId !== 'string' || !branchId) return NextResponse.json({ error: 'branchId inválido' }, { status: 400 })

    const token = getBearer(req)
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = getServerSupabase()
    const { data: ures, error: uerr } = await supabase.auth.getUser(token)
    if (uerr || !ures.user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const appm = (ures.user.app_metadata as any) || {}
    const role = appm.role
    const orgId = appm.org_id
    if (!orgId) return NextResponse.json({ error: 'Falta org_id en el usuario' }, { status: 403 })
    if (role !== 'admin' && role !== 'desarrollador') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const admin = getSupabaseAdmin()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

    const uid = created.user?.id
    if (uid) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.updateUserById(uid, { app_metadata: { role: 'caja', org_id: orgId, branch_id: branchId } })
    }

    return NextResponse.json({ ok: true, id: uid })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
} 