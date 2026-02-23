import React from "react"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import PaymentModal from "@/components/payment-modal"
import messages from "@/messages/es.json"

describe("PaymentModal", () => {
  it("shows config error when mesa params are invalid", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages as any}>
        <PaymentModal
          isOpen
          onClose={() => {}}
          mesaId=""
          branchId=""
          mesaToken=""
          totalAmount={1500}
          items={[
            { id: "1", name: "Pizza", price: 1500, quantity: 1 },
          ]}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Error de configuración")).toBeInTheDocument()
    expect(screen.getByText("Método de Pago")).toBeInTheDocument()
    expect(screen.getByText("Billetera Digital")).toBeInTheDocument()
  })
})
