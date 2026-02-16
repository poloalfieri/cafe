"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { api, getClientAuthHeaderAsync } from '@/lib/fetcher'
import { useTranslations } from "next-intl"
import { 
  ChefHat, 
  Package, 
  Plus, 
  Trash2, 
  DollarSign,
  TrendingUp,
  Calculator,
  Search,
  RefreshCw,
  ListChecks
} from 'lucide-react'
import ProductOptionsManagement from './product-options-management'

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

interface Category {
  id: string
  name: string
  active: boolean
}

interface RecipiesManagementProps {
  branchId?: string
}

export default function RecipiesManagement({ branchId }: RecipiesManagementProps) {
  const t = useTranslations("admin.recipes")
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
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'recipe' | 'options'>('recipe')
  const [newProductForm, setNewProductForm] = useState<NewProductForm>({
    name: '',
    category: '',
    price: 0,
    description: ''
  })

  const backendUrl = getTenantApiBase()

  const fetchProducts = async () => {
    try {
      setProductsLoading(true)
      const authHeader = await getClientAuthHeaderAsync()
      const params = branchId ? `?branch_id=${branchId}` : ""
      const response = await fetch(`${backendUrl}/menu${params}`, {
        headers: {
          ...authHeader,
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
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
      toast({ title: t("toast.errorTitle"), description: t("toast.loadProductsError"), variant: "destructive" })
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchIngredients = async () => {
    try {
      const params = new URLSearchParams({ pageSize: '1000' })
      if (branchId) {
        params.set('branch_id', branchId)
      }
      const response = await api.get(`${backendUrl}/ingredients?${params.toString()}`)
      // API shape: { data: { ingredients: [...] } }
      const list = (response as any).data?.ingredients || []
      setIngredients(list)
    } catch (error) {
      // Error ya manejado
    }
  }

  const fetchRecipes = async (productId: string) => {
    try {
      const response = await api.get(`${backendUrl}/recipes?productId=${productId}`)
      const data = (response as any).data || []
      setRecipes(data)
    } catch (error) {
      // Error ya manejado
      toast({ title: t("toast.errorTitle"), description: t("toast.loadRecipesError"), variant: "destructive" })
    }
  }

  const fetchCategories = async (currentBranchId: string) => {
    setCategoriesLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/menu-categories?branch_id=${currentBranchId}`, {
        headers: { ...authHeader }
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      const list = Array.isArray(data?.categories) ? data.categories : []
      setCategories(list)
    } catch (_) {
      setCategories([])
    } finally {
      setCategoriesLoading(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchProducts(), fetchIngredients()])
      setLoading(false)
    }
    loadData()
  }, [branchId])

  useEffect(() => {
    if (!branchId) {
      setCategories([])
      return
    }
    fetchCategories(branchId)
  }, [branchId])

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setActiveTab('recipe')
    fetchRecipes(product.id)
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId) {
      toast({ title: t("toast.errorTitle"), description: t("categories.branchRequired"), variant: "destructive" })
      return
    }
    try {
      const productData = {
        name: newProductForm.name,
        category: newProductForm.category,
        price: newProductForm.price,
        description: newProductForm.description,
        available: true,
        branch_id: branchId
      }
      const response = await fetch(`${backendUrl}/menu`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...await getClientAuthHeaderAsync(),
        },
        body: JSON.stringify(productData)
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const newProduct = await response.json()
      const product = {
        id: newProduct.id.toString(),
        name: newProduct.name,
        category: newProduct.category,
        price: parseFloat(newProduct.price),
        description: newProduct.description || null,
        available: newProduct.available ?? true
      }
      toast({ title: t("toast.successTitle"), description: t("toast.productCreated") })
      setProducts(prev => [...prev, product])
      setNewProductForm({ name: '', category: '', price: 0, description: '' })
      setShowProductModal(false)
      setSelectedProduct(product)
      setRecipes([])
      toast({ title: t("toast.productSelectedTitle"), description: t("toast.productSelectedDescription") })
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: error.message || t("toast.createProductError"), variant: "destructive" })
    }
  }

  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !selectedIngredientId || !quantity) return
    try {
      await api.post(`${backendUrl}/recipes`, {
        productId: selectedProduct.id,
        ingredientId: selectedIngredientId,
        quantity: parseFloat(quantity)
      })
      toast({ title: t("toast.successTitle"), description: t("toast.ingredientAdded") })
      setSelectedIngredientId('')
      setQuantity('')
      setShowRecipeModal(false)
      fetchRecipes(selectedProduct.id)
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: (error as any).data?.error || t("toast.addIngredientError"), variant: "destructive" })
    }
  }

  const handleUpdateQuantity = async (ingredientId: string, newQuantity: number) => {
    if (!selectedProduct) return
    try {
      await api.patch(`${backendUrl}/recipes`, {
        productId: selectedProduct.id,
        ingredientId,
        quantity: newQuantity
      })
      toast({ title: t("toast.successTitle"), description: t("toast.quantityUpdated") })
      fetchRecipes(selectedProduct.id)
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: (error as any).data?.error || t("toast.updateRecipeError"), variant: "destructive" })
    }
  }

  const handleDeleteRecipe = async (ingredientId: string) => {
    if (!selectedProduct || !confirm(t("confirmDeleteIngredient"))) return
    try {
      await api.delete(`${backendUrl}/recipes`, { productId: selectedProduct.id, ingredientId })
      toast({ title: t("toast.successTitle"), description: t("toast.ingredientDeleted") })
      fetchRecipes(selectedProduct.id)
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: (error as any).data?.error || t("toast.deleteIngredientError"), variant: "destructive" })
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
          <h2 className="text-2xl font-bold text-gray-900">{t("header.title")}</h2>
          <p className="text-gray-600">{t("header.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchProducts}
            disabled={productsLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${productsLoading ? 'animate-spin' : ''}`} />
            {t("actions.refreshProducts")}
          </Button>
          <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
            <DialogTrigger asChild>
              <Button className="bg-gray-900 hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                {t("actions.newProduct")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialog.newProductTitle")}</DialogTitle>
                <DialogDescription>
                  {t("dialog.newProductDescription")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("form.name")}</Label>
                  <Input id="name" value={newProductForm.name} onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })} placeholder={t("form.namePlaceholder")} required />
                </div>
                <div>
                  <Label htmlFor="category">{t("form.category")}</Label>
                  <Select value={newProductForm.category} onValueChange={(value) => setNewProductForm({ ...newProductForm, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("form.categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.active !== false).map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                      {categories.length === 0 && (
                        <SelectItem value="__empty__" disabled>
                          {categoriesLoading ? t("categories.loading") : t("categories.empty")}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="price">{t("form.price")}</Label>
                  <Input id="price" type="number" step="0.01" min="0" value={newProductForm.price} onChange={(e) => setNewProductForm({ ...newProductForm, price: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div>
                  <Label htmlFor="description">{t("form.description")}</Label>
                  <Textarea id="description" value={newProductForm.description} onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })} placeholder={t("form.descriptionPlaceholder")} rows={3} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowProductModal(false)}>
                    {t("actions.cancel")}
                  </Button>
                  <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                    {t("actions.createProduct")}
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
              {t("products.title", { count: products.length })}
            </CardTitle>
            <CardDescription>
              {t("products.subtitle")}
            </CardDescription>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input placeholder={t("products.searchPlaceholder")} value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-10" />
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
                    {productSearch ? t("products.emptySearch") : t("products.emptyDefault")}
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const isSelected = selectedProduct?.id === product.id
                    return (
                    <Button key={product.id} variant={isSelected ? "default" : "outline"} className="w-full justify-start h-auto p-3" onClick={() => handleProductSelect(product)}>
                      <div className="text-left w-full">
                        <div className="font-medium">{product.name}</div>
                        <div className={`text-sm flex justify-between ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                          <span>{product.category}</span>
                          <span>${product.price.toFixed(2)}</span>
                        </div>
                        {product.description && (
                          <div className={`text-xs mt-1 truncate ${isSelected ? "text-gray-400" : "text-gray-400"}`}>
                            {product.description}
                          </div>
                        )}
                      </div>
                    </Button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recipe & Options Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  {selectedProduct ? t("recipe.titleWithProduct", { name: selectedProduct.name }) : t("recipe.titleEmpty")}
                </CardTitle>
                {selectedProduct && (
                  <CardDescription>
                    {t("recipe.productMeta", { category: selectedProduct.category, price: selectedProduct.price.toFixed(2) })}
                    {selectedProduct.description && (
                      <div className="mt-1">{selectedProduct.description}</div>
                    )}
                  </CardDescription>
                )}
              </div>
              {selectedProduct && activeTab === 'recipe' && (
                <Dialog open={showRecipeModal} onOpenChange={setShowRecipeModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gray-900 hover:bg-gray-800">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("actions.addIngredient")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("dialog.addIngredientTitle")}</DialogTitle>
                      <DialogDescription>
                        {t("dialog.addIngredientDescription", { name: selectedProduct.name })}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddRecipe} className="space-y-4">
                      <div>
                        <Label htmlFor="ingredient">{t("form.ingredient")}</Label>
                        <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("form.ingredientPlaceholder")} />
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
                        <Label htmlFor="quantity">{t("form.quantity")}</Label>
                        <Input id="quantity" type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("form.quantityPlaceholder")} required />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setShowRecipeModal(false)}>
                          {t("actions.cancel")}
                        </Button>
                        <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                          {t("actions.add")}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Tabs: Receta / Opcionales */}
            {selectedProduct && (
              <div className="flex gap-1 mt-3 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('recipe')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'recipe'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ChefHat className="w-4 h-4" />
                  {t("tabs.recipe")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('options')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'options'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                  {t("tabs.options")}
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedProduct ? (
              <div className="text-center py-8 text-gray-500">
                {t("recipe.emptySelect")}
              </div>
            ) : activeTab === 'recipe' ? (
              /* ─── Recipe Tab ─── */
              recipes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ChefHat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="mb-2">{t("recipe.emptyTitle")}</p>
                  <p className="text-sm">{t("recipe.emptySubtitle")}</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("table.ingredient")}</TableHead>
                          <TableHead>{t("table.unit")}</TableHead>
                          <TableHead>{t("table.quantity")}</TableHead>
                          <TableHead>{t("table.unitCost")}</TableHead>
                          <TableHead>{t("table.totalCost")}</TableHead>
                          <TableHead className="text-right">{t("table.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipes.map((recipe) => (
                          <TableRow key={recipe.ingredientId}>
                            <TableCell className="font-medium">{recipe.name}</TableCell>
                            <TableCell>{recipe.unit}</TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" min="0.01" value={recipe.quantity} onChange={(e) => {
                                const newQuantity = parseFloat(e.target.value)
                                if (newQuantity > 0) {
                                  handleUpdateQuantity(recipe.ingredientId, newQuantity)
                                }
                              }} className="w-20" />
                            </TableCell>
                            <TableCell>
                              {recipe.unitCost ? `$${recipe.unitCost.toFixed(4)}` : t("table.notAvailable")}
                            </TableCell>
                            <TableCell>
                              {recipe.unitCost ? `$${(recipe.quantity * recipe.unitCost).toFixed(4)}` : t("table.notAvailable")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleDeleteRecipe(recipe.ingredientId)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile card layout */}
                  <div className="md:hidden divide-y divide-gray-200">
                    {recipes.map((recipe) => (
                      <div key={recipe.ingredientId} className="py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{recipe.name}</span>
                          <span className="text-xs text-gray-500">{recipe.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">{t("table.quantity")}</label>
                            <Input type="number" step="0.01" min="0.01" value={recipe.quantity} onChange={(e) => {
                              const newQuantity = parseFloat(e.target.value)
                              if (newQuantity > 0) {
                                handleUpdateQuantity(recipe.ingredientId, newQuantity)
                              }
                            }} className="w-full" />
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{t("table.unitCost")}: {recipe.unitCost ? `$${recipe.unitCost.toFixed(4)}` : t("table.notAvailable")}</p>
                            <p className="text-sm font-medium">{t("table.totalCost")}: {recipe.unitCost ? `$${(recipe.quantity * recipe.unitCost).toFixed(4)}` : t("table.notAvailable")}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteRecipe(recipe.ingredientId)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              /* ─── Options Tab ─── */
              <ProductOptionsManagement
                product={selectedProduct}
                ingredients={ingredients}
                branchId={branchId}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost Analysis */}
      {selectedProduct && recipes.length > 0 && activeTab === 'recipe' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">${calculateEstimatedCost().toFixed(4)}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{t("summary.ingredientsCost")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">${selectedProduct.price.toFixed(2)}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{t("summary.salePrice")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">
                    ${(selectedProduct.price - calculateEstimatedCost()).toFixed(2)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">{t("summary.grossProfit")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  getMarginPercentage() > 60 ? 'bg-green-100' : 
                  getMarginPercentage() > 30 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    getMarginPercentage() > 60 ? 'text-green-600' : 
                    getMarginPercentage() > 30 ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{getMarginPercentage().toFixed(1)}%</p>
                  <p className="text-xs sm:text-sm text-gray-600">{t("summary.margin")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
