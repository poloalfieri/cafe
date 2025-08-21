import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create sample menu item if it doesn't exist
  const sampleProduct = await prisma.menu.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      name: 'Sample Product',
      category: 'Beverages',
      price: 5.50,
      description: 'A sample product for testing recipes',
      available: true
    }
  })

  console.log('Sample product created:', sampleProduct)

  // Create sample ingredients
  const ingredients = [
    {
      name: 'Coffee Beans',
      unit: 'g',
      currentStock: 1000,
      unitCost: 0.05
    },
    {
      name: 'Milk',
      unit: 'ml',
      currentStock: 5000,
      unitCost: 0.002
    },
    {
      name: 'Sugar',
      unit: 'g',
      currentStock: 2000,
      unitCost: 0.001
    },
    {
      name: 'Vanilla Extract',
      unit: 'ml',
      currentStock: 500,
      unitCost: 0.15
    },
    {
      name: 'Flour',
      unit: 'g',
      currentStock: 5000,
      unitCost: 0.003
    }
  ]

  const createdIngredients = []
  for (const ingredient of ingredients) {
    const created = await prisma.ingredient.upsert({
      where: { name: ingredient.name },
      update: {},
      create: ingredient
    })
    createdIngredients.push(created)
    console.log('Ingredient created:', created)
  }

  // Create sample recipe for the sample product
  const coffeeBeansIngredient = createdIngredients.find(i => i.name === 'Coffee Beans')
  const milkIngredient = createdIngredients.find(i => i.name === 'Milk')
  const sugarIngredient = createdIngredients.find(i => i.name === 'Sugar')

  if (coffeeBeansIngredient && milkIngredient && sugarIngredient) {
    const recipes = [
      {
        productId: sampleProduct.id,
        ingredientId: coffeeBeansIngredient.id,
        quantity: 20
      },
      {
        productId: sampleProduct.id,
        ingredientId: milkIngredient.id,
        quantity: 200
      },
      {
        productId: sampleProduct.id,
        ingredientId: sugarIngredient.id,
        quantity: 5
      }
    ]

    for (const recipe of recipes) {
      const created = await prisma.recipe.upsert({
        where: {
          productId_ingredientId: {
            productId: recipe.productId,
            ingredientId: recipe.ingredientId
          }
        },
        update: {},
        create: recipe
      })
      console.log('Recipe created:', created)
    }
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 