import { describe, it, expect, beforeEach } from "vitest"
import { getBackendBaseUrl, getTenantApiBase, getRestaurantSlug } from "@/lib/apiClient"

function setLocation(pathname: string, hostname = "localhost", protocol = "http:") {
  Object.defineProperty(window, "location", {
    value: { pathname, hostname, protocol },
    writable: true,
  })
}

describe("apiClient helpers", () => {
  beforeEach(() => {
    setLocation("/demo/usuario")
    localStorage.clear()
    sessionStorage.clear()
    delete (process as any).env.NEXT_PUBLIC_BACKEND_URL
  })

  it("resolves restaurant slug from URL", () => {
    expect(getRestaurantSlug()).toBe("demo")
    expect(getTenantApiBase()).toBe("/api/demo")
  })

  it("falls back to stored slug when path has no slug", () => {
    localStorage.setItem("active_restaurant_slug", "prego")
    setLocation("/login")
    expect(getRestaurantSlug()).toBe("prego")
  })

  it("uses NEXT_PUBLIC_BACKEND_URL when set", () => {
    ;(process as any).env.NEXT_PUBLIC_BACKEND_URL = "https://api.example.com/"
    expect(getBackendBaseUrl()).toBe("https://api.example.com")
  })

  it("uses localhost:5001 fallback in dev", () => {
    setLocation("/demo/usuario", "localhost", "http:")
    expect(getBackendBaseUrl()).toBe("http://localhost:5001")
  })
})
