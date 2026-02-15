import "server-only"
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { requireStaffAuth } from "@/lib/api-auth"

/* ------------------------------------------------------------------ */
/*  GET – list restaurants with aggregated branch metrics              */
/* ------------------------------------------------------------------ */
export async function GET(req: Request) {
  const auth = await requireStaffAuth(req, ["desarrollador"])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = getSupabaseAdmin()

  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select(
      "id, name, slug, created_at, branches(id, name, address, phone, email, manager, active, share_menu, monthly_sales, total_orders, created_at)",
    )
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch admin links (restaurant_users with role=admin) to get auth emails
  const { data: adminLinks } = await admin
    .from("restaurant_users")
    .select("restaurant_id, user_id")
    .eq("role", "admin")

  // Build a map: restaurant_id -> { email, userId, fullName }
  const adminEmailMap = new Map<string, { email: string; userId: string; fullName: string }>()
  if (adminLinks && adminLinks.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authUsers = authData?.users ?? []
    for (const link of adminLinks) {
      const rid = (link as Record<string, unknown>).restaurant_id as string
      const uid = (link as Record<string, unknown>).user_id as string
      if (!rid || !uid) continue
      const authUser = authUsers.find((u) => u.id === uid)
      if (authUser) {
        adminEmailMap.set(rid, {
          email: authUser.email ?? "",
          userId: authUser.id,
          fullName:
            (authUser.user_metadata as Record<string, unknown>)?.full_name as string ?? "",
        })
      }
    }
  }

  const mapped = (restaurants || []).map((r: Record<string, unknown>) => {
    const branches = (r.branches as Record<string, unknown>[]) || []
    const branchesCount = branches.length
    const active = branches.some((b) => b.active === true)
    const monthlySalesTotal = branches.reduce(
      (sum, b) => sum + (Number(b.monthly_sales) || 0),
      0,
    )
    const totalOrdersTotal = branches.reduce(
      (sum, b) => sum + (Number(b.total_orders) || 0),
      0,
    )

    // Main branch = first by created_at
    const sorted = [...branches].sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime(),
    )
    const mainBranch = sorted[0] ?? null

    const adminInfo = adminEmailMap.get(r.id as string)

    return {
      id: r.id,
      name: r.name,
      slug: r.slug ?? null,
      created_at: r.created_at,
      branches_count: branchesCount,
      active,
      // main branch details (for display + edit)
      main_branch_id: (mainBranch?.id as string) ?? null,
      branch_name: (mainBranch?.name as string) ?? null,
      address: (mainBranch?.address as string) ?? null,
      phone: (mainBranch?.phone as string) ?? null,
      email: (mainBranch?.email as string) ?? null,
      manager: (mainBranch?.manager as string) ?? null,
      share_menu: (mainBranch?.share_menu as boolean) ?? false,
      monthly_sales_total: monthlySalesTotal,
      total_orders_total: totalOrdersTotal,
      // admin auth info
      admin_email: adminInfo?.email ?? null,
      admin_user_id: adminInfo?.userId ?? null,
      admin_full_name: adminInfo?.fullName ?? null,
    }
  })

  const stats = {
    total_restaurants: mapped.length,
    active_restaurants: mapped.filter((r) => r.active).length,
    revenue_monthly_total: mapped.reduce((s, r) => s + r.monthly_sales_total, 0),
    orders_total: mapped.reduce((s, r) => s + r.total_orders_total, 0),
  }

  return NextResponse.json({ restaurants: mapped, stats })
}

/* ------------------------------------------------------------------ */
/*  POST – create restaurant + branch + admin user + link             */
/* ------------------------------------------------------------------ */
export async function POST(req: Request) {
  const auth = await requireStaffAuth(req, ["desarrollador"])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json()
  const { restaurantName, restaurantSlug, branch, admin: adminInput } = body as {
    restaurantName?: string
    restaurantSlug?: string
    branch?: Record<string, unknown>
    admin?: { email?: string; fullName?: string; setPassword?: boolean; password?: string }
  }

  // ---------- validation ----------
  if (!restaurantName?.trim()) {
    return NextResponse.json({ error: "Nombre del restaurante requerido" }, { status: 400 })
  }
  if (!restaurantSlug?.trim()) {
    return NextResponse.json({ error: "Slug del restaurante requerido" }, { status: 400 })
  }
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugPattern.test(restaurantSlug.trim())) {
    return NextResponse.json(
      { error: "Slug invalido. Solo minusculas, numeros y guiones (ej: cafe-central)" },
      { status: 400 },
    )
  }
  if (!branch?.name || !(branch.name as string).trim()) {
    return NextResponse.json({ error: "Nombre de sucursal requerido" }, { status: 400 })
  }
  if (!adminInput?.email || !adminInput.email.includes("@")) {
    return NextResponse.json({ error: "Email del admin inválido" }, { status: 400 })
  }
  if (adminInput.setPassword && (!adminInput.password || adminInput.password.length < 6)) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  let restaurantId: string | null = null
  let branchId: string | null = null

  // Helper to compensate on failure
  const compensate = async () => {
    if (branchId) await supabaseAdmin.from("branches").delete().eq("id", branchId).catch(() => {})
    if (restaurantId) await supabaseAdmin.from("restaurants").delete().eq("id", restaurantId).catch(() => {})
  }

  try {
    // -------- 1. Create restaurant --------
    const { data: restaurant, error: restErr } = await supabaseAdmin
      .from("restaurants")
      .insert({ name: restaurantName.trim(), slug: restaurantSlug.trim() })
      .select("id")
      .single()

    if (restErr || !restaurant) {
      return NextResponse.json(
        { error: restErr?.message || "Error creando restaurante" },
        { status: 500 },
      )
    }
    restaurantId = (restaurant as Record<string, unknown>).id as string

    // -------- 2. Create branch --------
    const { data: branchData, error: branchErr } = await supabaseAdmin
      .from("branches")
      .insert({
        restaurant_id: restaurantId,
        name: (branch.name as string).trim(),
        address: (branch.address as string)?.trim() || null,
        phone: (branch.phone as string)?.trim() || null,
        email: (branch.email as string)?.trim() || null,
        manager: (branch.manager as string)?.trim() || null,
        share_menu: branch.shareMenu ?? false,
        active: true,
      })
      .select("id")
      .single()

    if (branchErr || !branchData) {
      await compensate()
      return NextResponse.json(
        { error: branchErr?.message || "Error creando sucursal" },
        { status: 500 },
      )
    }
    branchId = (branchData as Record<string, unknown>).id as string

    // -------- 3. Create / invite admin user --------
    let userId: string | null = null
    let mode: "invited" | "created_with_password" | "created" | "existing" = "invited"

    const wantsPassword = adminInput.setPassword === true && typeof adminInput.password === "string" && adminInput.password.length >= 6

    if (wantsPassword) {
      // --- Option 2: create user with a password set by the superadmin ---
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: adminInput.email,
          password: adminInput.password!,
          email_confirm: true,
          user_metadata: { full_name: adminInput.fullName || "" },
          app_metadata: { role: "admin" },
        })

      if (!createErr && created?.user) {
        userId = created.user.id
        mode = "created_with_password"
      } else {
        // User might already exist – look it up
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })
        const existing = listData?.users?.find(
          (u) => u.email === adminInput.email,
        )
        if (existing) {
          // Update existing user's password & metadata
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: adminInput.password!,
            user_metadata: { full_name: adminInput.fullName || existing.user_metadata?.full_name || "" },
          })
          userId = existing.id
          mode = "existing"
        }
      }
    } else {
      // --- Option 1: invite by email – admin creates their own password ---
      const { data: invited, error: inviteErr } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(adminInput.email, {
          data: { full_name: adminInput.fullName || "" },
        })

      if (!inviteErr && invited?.user) {
        userId = invited.user.id
        mode = "invited"
      } else {
        // Try createUser without password (fallback)
        const { data: created, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email: adminInput.email,
            email_confirm: true,
            user_metadata: { full_name: adminInput.fullName || "" },
            app_metadata: { role: "admin" },
          })

        if (!createErr && created?.user) {
          userId = created.user.id
          mode = "created"
        } else {
          // User likely already exists – look it up
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          })
          const existing = listData?.users?.find(
            (u) => u.email === adminInput.email,
          )
          if (existing) {
            userId = existing.id
            mode = "existing"
          }
        }
      }
    }

    if (!userId) {
      await compensate()
      return NextResponse.json(
        { error: "No se pudo crear ni encontrar al usuario admin" },
        { status: 500 },
      )
    }

    // Ensure role = admin in app_metadata
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "admin", restaurant_id: restaurantId },
    })

    // -------- 4. Link in restaurant_users --------
    const linkBase: Record<string, unknown> = {
      restaurant_id: restaurantId,
      user_id: userId,
      role: "admin",
    }

    // Try with branch_id; if column doesn't exist, retry without it
    const { error: linkErr } = await supabaseAdmin
      .from("restaurant_users")
      .insert({ ...linkBase, branch_id: branchId })

    if (linkErr) {
      const { error: linkErr2 } = await supabaseAdmin
        .from("restaurant_users")
        .insert(linkBase)

      if (linkErr2) {
        await compensate()
        return NextResponse.json(
          { error: linkErr2.message || "Error vinculando usuario" },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      restaurant_id: restaurantId,
      branch_id: branchId,
      user_id: userId,
      mode,
    })
  } catch (e: unknown) {
    await compensate()
    const msg = e instanceof Error ? e.message : "Error interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH – update restaurant name + main branch details               */
/* ------------------------------------------------------------------ */
export async function PATCH(req: Request) {
  const auth = await requireStaffAuth(req, ["desarrollador"])
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json()
  const {
    restaurantId,
    restaurantName,
    restaurantSlug,
    mainBranchId,
    branch,
    newAdminEmail,
    adminUserId,
  } = body as {
    restaurantId?: string
    restaurantName?: string
    restaurantSlug?: string
    mainBranchId?: string
    branch?: Record<string, unknown>
    newAdminEmail?: string
    adminUserId?: string
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const errors: string[] = []

  // -------- Update restaurant name + slug --------
  const restaurantUpdate: Record<string, unknown> = {}

  if (restaurantName !== undefined) {
    if (!restaurantName.trim()) {
      return NextResponse.json(
        { error: "Nombre del restaurante no puede estar vacio" },
        { status: 400 },
      )
    }
    restaurantUpdate.name = restaurantName.trim()
  }

  if (restaurantSlug !== undefined) {
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!restaurantSlug.trim() || !slugPattern.test(restaurantSlug.trim())) {
      return NextResponse.json(
        { error: "Slug invalido. Solo minusculas, numeros y guiones (ej: cafe-central)" },
        { status: 400 },
      )
    }
    restaurantUpdate.slug = restaurantSlug.trim()
  }

  if (Object.keys(restaurantUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update(restaurantUpdate)
      .eq("id", restaurantId)

    if (error) errors.push(`restaurant: ${error.message}`)
  }

  // -------- Update main branch --------
  if (mainBranchId && branch) {
    const branchUpdate: Record<string, unknown> = {}
    if (branch.name !== undefined) branchUpdate.name = (branch.name as string)?.trim() || null
    if (branch.address !== undefined) branchUpdate.address = (branch.address as string)?.trim() || null
    if (branch.phone !== undefined) branchUpdate.phone = (branch.phone as string)?.trim() || null
    if (branch.email !== undefined) branchUpdate.email = (branch.email as string)?.trim() || null
    if (branch.manager !== undefined) branchUpdate.manager = (branch.manager as string)?.trim() || null
    if (branch.shareMenu !== undefined) branchUpdate.share_menu = branch.shareMenu

    if (Object.keys(branchUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("branches")
        .update(branchUpdate)
        .eq("id", mainBranchId)

      if (error) errors.push(`branch: ${error.message}`)
    }
  }

  // -------- Update admin auth email --------
  if (newAdminEmail && adminUserId) {
    const trimmed = newAdminEmail.trim()
    if (!trimmed.includes("@")) {
      return NextResponse.json({ error: "Email de admin inválido" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
      email: trimmed,
    })

    if (error) errors.push(`admin email: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
