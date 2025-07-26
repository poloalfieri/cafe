"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Search,
  CheckCircle,
  XCircle
} from "lucide-react"

interface Product {
  id: string
  name: string
  category: string
  price: number
  available: boolean
  description?: string
}

export default function ProductsManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    description: "",
    available: true
  })

  const categories = [
    "Bebidas",
    "Café",
    "Pastelería",
    "Platos Principales",
    "Entradas",
    "Postres",
    "Especialidades"
  ]

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch("http://localhost:5001/product")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error("Error fetching products:", error)
      // Fallback a datos simulados si la API no está disponible
      const mockProducts: Product[] = [
        {
          id: "1",
          name: "Café Americano",
          category: "Café",
          price: 3.50,
          available: true,
          description: "Café negro tradicional"
        },
        {
          id: "2",
          name: "Cappuccino",
          category: "Café",
          price: 4.00,
          available: true,
          description: "Café con leche espumada"
        },
        {
          id: "3",
          name: "Croissant",
          category: "Pastelería",
          price: 2.50,
          available: true,
          description: "Croissant tradicional francés"
        },
        {
          id: "4",
          name: "Tarta de Manzana",
          category: "Postres",
          price: 5.00,
          available: false,
          description: "Tarta casera de manzana"
        }
      ]
      setProducts(mockProducts)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const productData = {
      name: formData.name,
      category: formData.category,
      price: parseFloat(formData.price),
      description: formData.description,
      available: formData.available
    }

    try {
      if (editingProduct) {
        // Actualizar producto existente
        const response = await fetch(`http://localhost:5001/product/${editingProduct.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(productData)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const updatedProduct = await response.json()
        setProducts(products.map(p => p.id === editingProduct.id ? updatedProduct : p))
      } else {
        // Crear nuevo producto
        const response = await fetch("http://localhost:5001/product", {
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
        setProducts([...products, newProduct])
      }

      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving product:", error)
      alert("Error al guardar el producto. Por favor, intenta nuevamente.")
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      description: product.description || "",
      available: product.available
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (productId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este producto?")) {
      try {
        const response = await fetch(`http://localhost:5001/product/${productId}`, {
          method: "DELETE"
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        setProducts(products.filter(p => p.id !== productId))
      } catch (error) {
        console.error("Error deleting product:", error)
        alert("Error al eliminar el producto. Por favor, intenta nuevamente.")
      }
    }
  }

  const toggleAvailability = async (productId: string) => {
    try {
      const response = await fetch(`http://localhost:5001/product/${productId}/toggle`, {
        method: "PATCH"
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setProducts(products.map(p => 
        p.id === productId ? { ...p, available: result.available } : p
      ))
    } catch (error) {
      console.error("Error toggling product availability:", error)
      alert("Error al cambiar la disponibilidad del producto. Por favor, intenta nuevamente.")
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      price: "",
      description: "",
      available: true
    })
    setEditingProduct(null)
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Gestión de Productos</h2>
          <p className="text-muted-foreground">Administra el catálogo de productos del local</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Café Americano"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional del producto"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="available">Disponible</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingProduct ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar productos por nombre o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabla de productos */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Producto</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Categoría</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Precio</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-text">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground">{product.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {product.available ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600">Disponible</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">No disponible</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAvailability(product.id)}
                      >
                        {product.available ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              {searchTerm ? "No se encontraron productos" : "No hay productos registrados"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 