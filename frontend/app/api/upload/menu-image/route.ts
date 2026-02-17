import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'

type UploadFileLike = {
  name: string
  type?: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function isUploadFileLike(value: unknown): value is UploadFileLike {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<UploadFileLike>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.arrayBuffer === 'function'
  )
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!isUploadFileLike(file)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${randomUUID()}.${ext}`
    const path = `products/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = file.type || 'application/octet-stream'

    const supabase = getSupabaseAdmin()
    const { error: uploadErr } = await supabase.storage
      .from('menu-images')
      .upload(path, buffer, { contentType, upsert: true })

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 400 })
    }

    const { data: publicData } = supabase.storage.from('menu-images').getPublicUrl(path)
    return NextResponse.json({ url: publicData.publicUrl })
  } catch (e: any) {
    console.error('POST /api/upload/menu-image error:', e)
    return NextResponse.json({ error: e?.message || 'Error al subir imagen' }, { status: 500 })
  }
}
