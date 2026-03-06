import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
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

  it("asks for take away vs delivery before showing address form", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages as any}>
        <PaymentModal
          isOpen
          onClose={() => {}}
          mesaId="Delivery"
          branchId="b1"
          mesaToken="tok"
          totalAmount={1500}
          items={[
            { id: "1", name: "Pizza", price: 1500, quantity: 1 },
          ]}
        />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Tipo de pedido")).toBeInTheDocument()
    expect(screen.queryByText("Calle")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Take away" }))
    expect(screen.queryByText("Calle")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delivery" }))
    expect(screen.getByText("Calle")).toBeInTheDocument()
  })
})
