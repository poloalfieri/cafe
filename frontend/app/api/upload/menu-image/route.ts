import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${crypto.randomUUID()}.${ext}`
    const path = `products/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const supabase = getSupabaseAdmin()
    const { error: uploadErr } = await supabase.storage
      .from('menu-images')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 400 })
    }

    const { data: publicData } = supabase.storage.from('menu-images').getPublicUrl(path)
    return NextResponse.json({ url: publicData.publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error al subir imagen' }, { status: 500 })
  }
}
