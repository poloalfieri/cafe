import React from "react"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import CartView from "@/components/cart-view"
import { CartProvider } from "@/contexts/cart-context"
import messages from "@/messages/es.json"
import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("mesa_id=1&token=tok&branch_id=b1"),
  useRouter: () => ({ push: vi.fn() }),
}))

const setLocation = (pathname: string) => {
  Object.defineProperty(window, "location", {
    value: { pathname },
    writable: true,
  })
}

describe("CartView", () => {
  it("renders empty cart state", () => {
    setLocation("/prego/usuario")

    render(
      <NextIntlClientProvider locale="es" messages={messages as any}>
        <CartProvider>
          <CartView />
        </CartProvider>
      </NextIntlClientProvider>
    )

    expect(screen.getByText("Carrito")).toBeInTheDocument()
    expect(screen.getByText("Tu carrito está vacío")).toBeInTheDocument()
    expect(screen.getByText("Ver Menú")).toBeInTheDocument()
  })
})
