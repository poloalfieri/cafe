import { beforeEach, describe, it, expect } from "vitest"
import { getMesaSession, persistMesaSession, readStoredMesaSession } from "@/lib/mesa-session"

function clearMesaSessionCookie() {
  document.cookie = "mesa_session=; path=/; max-age=0"
}

describe("mesa-session resolver", () => {
  beforeEach(() => {
    clearMesaSessionCookie()
  })

  it("prefers stored token for the same mesa+branch context", () => {
    sessionStorage.setItem(
      "mesa_session",
      JSON.stringify({
        mesa_id: "1",
        branch_id: "b1",
        token: "stored-token",
      })
    )

    const session = getMesaSession({
      mesa_id: "1",
      branch_id: "b1",
      token: "url-token",
    })

    expect(session).toEqual({
      mesa_id: "1",
      branch_id: "b1",
      token: "stored-token",
    })
  })

  it("keeps URL mesa+branch when stored context belongs to another table", () => {
    sessionStorage.setItem(
      "mesa_session",
      JSON.stringify({
        mesa_id: "2",
        branch_id: "b2",
        token: "stored-token",
      })
    )

    const session = getMesaSession({
      mesa_id: "1",
      branch_id: "b1",
      token: "url-token",
    })

    expect(session).toEqual({
      mesa_id: "1",
      branch_id: "b1",
      token: "url-token",
    })
  })

  it("falls back to stored session when URL does not include mesa+branch", () => {
    sessionStorage.setItem(
      "mesa_session",
      JSON.stringify({
        mesa_id: "4",
        branch_id: "bx",
        token: "stored-token",
      })
    )

    const session = getMesaSession({
      mesa_id: null,
      branch_id: null,
      token: null,
    })

    expect(session).toEqual({
      mesa_id: "4",
      branch_id: "bx",
      token: "stored-token",
    })
  })

  it("reads session from cookie when storage is unavailable", () => {
    document.cookie = `mesa_session=${encodeURIComponent(
      JSON.stringify({
        mesa_id: "10",
        branch_id: "b10",
        token: "cookie-token",
      })
    )}; path=/`

    expect(readStoredMesaSession()).toEqual({
      mesa_id: "10",
      branch_id: "b10",
      token: "cookie-token",
    })
  })

  it("persists mesa session in cookie", () => {
    persistMesaSession("3", "b3", "token-3")

    expect(document.cookie).toContain("mesa_session=")
  })
})
