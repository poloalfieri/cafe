import 'server-only'
import { getServerSupabase } from '@/lib/supabase-server'

export type StaffRole = 'desarrollador' | 'admin' | 'caja'

function getBearer(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const [type, token] = h.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export async function requireStaffAuth(req: Request, roles: StaffRole[]) {
  const token = getBearer(req)
  if (!token) {
    return { ok: false as const, status: 401, error: 'No autorizado' }
  }

  const supabase = getServerSupabase()
  const { data: ures, error: uerr } = await supabase.auth.getUser(token)
  if (uerr || !ures.user) {
    return { ok: false as const, status: 401, error: 'Token inválido' }
  }

  const appm = (ures.user.app_metadata as any) || {}
  const role = appm.role as StaffRole | undefined
  if (!role || !roles.includes(role)) {
    return { ok: false as const, status: 403, error: 'No autorizado' }
  }

  return { ok: true as const, user: ures.user, role }
}
