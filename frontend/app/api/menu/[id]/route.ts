import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    if (!id) {
      return NextResponse.json({ error: 'Product id is required' }, { status: 400 })
    }

    const authHeader = _request.headers.get('authorization') || _request.headers.get('Authorization')
    const search = _request.nextUrl.searchParams.toString()
    const url = search ? `${BACKEND_URL}/menu/${id}?${search}` : `${BACKEND_URL}/menu/${id}`
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      let errorData: any = null
      try {
        errorData = await response.json()
      } catch {
        errorData = null
      }
      return NextResponse.json(
        { error: errorData?.error || 'Failed to fetch product' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const product = {
      id: data.id?.toString(),
      name: data.name,
      category: data.category,
      price: parseFloat(data.price),
      description: data.description || null,
      available: data.available ?? true,
      imageUrl: data.image_url || null
    }

    return NextResponse.json({ data: product })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}
