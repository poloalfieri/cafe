export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const ACTIVE_RESTAURANT_SLUG_KEY = "active_restaurant_slug"
const RESERVED_SLUGS = new Set(["api", "print", "login", "payment", "super-admin", "test-session"])
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isValidRestaurantSlug(slug: string): boolean {
  return (
    slug.length >= 2 &&
    slug.length <= 50 &&
    SLUG_PATTERN.test(slug) &&
    !RESERVED_SLUGS.has(slug)
  )
}

function getStoredRestaurantSlug(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_RESTAURANT_SLUG_KEY) || ""
    return isValidRestaurantSlug(stored) ? stored : ""
  } catch {
    return ""
  }
}

export function getRestaurantSlug(): string {
  if (typeof window === "undefined") {
    throw new Error("getRestaurantSlug can only be called on the client side")
  }

  const pathParts = window.location.pathname.split("/").filter(Boolean)
  const firstSegment = pathParts[0] || ""

  if (isValidRestaurantSlug(firstSegment)) {
    try {
      localStorage.setItem(ACTIVE_RESTAURANT_SLUG_KEY, firstSegment)
    } catch {
      // Ignore storage errors and continue.
    }
    return firstSegment
  }

  const storedSlug = getStoredRestaurantSlug()
  if (storedSlug) {
    return storedSlug
  }

  throw new Error("No restaurant slug found in URL")
}

/**
 * Returns the base URL for tenant API calls: "/api/{slug}"
 * Designed as a drop-in replacement for the old backendUrl constant.
 * Usage: const backendUrl = getTenantApiBase()
 *        fetch(`${backendUrl}/menu`)  // calls /api/demo/menu
 */
export function getTenantApiBase(): string {
  return `/api/${getRestaurantSlug()}`
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    let errorData
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: response.statusText }
    }
    
    throw new ApiError(
      errorData.error || errorData.message || `HTTP ${response.status}`,
      response.status,
      errorData
    )
  }
  
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    return response.json()
  }
  
  return response.text()
}

export async function apiFetchTenant(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const slug = getRestaurantSlug()
  const url = `/api/${slug}${path}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  
  return handleResponse(response)
}

export async function apiFetchGlobal(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `/api${path}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  
  return handleResponse(response)
}
