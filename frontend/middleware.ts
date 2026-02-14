import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/* ------------------------------------------------------------------ */
/*  Route → allowed roles mapping                                      */
/* ------------------------------------------------------------------ */
function getAllowedRoles(pathname: string): string[] | null {
  if (
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/api/super-admin")
  ) {
    return ["desarrollador"]
  }
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin")
  ) {
    return ["desarrollador", "admin"]
  }
  if (pathname.startsWith("/cajero")) {
    return ["desarrollador", "caja"]
  }
  return null // should not happen given the matcher
}

/* ------------------------------------------------------------------ */
/*  Middleware                                                          */
/* ------------------------------------------------------------------ */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: use getUser() instead of getSession() for security
  // getUser() validates the JWT against the Supabase auth server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isApiRoute = request.nextUrl.pathname.startsWith("/api/")

  // --- No session ---
  if (!user) {
    if (isApiRoute) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // --- Role check ---
  const role =
    (user.app_metadata as Record<string, unknown>)?.role ??
    (user.user_metadata as Record<string, unknown>)?.role

  const allowedRoles = getAllowedRoles(request.nextUrl.pathname)

  if (allowedRoles && !allowedRoles.includes(role as string)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "No autorizado para esta sección" }, { status: 403 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Super-admin
    "/super-admin",
    "/super-admin/:path*",
    // Admin
    "/admin",
    "/admin/:path*",
    // Cajero
    "/cajero",
    "/cajero/:path*",
    // Note: /api/admin/* and /api/super-admin/* are NOT included here
    // because those route handlers already use requireStaffAuth /
    // requireRestaurantAuth for Bearer-token auth.
  ],
}
