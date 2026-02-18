export interface ProductOptionItem {
  id: string
  groupId: string
  ingredientId: string
  priceAddition: number
  ingredientName: string
  ingredientUnit?: string
  currentStock: number
}

export interface ProductOptionGroup {
  id: string
  productId: string
  name: string
  isRequired: boolean
  maxSelections: number
  items: ProductOptionItem[]
}

export interface SelectedProductOption {
  id: string
  groupId: string
  groupName: string
  ingredientId: string
  ingredientName: string
  priceAddition: number
}

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord => {
  if (value && typeof value === "object") {
    return value as UnknownRecord
  }
  return {}
}

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined
  }
  return String(value)
}

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const normalizeOption = (option: Partial<SelectedProductOption>): SelectedProductOption | null => {
  const id = String(option.id ?? "").trim()
  const groupId = String(option.groupId ?? "").trim()
  const ingredientId = String(option.ingredientId ?? "").trim()
  const ingredientName = String(option.ingredientName ?? "").trim()

  if (!id || !groupId || !ingredientId || !ingredientName) {
    return null
  }

  return {
    id,
    groupId,
    groupName: String(option.groupName ?? "").trim(),
    ingredientId,
    ingredientName,
    priceAddition: toNumber(option.priceAddition, 0),
  }
}

export const normalizeSelectedOptions = (
  options: ReadonlyArray<Partial<SelectedProductOption>> = []
): SelectedProductOption[] => {
  return options
    .map(normalizeOption)
    .filter((option): option is SelectedProductOption => option !== null)
}

export const calculateSelectedOptionsTotal = (
  options: ReadonlyArray<Partial<SelectedProductOption>> = []
): number => {
  const total = normalizeSelectedOptions(options).reduce(
    (sum, option) => sum + option.priceAddition,
    0
  )
  return Math.round(total * 100) / 100
}

export const buildCartLineId = (
  productId: string,
  options: ReadonlyArray<Partial<SelectedProductOption>> = []
): string => {
  const normalized = normalizeSelectedOptions(options)
  if (normalized.length === 0) {
    return `${productId}::base`
  }

  const key = [...normalized]
    .sort((a, b) => {
      const left = `${a.groupId}:${a.id}`
      const right = `${b.groupId}:${b.id}`
      return left.localeCompare(right)
    })
    .map((option) => `${option.groupId}:${option.id}`)
    .join("|")

  return `${productId}::${key}`
}

export const getItemSelectedOptions = (item: unknown): SelectedProductOption[] => {
  const source = asRecord(item)
  const raw = source.selectedOptions ?? source.selected_options
  if (!Array.isArray(raw)) {
    return []
  }

  return normalizeSelectedOptions(
    raw.map((entry) => {
      const parsed = asRecord(entry)
      return {
        id: toOptionalString(parsed.id ?? parsed.itemId),
        groupId: toOptionalString(parsed.groupId),
        groupName: toOptionalString(parsed.groupName),
        ingredientId: toOptionalString(parsed.ingredientId),
        ingredientName: toOptionalString(parsed.ingredientName),
        priceAddition: toNumber(parsed.priceAddition),
      }
    })
  )
}

export const formatSelectedOptionLabel = (option: SelectedProductOption): string => {
  if (option.groupName) {
    return `${option.groupName}: ${option.ingredientName}`
  }
  return option.ingredientName
}
