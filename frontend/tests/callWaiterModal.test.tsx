import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import CallWaiterModal from "@/components/call-waiter-modal"
import messages from "@/messages/es.json"

describe("CallWaiterModal", () => {
  it("calls onConfirm with message", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <NextIntlClientProvider locale="es" messages={messages as any}>
        <CallWaiterModal isOpen onConfirm={onConfirm} onCancel={onCancel} />
      </NextIntlClientProvider>
    )

    const textarea = screen.getByLabelText("Motivo (opcional)")
    await user.type(textarea, "Necesito ayuda")

    await user.click(screen.getByText("Sí, llamar mozo"))

    expect(onConfirm).toHaveBeenCalledWith({ message: "Necesito ayuda" })
  })
})
