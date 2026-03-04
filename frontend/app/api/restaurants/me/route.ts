import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001"
    const INTERNAL_PROXY_KEY = process.env.INTERNAL_PROXY_KEY
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }
    if (INTERNAL_PROXY_KEY) {
      headers["X-Internal-Key"] = INTERNAL_PROXY_KEY
    }
    if (authHeader) {
      headers["Authorization"] = authHeader
    }

    const response = await fetch(`${BACKEND_URL}/restaurants/me`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    const contentType = response.headers.get("content-type")
    const data = contentType && contentType.includes("application/json")
      ? await response.json()
      : await response.text()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Proxy error:", error)
    return NextResponse.json({ error: "Internal proxy error" }, { status: 500 })
  }
}
