import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params

  try {
    const response = await fetch(
      `${BACKEND_URL}/payment/order-status/${orderId}`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error fetching order status:", error)
    return NextResponse.json(
      { error: "Error al obtener estado del pedido" },
      { status: 500 }
    )
  }
}
