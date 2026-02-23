import { describe, it, expect } from "vitest"
import {
  buildCartLineId,
  calculateSelectedOptionsTotal,
  formatSelectedOptionLabel,
  getItemSelectedOptions,
} from "@/lib/product-options"

describe("product-options helpers", () => {
  it("builds a stable cart line id", () => {
    const options = [
      { id: "2", groupId: "g1", ingredientId: "i2", ingredientName: "A", priceAddition: 0.5 },
      { id: "1", groupId: "g1", ingredientId: "i1", ingredientName: "B", priceAddition: 1.0 },
    ]
    const lineId = buildCartLineId("prod-1", options)
    expect(lineId).toBe("prod-1::g1:1|g1:2")
  })

  it("calculates options total", () => {
    const total = calculateSelectedOptionsTotal([
      { id: "1", groupId: "g", ingredientId: "i", ingredientName: "X", priceAddition: 1.25 },
      { id: "2", groupId: "g", ingredientId: "i2", ingredientName: "Y", priceAddition: 0.75 },
    ])
    expect(total).toBe(2.0)
  })

  it("formats option label with group", () => {
    const label = formatSelectedOptionLabel({
      id: "1",
      groupId: "g1",
      groupName: "Queso",
      ingredientId: "i1",
      ingredientName: "Parmesano",
      priceAddition: 0,
    })
    expect(label).toBe("Queso: Parmesano")
  })

  it("extracts selected options from snake_case payload", () => {
    const options = getItemSelectedOptions({
      selected_options: [
        {
          id: "1",
          groupId: "g1",
          groupName: "Salsas",
          ingredientId: "i1",
          ingredientName: "Pesto",
          priceAddition: 1.5,
        },
      ],
    })
    expect(options).toHaveLength(1)
    expect(options[0].ingredientName).toBe("Pesto")
  })
})
