const MESA_SESSION_KEY = "mesa_session"

export type MesaSessionPayload = {
  mesa_id: string | null
  branch_id: string | null
  token: string | null
}

export function normalizeSessionValue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized) return null
  const lowered = normalized.toLowerCase()
  if (lowered === "null" || lowered === "undefined") return null
  return normalized
}

export function readStoredMesaSession(): MesaSessionPayload {
  if (typeof window === "undefined") {
    return { mesa_id: null, branch_id: null, token: null }
  }

  const storages: Storage[] = [window.sessionStorage, window.localStorage]
  for (const storage of storages) {
    try {
      const raw = storage.getItem(MESA_SESSION_KEY)
      if (!raw) continue
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
  }

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
}

/**
 * Resolve mesa session from URL params with fallback to stored session.
 * Priority: complete URL params > stored session > partial URL params.
 */
export function getMesaSession(urlParams: {
  mesa_id: string | null
  token: string | null
  branch_id: string | null
}): MesaSessionPayload {
  const urlMesaId = normalizeSessionValue(urlParams.mesa_id)
  const urlToken = normalizeSessionValue(urlParams.token)
  const urlBranchId = normalizeSessionValue(urlParams.branch_id)

  if (urlMesaId && urlToken && urlBranchId) {
    return { mesa_id: urlMesaId, token: urlToken, branch_id: urlBranchId }
  }

  const stored = readStoredMesaSession()
  if (stored.mesa_id && stored.branch_id) {
    return {
      mesa_id: stored.mesa_id,
      token: stored.token || urlToken,
      branch_id: stored.branch_id,
    }
  }

  return { mesa_id: urlMesaId, token: urlToken, branch_id: urlBranchId }
}
