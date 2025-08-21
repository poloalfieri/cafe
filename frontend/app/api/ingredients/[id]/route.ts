import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ingredientUpdateSchema } from '@/lib/validation'

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const id = BigInt(params.id)
    const body = await request.json()
    const validatedData = ingredientUpdateSchema.parse(body)

    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: validatedData
    })

    return NextResponse.json({
      data: {
        ...ingredient,
        id: ingredient.id.toString(),
        currentStock: ingredient.currentStock.toNumber(),
        unitCost: ingredient.unitCost?.toNumber() || null
      }
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      )
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An ingredient with this name already exists' },
        { status: 409 }
      )
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.message },
        { status: 400 }
      )
    }

    console.error('Error updating ingredient:', error)
    return NextResponse.json(
      { error: 'Failed to update ingredient' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const id = BigInt(params.id)

    // Check if ingredient is used in any recipes
    const recipeCount = await prisma.recipe.count({
      where: { ingredientId: id }
    })

    if (recipeCount > 0) {
      return NextResponse.json(
        { error: 'Ingredient is used in recipes and cannot be deleted.' },
        { status: 409 }
      )
    }

    await prisma.ingredient.delete({
      where: { id }
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      )
    }

    console.error('Error deleting ingredient:', error)
    return NextResponse.json(
      { error: 'Failed to delete ingredient' },
      { status: 500 }
    )
  }
} 