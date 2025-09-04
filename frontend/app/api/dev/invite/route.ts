import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function parseAllowlist(): Set<string> {
  const list = process.env.ALLOWED_DEV_EMAILS || ''
  return new Set(list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const allow = parseAllowlist()
    if (!allow.has(email.toLowerCase())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    // If password is provided, create directly; else send invitation email
    if (password && typeof password === 'string' && password.length >= 6) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 400 })
      }
      const userId = created.user?.id
      if (userId) {
        await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'desarrollador' } })
      }
      return NextResponse.json({ ok: true, id: userId, mode: 'created_with_password' })
    }

    const { data: invited, error: inviteErr } = await (admin.auth as any).inviteUserByEmail(email)
    if (inviteErr) {
      // Try to create user instead
      const { data: created, error: createErr } = await admin.auth.admin.createUser({ email })
      if (createErr) {
        return NextResponse.json({ error: inviteErr.message || createErr.message }, { status: 400 })
      }
      const userId = created.user?.id
      if (userId) {
        await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'desarrollador' } })
      }
      return NextResponse.json({ ok: true, id: userId, mode: 'created' })
    }

    const userId = invited.user?.id
    if (userId) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'desarrollador' } })
    }
    return NextResponse.json({ ok: true, id: userId, mode: 'invited' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
} 