const MESA_SESSION_KEY = "mesa_session"
const MESA_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export type MesaSessionPayload = {
  mesa_id: string | null
  branch_id: string | null
  token: string | null
  allowed_payment_methods?: string[] | null
}

export function normalizeSessionValue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized) return null
  const lowered = normalized.toLowerCase()
  if (lowered === "null" || lowered === "undefined") return null
  return normalized
}

function parseStoredSession(raw: string | null): MesaSessionPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const mesa_id = normalizeSessionValue(parsed?.mesa_id)
    const branch_id = normalizeSessionValue(parsed?.branch_id)
    const token = normalizeSessionValue(parsed?.token)
    if (mesa_id && branch_id) {
      return { mesa_id, branch_id, token }
    }
  } catch {
    // Ignore invalid storage payloads
  }
  return null
}

function readMesaSessionCookie(): MesaSessionPayload | null {
  if (typeof document === "undefined") return null
  const prefix = `${MESA_SESSION_KEY}=`
  const cookies = document.cookie ? document.cookie.split("; ") : []
  for (const cookie of cookies) {
    if (!cookie.startsWith(prefix)) continue
    const rawValue = cookie.slice(prefix.length)
    if (!rawValue) continue
    try {
      const decoded = decodeURIComponent(rawValue)
      const parsed = parseStoredSession(decoded)
      if (parsed) return parsed
    } catch {
      // Ignore invalid cookie payloads
    }
  }
  return null
}

export function readStoredMesaSession(): MesaSessionPayload {
  if (typeof window === "undefined") {
    return { mesa_id: null, branch_id: null, token: null }
  }

  const storages: Storage[] = [window.sessionStorage, window.localStorage]
  for (const storage of storages) {
    const parsed = parseStoredSession(storage.getItem(MESA_SESSION_KEY))
    if (parsed) return parsed
  }

  const cookieSession = readMesaSessionCookie()
  if (cookieSession) return cookieSession

  return { mesa_id: null, branch_id: null, token: null }
}

export function persistMesaSession(mesa_id: string, branch_id: string, token: string): void {
  if (typeof window === "undefined") return
  const payload = JSON.stringify({ mesa_id, branch_id, token })
  try {
    window.sessionStorage.setItem(MESA_SESSION_KEY, payload)
  } catch {
    // Ignore storage failures
  }
  try {
    window.localStorage.setItem(MESA_SESSION_KEY, payload)
  } catch {
    // Ignore storage failures
  }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${MESA_SESSION_KEY}=${encodeURIComponent(
      payload
    )}; path=/; max-age=${MESA_SESSION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
  } catch {
    // Ignore cookie failures
  }
}

/**
 * Resolve mesa session from URL params with fallback to stored session.
 * URL mesa_id + branch_id define the active context when present.
 * For the same context, prefer stored token (latest refreshed) over URL token.
 * If URL context is missing, fallback to stored session.
 */
export function getMesaSession(urlParams: {
  mesa_id: string | null
  token: string | null
  branch_id: string | null
}): MesaSessionPayload {
  const urlMesaId = normalizeSessionValue(urlParams.mesa_id)
  const urlToken = normalizeSessionValue(urlParams.token)
  const urlBranchId = normalizeSessionValue(urlParams.branch_id)
  const stored = readStoredMesaSession()

  if (urlMesaId && urlBranchId) {
    const sameStoredContext =
      stored.mesa_id === urlMesaId && stored.branch_id === urlBranchId
    const resolvedToken = sameStoredContext ? (stored.token || urlToken) : urlToken
    return { mesa_id: urlMesaId, token: resolvedToken, branch_id: urlBranchId }
  }

  if (stored.mesa_id && stored.branch_id) {
    return stored
  }

  return { mesa_id: urlMesaId, token: urlToken, branch_id: urlBranchId }
}

export async function refreshMesaSessionToken(
  urlParams: {
    mesa_id: string | null
    token: string | null
    branch_id: string | null
  },
  options: { force?: boolean } = {}
): Promise<MesaSessionPayload> {
  const session = getMesaSession(urlParams)
  if (!session.mesa_id || !session.branch_id) {
    return session
  }
  if (!options.force && session.token) {
    return session
  }

  try {
    const { apiFetchTenant } = await import("@/lib/apiClient")
    const data = await apiFetchTenant("/mesas/session", {
      method: "POST",
      body: JSON.stringify({
        mesa_id: session.mesa_id,
        branch_id: session.branch_id,
      }),
    })
    const refreshedToken = normalizeSessionValue(data?.token)
    if (!refreshedToken) {
      return session
    }

    persistMesaSession(session.mesa_id, session.branch_id, refreshedToken)
    return {
      mesa_id: session.mesa_id,
      branch_id: session.branch_id,
      token: refreshedToken,
      allowed_payment_methods: data?.allowed_payment_methods ?? null,
    }
  } catch {
    return session
  }
}
