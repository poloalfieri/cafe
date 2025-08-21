import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'

export async function getProductRecipe(productId: bigint) {
  const recipes = await prisma.recipe.findMany({
    where: { productId },
    include: {
      ingredient: {
        select: {
          id: true,
          name: true,
          unit: true
        }
      }
    }
  })

  return recipes.map(recipe => ({
    ingredientId: recipe.ingredientId,
    name: recipe.ingredient.name,
    unit: recipe.ingredient.unit,
    quantity: recipe.quantity
  }))
}

export async function computeBatchConsumption(items: Array<{ productId: bigint; qty: number }>) {
  const consumption = new Map<string, { ingredientId: bigint; unit: string; consume: Decimal }>()

  for (const item of items) {
    const recipes = await prisma.recipe.findMany({
      where: { productId: item.productId },
      include: {
        ingredient: {
          select: {
            id: true,
            unit: true
          }
        }
      }
    })

    for (const recipe of recipes) {
      const key = recipe.ingredientId.toString()
      const consumeAmount = recipe.quantity.mul(item.qty)

      if (consumption.has(key)) {
        const existing = consumption.get(key)!
        existing.consume = existing.consume.add(consumeAmount)
      } else {
        consumption.set(key, {
          ingredientId: recipe.ingredientId,
          unit: recipe.ingredient.unit,
          consume: consumeAmount
        })
      }
    }
  }

  return Array.from(consumption.values())
}

export async function applyConsumption(consumption: Array<{ ingredientId: bigint; unit: string; consume: Decimal }>) {
  return await prisma.$transaction(async (tx) => {
    // First, check if any ingredient would go below 0
    for (const item of consumption) {
      const ingredient = await tx.ingredient.findUnique({
        where: { id: item.ingredientId },
        select: { id: true, name: true, currentStock: true }
      })

      if (!ingredient) {
        throw new Error(`Ingredient with id ${item.ingredientId} not found`)
      }

      const newStock = ingredient.currentStock.sub(item.consume)
      if (newStock.lt(0)) {
        return {
          success: false,
          error: `Insufficient stock for ingredient: ${ingredient.name}`,
          ingredientName: ingredient.name
        }
      }
    }

    // If all checks pass, apply the consumption
    for (const item of consumption) {
      await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          currentStock: {
            decrement: item.consume
          }
        }
      })
    }

    return { success: true }
  })
} 