import "server-only"
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { requireStaffAuth } from "@/lib/api-auth"

/* ------------------------------------------------------------------ */
/*  DELETE – delete a super-admin user (desarrollador role)          */
/* ------------------------------------------------------------------ */
export async function DELETE(req: Request) {
  // Only super-admins can delete super-admins
  const auth = await requireStaffAuth(req, ["desarrollador"])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json()
  const { userId } = body as { userId?: string }

  // ---------- validation ----------
  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 })
  }

  // Prevent deleting yourself
  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    )
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    // Verify the user exists and is a super-admin
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (!userData?.user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const role = (userData.user.app_metadata as Record<string, unknown>)?.role
    if (role !== "desarrollador") {
      return NextResponse.json(
        { error: "El usuario no es un super-admin" },
        { status: 400 }
      )
    }

    // Delete the user
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteErr) {
      return NextResponse.json(
        { error: deleteErr.message || "Error eliminando usuario" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
