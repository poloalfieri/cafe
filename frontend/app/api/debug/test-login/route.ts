import 'server-only'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ ok: true, userId: data.user?.id, email: data.user?.email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
} 