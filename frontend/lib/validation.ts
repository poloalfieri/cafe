import { z } from 'zod'

export const ALLOWED_UNITS = ['kg', 'g', 'l', 'ml', 'unidad'] as const

export const ingredientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  unit: z.enum(ALLOWED_UNITS, { errorMap: () => ({ message: 'Invalid unit' }) }),
  currentStock: z.number().min(0, 'Current stock must be non-negative').default(0),
  unitCost: z.number().min(0, 'Unit cost must be non-negative').optional().nullable(),
  minStock: z.number().min(0, 'Min stock must be non-negative').default(0),
  trackStock: z.boolean().default(true)
})

export const ingredientUpdateSchema = ingredientSchema.partial()

export const recipeSchema = z.object({
  productId: z.string().transform((val) => BigInt(val)),
  ingredientId: z.string().transform((val) => BigInt(val)),
  quantity: z.number().positive('Quantity must be positive')
})

export const recipeUpdateSchema = z.object({
  productId: z.string().transform((val) => BigInt(val)),
  ingredientId: z.string().transform((val) => BigInt(val)),
  quantity: z.number().positive('Quantity must be positive')
})

export const recipeDeleteSchema = z.object({
  productId: z.string().transform((val) => BigInt(val)),
  ingredientId: z.string().transform((val) => BigInt(val))
})

export const paginationSchema = z.object({
  page: z.string().nullable().optional().default('1').transform((val) => parseInt(val || '1')),
  pageSize: z.string().nullable().optional().default('20').transform((val) => parseInt(val || '20')),
  search: z.string().nullable().optional()
}) 