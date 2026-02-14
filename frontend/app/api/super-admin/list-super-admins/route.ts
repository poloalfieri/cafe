import "server-only"
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { requireStaffAuth } from "@/lib/api-auth"

/* ------------------------------------------------------------------ */
/*  GET – list all super-admin users (desarrollador role)            */
/* ------------------------------------------------------------------ */
export async function GET(req: Request) {
  // Only super-admins can view the list
  const auth = await requireStaffAuth(req, ["desarrollador"])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    // Fetch all users
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listErr) {
      return NextResponse.json(
        { error: listErr.message || "Error listando usuarios" },
        { status: 500 }
      )
    }

    // Filter users with desarrollador role
    const superAdmins = (listData?.users || [])
      .filter((user) => {
        const role = (user.app_metadata as Record<string, unknown>)?.role
        return role === "desarrollador"
      })
      .map((user) => ({
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata as Record<string, unknown>)?.full_name || "",
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      }))

    return NextResponse.json({ superAdmins })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
