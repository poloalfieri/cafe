import { NextRequest, NextResponse } from 'next/server'
import { ingredientSchema, paginationSchema } from '@/lib/validation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireStaffAuth } from '@/lib/api-auth'

async function resolveMembership(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, branchIdParam?: string | null) {
  const { data, error } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, branch_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error || !data?.restaurant_id) {
    throw new Error('Usuario sin restaurante asociado')
  }

  let branchId = branchIdParam || data.branch_id
  if (!branchId) {
    throw new Error('branch_id requerido')
  }

  if (branchIdParam && branchIdParam !== data.branch_id) {
    const branchResp = await supabase
      .from('branches')
      .select('id, restaurant_id')
      .eq('id', branchIdParam)
      .limit(1)
      .single()
    if (branchResp.error || !branchResp.data || branchResp.data.restaurant_id !== data.restaurant_id) {
      throw new Error('Sucursal no encontrada')
    }
    branchId = branchIdParam
  }

  return { restaurantId: data.restaurant_id as string, branchId }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const { page, pageSize, search } = paginationSchema.parse({
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
      search: searchParams.get('search')
    })
    const branchIdParam = searchParams.get('branch_id')

    const skip = (page - 1) * pageSize
    const supabase = getSupabaseAdmin()
    const { restaurantId, branchId } = await resolveMembership(supabase, auth.user.id, branchIdParam)

    let query = supabase
      .from('ingredients')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .eq('branch_id', branchId)
      .order('name', { ascending: true })
      .range(skip, skip + pageSize - 1)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({
      data: {
        ingredients: (data || []).map((ing: any) => ({
          id: ing.id.toString(),
          name: ing.name,
          unit: ing.unit,
          currentStock: parseFloat(ing.current_stock),
          unitCost: ing.unit_cost != null ? parseFloat(ing.unit_cost) : null,
          minStock: ing.min_stock != null ? parseFloat(ing.min_stock) : 0,
          trackStock: Boolean(ing.track_stock),
          createdAt: ing.created_at,
          updatedAt: ing.updated_at
        })),
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize)
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
    const auth = await requireStaffAuth(request, ['desarrollador', 'admin'])
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const branchIdParam = body?.branch_id
    const validatedData = ingredientSchema.parse(body)
    const supabase = getSupabaseAdmin()
    const { restaurantId, branchId } = await resolveMembership(supabase, auth.user.id, branchIdParam)
    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        name: validatedData.name,
        unit: validatedData.unit,
        current_stock: validatedData.currentStock.toFixed(2),
        unit_cost: validatedData.unitCost != null ? validatedData.unitCost.toFixed(2) : null,
        min_stock: validatedData.minStock.toFixed(2),
        track_stock: validatedData.trackStock,
        restaurant_id: restaurantId,
        branch_id: branchId
      })
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'An ingredient with this name already exists' },
          { status: 409 }
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
    }, { status: 201 })
  } catch (error: any) {
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

    console.error('Error creating ingredient:', error)
    return NextResponse.json(
      { error: 'Failed to create ingredient' },
      { status: 500 }
    )
  }
} 
