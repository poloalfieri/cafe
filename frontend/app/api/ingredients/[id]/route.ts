import { NextRequest, NextResponse } from 'next/server'
import { ingredientUpdateSchema } from '@/lib/validation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireStaffAuth } from '@/lib/api-auth'

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const id = params.id
    const body = await request.json()
    const validatedData = ingredientUpdateSchema.parse(body)
    const supabase = getSupabaseAdmin()
    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.unit !== undefined) updateData.unit = validatedData.unit
    if (validatedData.currentStock !== undefined) updateData.current_stock = validatedData.currentStock.toFixed(2)
    if (validatedData.unitCost !== undefined) updateData.unit_cost = validatedData.unitCost != null ? validatedData.unitCost.toFixed(2) : null
    if (validatedData.minStock !== undefined) updateData.min_stock = validatedData.minStock.toFixed(2)
    if (validatedData.trackStock !== undefined) updateData.track_stock = validatedData.trackStock

    const { data, error } = await supabase
      .from('ingredients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'An ingredient with this name already exists' },
          { status: 409 }
        )
      }
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Ingredient not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      data: {
        id: data.id.toString(),
        name: data.name,
        unit: data.unit,
        currentStock: parseFloat(data.current_stock),
        unitCost: data.unit_cost != null ? parseFloat(data.unit_cost) : null,
        minStock: data.min_stock != null ? parseFloat(data.min_stock) : 0,
        trackStock: Boolean(data.track_stock),
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      )
    }
    if (error.code === '23505') {
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
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const id = params.id
    const supabase = getSupabaseAdmin()

    const { count, error: countError } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('ingredient_id', id)

    if (countError) throw countError
    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: 'Ingredient is used in recipes and cannot be deleted.' },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)

    if (error) throw error

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
