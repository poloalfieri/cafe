"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { api } from '@/lib/fetcher'
import { 
  ChefHat, 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  DollarSign,
  TrendingUp,
  Calculator,
  Search,
  RefreshCw
} from 'lucide-react'

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
  available?: boolean
}

interface NewProductForm {
  name: string
  category: string
  price: number
  description: string
}

export default function StockManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [newProductForm, setNewProductForm] = useState<NewProductForm>({
    name: '',
    category: '',
    price: 0,
    description: ''
  })

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

  const fetchProducts = async () => {
    try {
      setProductsLoading(true)
      // Use the same direct backend call as the working products management
      const response = await fetch(`${backendUrl}/menu/`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Transform the backend data to match our expected format
      const products = Array.isArray(data) ? data.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        category: item.category,
        price: parseFloat(item.price),
        description: item.description || null,
        available: item.available ?? true
      })) : []
      
      setProducts(products)
    } catch (error) {
      // Error ya manejado
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos desde el backend",
        variant: "destructive"
      })
      // Set empty array to show the error
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchIngredients = async () => {
    try {
      const response = await api.get('/api/ingredients?pageSize=1000')
      setIngredients(response.data.ingredients)
    } catch (error) {
      // Error ya manejado
    }
  }

  const fetchRecipes = async (productId: string) => {
    try {
      const response = await api.get(`/api/recipes?productId=${productId}`)
      setRecipes(response.data)
    } catch (error) {
      // Error ya manejado
      toast({
        title: "Error",
        description: "No se pudieron cargar las recetas",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchProducts(), fetchIngredients()])
      setLoading(false)
    }
    loadData()
  }, [])

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    fetchRecipes(product.id)
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Use the same direct backend call as the working products management
      const productData = {
        name: newProductForm.name,
        category: newProductForm.category,
        price: newProductForm.price,
        description: newProductForm.description,
        available: true
      }

      const response = await fetch(`${backendUrl}/menu/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const newProduct = await response.json()
      
      // Transform to our expected format
      const product = {
        id: newProduct.id.toString(),
        name: newProduct.name,
        category: newProduct.category,
        price: parseFloat(newProduct.price),
        description: newProduct.description || null,
        available: newProduct.available ?? true
      }
      
      toast({
        title: "Éxito",
        description: "Producto creado correctamente"
      })
      
      // Add the new product to the list
      setProducts(prev => [...prev, product])
      
      // Reset form and close modal
      setNewProductForm({ name: '', category: '', price: 0, description: '' })
      setShowProductModal(false)
      
      // Auto-select the new product to start configuring its recipe
      setSelectedProduct(product)
      setRecipes([]) // Start with empty recipe
      
      toast({
        title: "Producto seleccionado",
        description: "Ahora puedes agregar ingredientes a la receta de este producto"
      })
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Error al crear el producto',
        variant: "destructive"
      })
    }
  }

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !selectedIngredientId || !quantity) return

    try {
      await api.post('/api/recipes', {
        productId: selectedProduct.id,
        ingredientId: selectedIngredientId,
        quantity: parseFloat(quantity)
      })
      
      toast({
        title: "Éxito",
        description: "Ingrediente agregado a la receta"
      })
      
      setSelectedIngredientId('')
      setQuantity('')
      setShowRecipeModal(false)
      fetchRecipes(selectedProduct.id)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.data?.error || 'Error al agregar ingrediente',
        variant: "destructive"
      })
    }
  }

  const handleUpdateQuantity = async (ingredientId: string, newQuantity: number) => {
    if (!selectedProduct) return

    try {
      await api.patch('/api/recipes', {
        productId: selectedProduct.id,
        ingredientId,
        quantity: newQuantity
      })
      
      toast({
        title: "Éxito",
        description: "Cantidad actualizada"
      })
      
      fetchRecipes(selectedProduct.id)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.data?.error || 'Error al actualizar receta',
        variant: "destructive"
      })
    }
  }

  const handleDeleteRecipe = async (ingredientId: string) => {
    if (!selectedProduct || !confirm('¿Estás seguro de que quieres eliminar este ingrediente de la receta?')) return
    
    try {
      await api.delete('/api/recipes', {
        productId: selectedProduct.id,
        ingredientId
      })
      
      toast({
        title: "Éxito",
        description: "Ingrediente eliminado de la receta"
      })
      
      fetchRecipes(selectedProduct.id)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.data?.error || 'Error al eliminar ingrediente',
        variant: "destructive"
      })
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

  const getMarginPercentage = () => {
    const cost = calculateEstimatedCost()
    if (!selectedProduct || cost === 0) return 0
    return ((selectedProduct.price - cost) / selectedProduct.price) * 100
  }

  const availableIngredients = ingredients.filter(
    ingredient => !recipes.find(recipe => recipe.ingredientId === ingredient.id)
  )

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.category.toLowerCase().includes(productSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Recetas y Stock</h2>
          <p className="text-gray-600">Configura las recetas de tus productos y analiza los costos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchProducts}
            disabled={productsLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${productsLoading ? 'animate-spin' : ''}`} />
            Actualizar Productos
          </Button>
          <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
            <DialogTrigger asChild>
              <Button className="bg-gray-900 hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Producto</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo producto al menú. Después podrás configurar su receta.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre del Producto</Label>
                  <Input
                    id="name"
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    placeholder="Ej: Cappuccino, Croissant..."
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    placeholder="Ej: Bebidas, Pastelería..."
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="price">Precio de Venta</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductForm.price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, price: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    value={newProductForm.description}
                    onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                    placeholder="Describe brevemente el producto..."
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowProductModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                    Crear Producto
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Productos ({products.length})
            </CardTitle>
            <CardDescription>
              Selecciona un producto para configurar su receta
            </CardDescription>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] px-6 pb-6">
              <div className="space-y-2">
                {productsLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {productSearch ? 'No se encontraron productos' : 'No hay productos disponibles'}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <Button
                      key={product.id}
                      variant={selectedProduct?.id === product.id ? "default" : "outline"}
                      className="w-full justify-start h-auto p-3"
                      onClick={() => handleProductSelect(product)}
                    >
                      <div className="text-left w-full">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500 flex justify-between">
                          <span>{product.category}</span>
                          <span>${product.price.toFixed(2)}</span>
                        </div>
                        {product.description && (
                          <div className="text-xs text-gray-400 mt-1 truncate">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recipe Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  {selectedProduct ? `Receta: ${selectedProduct.name}` : 'Selecciona un Producto'}
                </CardTitle>
                {selectedProduct && (
                  <CardDescription>
                    {selectedProduct.category} - ${selectedProduct.price.toFixed(2)}
                    {selectedProduct.description && (
                      <div className="mt-1">{selectedProduct.description}</div>
                    )}
                  </CardDescription>
                )}
              </div>
              {selectedProduct && (
                <Dialog open={showRecipeModal} onOpenChange={setShowRecipeModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gray-900 hover:bg-gray-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Ingrediente
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Ingrediente a la Receta</DialogTitle>
                      <DialogDescription>
                        Agrega un nuevo ingrediente a la receta de {selectedProduct.name}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddRecipe} className="space-y-4">
                      <div>
                        <Label htmlFor="ingredient">Ingrediente</Label>
                        <Select
                          value={selectedIngredientId}
                          onValueChange={setSelectedIngredientId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableIngredients.map(ingredient => (
                              <SelectItem key={ingredient.id} value={ingredient.id}>
                                {ingredient.name} ({ingredient.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="quantity">Cantidad</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="Cantidad necesaria"
                          required
                        />
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowRecipeModal(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                          Agregar
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedProduct ? (
              <div className="text-center py-8 text-gray-500">
                Selecciona un producto de la lista para configurar su receta
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ChefHat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="mb-2">Esta receta está vacía</p>
                <p className="text-sm">Agrega el primer ingrediente para comenzar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Costo Unitario</TableHead>
                    <TableHead>Costo Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipes.map((recipe) => (
                    <TableRow key={recipe.ingredientId}>
                      <TableCell className="font-medium">{recipe.name}</TableCell>
                      <TableCell>{recipe.unit}</TableCell>
                      <TableCell>
                        <Input
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
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        {recipe.unitCost ? `$${recipe.unitCost.toFixed(4)}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {recipe.unitCost ? `$${(recipe.quantity * recipe.unitCost).toFixed(4)}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRecipe(recipe.ingredientId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost Analysis */}
      {selectedProduct && recipes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${calculateEstimatedCost().toFixed(4)}</p>
                  <p className="text-sm text-gray-600">Costo de Ingredientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${selectedProduct.price.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Precio de Venta</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ${(selectedProduct.price - calculateEstimatedCost()).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">Ganancia Bruta</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  getMarginPercentage() > 60 ? 'bg-green-100' : 
                  getMarginPercentage() > 30 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <TrendingUp className={`w-5 h-5 ${
                    getMarginPercentage() > 60 ? 'text-green-600' : 
                    getMarginPercentage() > 30 ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{getMarginPercentage().toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">Margen de Ganancia</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedProduct && recipes.some(r => !r.unitCost) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
              <p className="text-sm">
                <strong>Nota:</strong> Algunos ingredientes no tienen costo unitario configurado. 
                Los cálculos de costos pueden no ser precisos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 