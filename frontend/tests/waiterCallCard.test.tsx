import React from "react"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import WaiterCallCard from "@/components/waiter-call-card"
import messages from "@/messages/es.json"

describe("WaiterCallCard", () => {
  it("renders payment method and actions for pending calls", () => {
    const call = {
      id: "call-1",
      mesa_id: "7",
      created_at: new Date().toISOString(),
      status: "PENDING" as const,
      payment_method: "ASSISTANCE" as const,
      message: "Necesito ayuda",
    }

    render(
      <NextIntlClientProvider locale="es" messages={messages as any}>
        <WaiterCallCard call={call} onStatusUpdate={() => {}} />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Llamar al mozo")).toBeInTheDocument()
    expect(screen.getByText("Completar")).toBeInTheDocument()
    expect(screen.getByText("Cancelar")).toBeInTheDocument()
  })
})
