import "server-only"
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { requireStaffAuth } from "@/lib/api-auth"

/* ------------------------------------------------------------------ */
/*  POST – create a new super-admin user (desarrollador role)         */
/* ------------------------------------------------------------------ */
export async function POST(req: Request) {
  // Only existing super-admins (desarrollador) can create new ones
  const auth = await requireStaffAuth(req, ["desarrollador"])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json()
  const { email, password, fullName } = body as {
    email?: string
    password?: string
    fullName?: string
  }

  // ---------- validation ----------
  if (!email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    )
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    // Check if user already exists
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    const existingUser = listData?.users?.find((u) => u.email === email.trim())

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 400 }
      )
    }

    // Create the new super-admin user
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName?.trim() || "" },
        app_metadata: { role: "desarrollador" },
      })

    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message || "Error creando usuario" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      user_id: created.user.id,
      email: created.user.email,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
