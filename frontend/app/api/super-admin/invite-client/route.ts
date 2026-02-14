import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireStaffAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const { ownerEmail, orgName } = await req.json()
    if (typeof ownerEmail !== 'string' || !ownerEmail.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (typeof orgName !== 'string' || !orgName.trim()) {
      return NextResponse.json({ error: 'Nombre de organización inválido' }, { status: 400 })
    }

    const auth = await requireStaffAuth(req, ['desarrollador'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

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