'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/fetcher'
import { getTenantApiBase } from '@/lib/apiClient'
import { ALLOWED_UNITS } from '@/lib/validation'

interface Ingredient {
  id: string
  name: string
  unit: string
  currentStock: number
  unitCost: number | null
  createdAt: string
  updatedAt: string
}

interface IngredientFormData {
  name: string
  unit: string
  currentStock: number
  unitCost: number | null
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<IngredientFormData>({
    name: '',
    unit: 'g',
    currentStock: 0,
    unitCost: null
  })
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const backendUrl = getTenantApiBase()

  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const response = await api.get(`${backendUrl}/ingredients?page=${page}&search=${searchTerm}`)
      setIngredients(response.data.ingredients)
      setTotalPages(response.data.pagination.totalPages)
    } catch (error) {
      setError('Failed to fetch ingredients')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIngredients()
  }, [page, searchTerm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      
      if (editingId) {
        await api.patch(`${backendUrl}/ingredients/${editingId}`, formData)
      } else {
        await api.post(`${backendUrl}/ingredients`, formData)
      }
      
      setShowModal(false)
      setEditingId(null)
      setFormData({ name: '', unit: 'g', currentStock: 0, unitCost: null })
      fetchIngredients()
    } catch (error: any) {
      setError(error.data?.error || 'Failed to save ingredient')
    }
  }

  const handleEdit = (ingredient: Ingredient) => {
    setFormData({
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: ingredient.currentStock,
      unitCost: ingredient.unitCost
    })
    setEditingId(ingredient.id)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ingredient?')) return
    
    try {
      await api.delete(`${backendUrl}/ingredients/${id}`)
      fetchIngredients()
    } catch (error: any) {
      if (error.status === 409) {
        alert('Cannot delete ingredient: it is used in recipes')
      } else {
        alert('Failed to delete ingredient')
      }
    }
  }

  const openNewModal = () => {
    setFormData({ name: '', unit: 'g', currentStock: 0, unitCost: null })
    setEditingId(null)
    setShowModal(true)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Ingredients Management</h1>
        <button 
          onClick={openNewModal}
          style={{ 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          New Ingredient
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search ingredients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            padding: '10px', 
            border: '1px solid #ddd', 
            borderRadius: '4px', 
            width: '300px' 
          }}
        />
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

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead style={{ backgroundColor: '#f8f9fa' }}>
              <tr>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Name</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Unit</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Current Stock</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Unit Cost</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ingredient.name}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ingredient.unit}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ingredient.currentStock}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {ingredient.unitCost ? `$${ingredient.unitCost.toFixed(4)}` : 'N/A'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button 
                      onClick={() => handleEdit(ingredient)}
                      style={{ 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        border: 'none', 
                        padding: '5px 10px', 
                        borderRadius: '4px',
                        marginRight: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(ingredient.id)}
                      style={{ 
                        backgroundColor: '#dc3545', 
                        color: 'white', 
                        border: 'none', 
                        padding: '5px 10px', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button 
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              style={{ 
                padding: '5px 10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                backgroundColor: page === 1 ? '#f8f9fa' : 'white'
              }}
            >
              Previous
            </button>
            <span style={{ padding: '5px 10px' }}>Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              style={{ 
                padding: '5px 10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                backgroundColor: page === totalPages ? '#f8f9fa' : 'white'
              }}
            >
              Next
            </button>
          </div>
        </>
      )}

      {showModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px', 
            width: '500px',
            maxWidth: '90vw'
          }}>
            <h2>{editingId ? 'Edit Ingredient' : 'New Ingredient'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px' 
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Unit:</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px' 
                  }}
                >
                  {ALLOWED_UNITS.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Current Stock:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px' 
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Unit Cost:</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={formData.unitCost || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    unitCost: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px' 
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ 
                    padding: '10px 20px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ 
                    padding: '10px 20px', 
                    border: 'none', 
                    borderRadius: '4px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 