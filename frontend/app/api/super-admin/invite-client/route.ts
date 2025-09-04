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
    const { ownerEmail, orgName } = await req.json()
    if (typeof ownerEmail !== 'string' || !ownerEmail.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (typeof orgName !== 'string' || !orgName.trim()) {
      return NextResponse.json({ error: 'Nombre de organización inválido' }, { status: 400 })
    }

    const token = getBearer(req)
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = getServerSupabase()
    const { data: ures, error: uerr } = await supabase.auth.getUser(token)
    if (uerr || !ures.user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const role = (ures.user.app_metadata as any)?.role
    if (role !== 'desarrollador') {
      return NextResponse.json({ error: 'Solo desarrollador' }, { status: 403 })
    }

    const orgId = crypto.randomUUID()

    const admin = getSupabaseAdmin()
    const { data: invited, error: inviteErr } = await (admin.auth as any).inviteUserByEmail(ownerEmail)
    if (inviteErr) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({ email: ownerEmail })
      if (createErr) {
        return NextResponse.json({ error: inviteErr.message || createErr.message }, { status: 400 })
      }
      const uid = created.user?.id
      if (uid) await admin.auth.admin.updateUserById(uid, { app_metadata: { role: 'admin', org_id: orgId } })
      return NextResponse.json({ ok: true, orgId, id: uid, mode: 'created' })
    }

    const uid = invited.user?.id
    if (uid) await admin.auth.admin.updateUserById(uid, { app_metadata: { role: 'admin', org_id: orgId } })

    return NextResponse.json({ ok: true, orgId, id: uid, mode: 'invited' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
} 