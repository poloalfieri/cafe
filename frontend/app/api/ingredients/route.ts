import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ingredientSchema, paginationSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, pageSize, search } = paginationSchema.parse({
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
      search: searchParams.get('search')
    })

    const skip = (page - 1) * pageSize
    const where: any = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {}

    const [ingredients, total] = await Promise.all([
      prisma.ingredient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' }
      }),
      prisma.ingredient.count({ where })
    ])

    return NextResponse.json({
      data: {
        ingredients: ingredients.map(ingredient => ({
          ...ingredient,
          id: ingredient.id.toString(),
          currentStock: ingredient.currentStock.toNumber(),
          unitCost: ingredient.unitCost?.toNumber() || null
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching ingredients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ingredients' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = ingredientSchema.parse(body)

    const ingredient = await prisma.ingredient.create({
      data: {
        name: validatedData.name,
        unit: validatedData.unit,
        currentStock: validatedData.currentStock,
        unitCost: validatedData.unitCost
      }
    })

    return NextResponse.json({
      data: {
        ...ingredient,
        id: ingredient.id.toString(),
        currentStock: ingredient.currentStock.toNumber(),
        unitCost: ingredient.unitCost?.toNumber() || null
      }
    }, { status: 201 })
  } catch (error: any) {
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

    console.error('Error creating ingredient:', error)
    return NextResponse.json(
      { error: 'Failed to create ingredient' },
      { status: 500 }
    )
  }
} 