import { getClientAuthHeader } from "@/lib/fetcher"

describe("fetcher helpers", () => {
  it("builds Authorization header from localStorage token", () => {
    const key = "sb-test-auth-token"
    const token = "token-123"
    localStorage.setItem(key, JSON.stringify({ access_token: token, user: {} }))

    const headers = getClientAuthHeader()
    expect(headers.Authorization).toBe(`Bearer ${token}`)
  })
})
