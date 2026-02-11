import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/api-auth'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/menu/`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store' // Ensure fresh data
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    // The backend already returns the data in the correct format
    const products = Array.isArray(data) ? data.map((item: any) => ({
      id: item.id.toString(),
      name: item.name,
      category: item.category,
      price: parseFloat(item.price),
      description: item.description || null,
      available: item.available ?? true
    })) : []

    return NextResponse.json({
      data: products
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
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
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    const response = await fetch(`${BACKEND_URL}/menu/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || 'Failed to create product' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Transform response to match our format
    const product = {
      id: data.id.toString(),
      name: data.name,
      category: data.category,
      price: parseFloat(data.price),
      description: data.description || null,
      available: data.available ?? true
    }

    return NextResponse.json({
      data: product
    })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
} 
