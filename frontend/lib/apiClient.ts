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

export function getRestaurantSlug(): string {
  if (typeof window === "undefined") {
    throw new Error("getRestaurantSlug can only be called on the client side")
  }
  
  const pathParts = window.location.pathname.split("/").filter(Boolean)
  
  if (pathParts.length === 0 || pathParts[0] === "super-admin") {
    throw new Error("No restaurant slug found in URL")
  }
  
  return pathParts[0]
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
