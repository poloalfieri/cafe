import { describe, it, expect } from "vitest"

describe("Stock Management Tests", () => {
  it("should handle decimal calculations correctly", () => {
    const quantity = 2.5
    const unitCost = 1.2345
    const result = quantity * unitCost
    expect(Math.round(result * 10000) / 10000).toBe(3.0862)
  })

  it("should validate positive quantities", () => {
    const testQuantity = (qty: number) => qty > 0
    expect(testQuantity(1)).toBe(true)
    expect(testQuantity(0)).toBe(false)
    expect(testQuantity(-1)).toBe(false)
  })

  it("should validate allowed units", () => {
    const ALLOWED_UNITS = ["g", "kg", "ml", "l", "unit", "tbsp", "tsp", "piece"]
    const isValidUnit = (unit: string) => ALLOWED_UNITS.includes(unit)
    expect(isValidUnit("g")).toBe(true)
    expect(isValidUnit("kg")).toBe(true)
    expect(isValidUnit("invalid")).toBe(false)
  })
})
