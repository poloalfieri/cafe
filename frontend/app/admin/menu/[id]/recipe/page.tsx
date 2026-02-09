'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/fetcher'

interface Recipe {
  ingredientId: string
  name: string
  unit: string
  quantity: number
  unitCost: number | null
}

interface Ingredient {
  id: string
  name: string
  unit: string
  currentStock: number
  unitCost: number | null
}

interface Product {
  id: string
  name: string
  category: string
  price: number
  description: string | null
}

export default function RecipePage() {
  const params = useParams()
  const productId = params.id as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [recipesResponse, ingredientsResponse] = await Promise.all([
        api.get(`/api/recipes?productId=${productId}`),
        api.get('/api/ingredients?pageSize=1000')
      ])
      
      setRecipes(recipesResponse.data)
      setIngredients(ingredientsResponse.data.ingredients)
    } catch (error) {
      setError('Failed to fetch data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProduct = async () => {
    try {
      const productResponse = await api.get(`/api/products/${productId}`)
      setProduct(productResponse.data)
    } catch (error) {
      console.error('Failed to fetch product:', error)
    }
  }

  useEffect(() => {
    fetchData()
    fetchProduct()
  }, [productId])

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIngredientId || !quantity) return

    try {
      setError(null)
      await api.post('/api/recipes', {
        productId,
        ingredientId: selectedIngredientId,
        quantity: parseFloat(quantity)
      })
      
      setSelectedIngredientId('')
      setQuantity('')
      fetchData()
    } catch (error: any) {
      setError(error.data?.error || 'Failed to add recipe')
    }
  }

  const handleUpdateQuantity = async (ingredientId: string, newQuantity: number) => {
    try {
      await api.patch('/api/recipes', {
        productId,
        ingredientId,
        quantity: newQuantity
      })
      fetchData()
    } catch (error: any) {
      setError(error.data?.error || 'Failed to update recipe')
    }
  }

  const handleDeleteRecipe = async (ingredientId: string) => {
    if (!confirm('Are you sure you want to remove this ingredient from the recipe?')) return
    
    try {
      await api.delete('/api/recipes', {
        productId,
        ingredientId
      })
      fetchData()
    } catch (error: any) {
      setError(error.data?.error || 'Failed to delete recipe')
    }
  }

  const calculateEstimatedCost = () => {
    return recipes.reduce((total, recipe) => {
      if (recipe.unitCost) {
        return total + (recipe.quantity * recipe.unitCost)
      }
      return total
    }, 0)
  }

  const availableIngredients = ingredients.filter(
    ingredient => !recipes.find(recipe => recipe.ingredientId === ingredient.id)
  )

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Recipe for {product?.name || `Product ${productId}`}</h1>
        {product && (
          <p style={{ color: '#666', margin: '5px 0' }}>
            {product.category} - ${product.price.toFixed(2)}
          </p>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h2>Add Ingredient</h2>
        <form onSubmit={handleAddRecipe} style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Ingredient:</label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              required
              style={{ 
                padding: '8px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                minWidth: '200px'
              }}
            >
              <option value="">Select an ingredient</option>
              {availableIngredients.map(ingredient => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name} ({ingredient.unit})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Quantity:</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              style={{ 
                padding: '8px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                width: '120px'
              }}
            />
          </div>
          
          <button 
            type="submit"
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </form>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Current Recipe</h2>
        {recipes.length === 0 ? (
          <p style={{ color: '#666' }}>No ingredients added yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead style={{ backgroundColor: '#f8f9fa' }}>
              <tr>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Ingredient</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Unit</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Quantity</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Unit Cost</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Total Cost</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.ingredientId}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{recipe.name}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{recipe.unit}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={recipe.quantity}
                      onChange={(e) => {
                        const newQuantity = parseFloat(e.target.value)
                        if (newQuantity > 0) {
                          handleUpdateQuantity(recipe.ingredientId, newQuantity)
                        }
                      }}
                      style={{ 
                        width: '80px', 
                        padding: '4px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px' 
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {recipe.unitCost ? `$${recipe.unitCost.toFixed(4)}` : 'N/A'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {recipe.unitCost ? `$${(recipe.quantity * recipe.unitCost).toFixed(4)}` : 'N/A'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button 
                      onClick={() => handleDeleteRecipe(recipe.ingredientId)}
                      style={{ 
                        backgroundColor: '#dc3545', 
                        color: 'white', 
                        border: 'none', 
                        padding: '5px 10px', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {recipes.length > 0 && (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Estimated Cost Per Product</h3>
          <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            ${calculateEstimatedCost().toFixed(4)}
          </p>
          {recipes.some(r => !r.unitCost) && (
            <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>
              * Some ingredients don't have unit cost set
            </p>
          )}
        </div>
      )}
    </div>
  )
} 
