import { NextRequest, NextResponse } from 'next/server'
import { recipeSchema, recipeUpdateSchema, recipeDeleteSchema } from '@/lib/validation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireStaffAuth } from '@/lib/api-auth'

async function resolveRestaurantId(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data, error } = await supabase
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error || !data?.restaurant_id) {
    throw new Error('Usuario sin restaurante asociado')
  }

  return data.restaurant_id as string
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'productId parameter is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const restaurantId = await resolveRestaurantId(supabase, auth.user.id)
    const { data, error } = await supabase
      .from('recipes')
      .select(`ingredient_id, quantity, ingredient:ingredients ( id, name, unit, unit_cost )`)
      .eq('product_id', productId)
      .eq('restaurant_id', restaurantId)

    if (error) throw error

    return NextResponse.json({
      data: (data || []).map((recipe: any) => ({
        ingredientId: recipe.ingredient_id.toString(),
        name: recipe.ingredient?.name,
        unit: recipe.ingredient?.unit,
        quantity: parseFloat(recipe.quantity),
        unitCost: recipe.ingredient?.unit_cost != null ? parseFloat(recipe.ingredient.unit_cost) : null
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
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const validatedData = recipeSchema.parse(body)

    const supabase = getSupabaseAdmin()
    const restaurantId = await resolveRestaurantId(supabase, auth.user.id)
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        product_id: validatedData.productId.toString(),
        ingredient_id: validatedData.ingredientId.toString(),
        quantity: validatedData.quantity.toFixed(2),
        restaurant_id: restaurantId
      })
      .select(`ingredient:ingredients ( name, unit, unit_cost ), ingredient_id, quantity`)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Recipe already exists for this product and ingredient' },
          { status: 409 }
        )
      }
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Product or ingredient not found' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      data: {
        ingredientId: data.ingredient_id.toString(),
        name: data.ingredient?.name,
        unit: data.ingredient?.unit,
        quantity: parseFloat(data.quantity),
        unitCost: data.ingredient?.unit_cost != null ? parseFloat(data.ingredient.unit_cost) : null
      }
    }, { status: 201 })
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Recipe already exists for this product and ingredient' },
        { status: 409 }
      )
    }
    if (error.code === '23503') {
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
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const validatedData = recipeUpdateSchema.parse(body)

    const supabase = getSupabaseAdmin()
    const restaurantId = await resolveRestaurantId(supabase, auth.user.id)
    const { data, error } = await supabase
      .from('recipes')
      .update({ quantity: validatedData.quantity.toFixed(2) })
      .match({
        product_id: validatedData.productId.toString(),
        ingredient_id: validatedData.ingredientId.toString(),
        restaurant_id: restaurantId
      })
      .select(`ingredient:ingredients ( name, unit, unit_cost ), ingredient_id, quantity`)
      .single()

    if (error) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      data: {
        ingredientId: data.ingredient_id.toString(),
        name: data.ingredient?.name,
        unit: data.ingredient?.unit,
        quantity: parseFloat(data.quantity),
        unitCost: data.ingredient?.unit_cost != null ? parseFloat(data.ingredient.unit_cost) : null
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
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const validatedData = recipeDeleteSchema.parse(body)

    const supabase = getSupabaseAdmin()
    const restaurantId = await resolveRestaurantId(supabase, auth.user.id)
    const { error } = await supabase
      .from('recipes')
      .delete()
      .match({
        product_id: validatedData.productId.toString(),
        ingredient_id: validatedData.ingredientId.toString(),
        restaurant_id: restaurantId
      })

    if (error) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        )
      }
      throw error
    }

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
