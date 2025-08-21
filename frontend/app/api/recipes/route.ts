import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recipeSchema, recipeUpdateSchema, recipeDeleteSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'productId parameter is required' },
        { status: 400 }
      )
    }

    const recipes = await prisma.recipe.findMany({
      where: { productId: BigInt(productId) },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
            unitCost: true
          }
        }
      }
    })

    return NextResponse.json({
      data: recipes.map(recipe => ({
        ingredientId: recipe.ingredientId.toString(),
        name: recipe.ingredient.name,
        unit: recipe.ingredient.unit,
        quantity: recipe.quantity.toNumber(),
        unitCost: recipe.ingredient.unitCost?.toNumber() || null
      }))
    })
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = recipeSchema.parse(body)

    const recipe = await prisma.recipe.create({
      data: {
        productId: validatedData.productId,
        ingredientId: validatedData.ingredientId,
        quantity: validatedData.quantity
      },
      include: {
        ingredient: {
          select: {
            name: true,
            unit: true,
            unitCost: true
          }
        }
      }
    })

    return NextResponse.json({
      data: {
        ingredientId: recipe.ingredientId.toString(),
        name: recipe.ingredient.name,
        unit: recipe.ingredient.unit,
        quantity: recipe.quantity.toNumber(),
        unitCost: recipe.ingredient.unitCost?.toNumber() || null
      }
    }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Recipe already exists for this product and ingredient' },
        { status: 409 }
      )
    }
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Product or ingredient not found' },
        { status: 400 }
      )
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.message },
        { status: 400 }
      )
    }

    console.error('Error creating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = recipeUpdateSchema.parse(body)

    const recipe = await prisma.recipe.update({
      where: {
        productId_ingredientId: {
          productId: validatedData.productId,
          ingredientId: validatedData.ingredientId
        }
      },
      data: {
        quantity: validatedData.quantity
      },
      include: {
        ingredient: {
          select: {
            name: true,
            unit: true,
            unitCost: true
          }
        }
      }
    })

    return NextResponse.json({
      data: {
        ingredientId: recipe.ingredientId.toString(),
        name: recipe.ingredient.name,
        unit: recipe.ingredient.unit,
        quantity: recipe.quantity.toNumber(),
        unitCost: recipe.ingredient.unitCost?.toNumber() || null
      }
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      )
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.message },
        { status: 400 }
      )
    }

    console.error('Error updating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = recipeDeleteSchema.parse(body)

    await prisma.recipe.delete({
      where: {
        productId_ingredientId: {
          productId: validatedData.productId,
          ingredientId: validatedData.ingredientId
        }
      }
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      )
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.message },
        { status: 400 }
      )
    }

    console.error('Error deleting recipe:', error)
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    )
  }
} 