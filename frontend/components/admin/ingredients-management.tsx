"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { api } from '@/lib/fetcher'
import { ALLOWED_UNITS } from '@/lib/validation'
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Archive, 
  AlertTriangle,
  DollarSign,
  Package
} from 'lucide-react'

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

export default function IngredientsManagement() {
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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/ingredients?page=${page}&search=${searchTerm}`)
      setIngredients(response.data.ingredients)
      setTotalPages(response.data.pagination.totalPages)
    } catch (error) {
      console.error('Error fetching ingredients:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los ingredientes",
        variant: "destructive"
      })
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
      if (editingId) {
        await api.patch(`/api/ingredients/${editingId}`, formData)
        toast({
          title: "Éxito",
          description: "Ingrediente actualizado correctamente"
        })
      } else {
        await api.post('/api/ingredients', formData)
        toast({
          title: "Éxito", 
          description: "Ingrediente creado correctamente"
        })
      }
      
      setShowModal(false)
      setEditingId(null)
      setFormData({ name: '', unit: 'g', currentStock: 0, unitCost: null })
      fetchIngredients()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.data?.error || 'Error al guardar el ingrediente',
        variant: "destructive"
      })
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
    if (!confirm('¿Estás seguro de que quieres eliminar este ingrediente?')) return
    
    try {
      await api.delete(`/api/ingredients/${id}`)
      toast({
        title: "Éxito",
        description: "Ingrediente eliminado correctamente"
      })
      fetchIngredients()
    } catch (error: any) {
      if (error.status === 409) {
        toast({
          title: "Error",
          description: "No se puede eliminar: el ingrediente está siendo usado en recetas",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Error",
          description: "Error al eliminar el ingrediente",
          variant: "destructive"
        })
      }
    }
  }

  const openNewModal = () => {
    setFormData({ name: '', unit: 'g', currentStock: 0, unitCost: null })
    setEditingId(null)
    setShowModal(true)
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { variant: 'destructive' as const, label: 'Sin Stock' }
    if (stock < 50) return { variant: 'secondary' as const, label: 'Stock Bajo' }
    if (stock < 100) return { variant: 'outline' as const, label: 'Stock Medio' }
    return { variant: 'default' as const, label: 'Stock Bueno' }
  }

  const filteredIngredients = ingredients.filter(ingredient =>
    ingredient.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Ingredientes</h2>
          <p className="text-gray-600">Administra el inventario de ingredientes de tu cocina</p>
        </div>
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogTrigger asChild>
            <Button onClick={openNewModal} className="bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Ingrediente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Modifica los datos del ingrediente' : 'Agrega un nuevo ingrediente al inventario'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Café en grano, Leche, Azúcar..."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="unit">Unidad de Medida</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_UNITS.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="currentStock">Stock Actual</Label>
                <Input
                  id="currentStock"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="unitCost">Costo por Unidad (opcional)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={formData.unitCost || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    unitCost: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  placeholder="0.00"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                  {editingId ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Archive className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ingredients.length}</p>
                <p className="text-sm text-gray-600">Total Ingredientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {ingredients.filter(i => i.currentStock < 50).length}
                </p>
                <p className="text-sm text-gray-600">Stock Bajo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {ingredients.reduce((sum, i) => sum + i.currentStock, 0).toFixed(0)}
                </p>
                <p className="text-sm text-gray-600">Stock Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${ingredients.reduce((sum, i) => sum + (i.currentStock * (i.unitCost || 0)), 0).toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">Valor Inventario</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar ingredientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Ingredientes</CardTitle>
          <CardDescription>
            Gestiona tu inventario de ingredientes y mantén control del stock
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Costo Unitario</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((ingredient) => {
                  const status = getStockStatus(ingredient.currentStock)
                  return (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell>{ingredient.unit}</TableCell>
                      <TableCell>{ingredient.currentStock}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {ingredient.unitCost ? `$${ingredient.unitCost.toFixed(4)}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {ingredient.unitCost 
                          ? `$${(ingredient.currentStock * ingredient.unitCost).toFixed(2)}` 
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(ingredient)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(ingredient.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="flex items-center px-4">
            Página {page} de {totalPages}
          </span>
          <Button 
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
} 