"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Search,
  CheckCircle,
  XCircle
} from "lucide-react"
import { useTranslations } from "next-intl"

interface Product {
  id: string
  name: string
  category: string
  price: number
  available: boolean
  description?: string
  image_url?: string | null
}

export default function ProductsManagement() {
  const t = useTranslations("admin.products")
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
    available: true,
    image_url: ""
  })
  const [imageFile, setImageFile] = useState<File | null>(null)

  const categories = [
    { key: "beverages", label: t("categories.beverages") },
    { key: "coffee", label: t("categories.coffee") },
    { key: "bakery", label: t("categories.bakery") },
    { key: "mainDishes", label: t("categories.mainDishes") },
    { key: "starters", label: t("categories.starters") },
    { key: "desserts", label: t("categories.desserts") },
    { key: "specialties", label: t("categories.specialties") }
  ]

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/menu/`, {
        headers: {
          ...authHeader,
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      toast({
        title: t("toast.errorTitle"),
        description: t("toast.loadError"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let imageUrl = formData.image_url
    if (imageFile) {
      try {
        const form = new FormData()
        form.append("file", imageFile)
        const res = await fetch("/api/upload/menu-image", {
          method: "POST",
          body: form
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || t("toast.uploadError"))
        }
        imageUrl = data.url
      } catch (e: any) {
        console.error("Upload error:", e)
        toast({
          title: t("toast.warningTitle"),
          description: e?.message || t("toast.uploadFallback"),
          variant: "destructive"
        })
        imageUrl = ""
      }
    }

    const productData = {
      name: formData.name,
      category: formData.category,
      price: parseFloat(formData.price),
      description: formData.description,
      available: formData.available,
      image_url: imageUrl || null
    }

    try {
      if (editingProduct) {
        // Actualizar producto existente
        const authHeader = await getClientAuthHeaderAsync()
        const response = await fetch(`${backendUrl}/menu/${editingProduct.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
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
        const authHeader = await getClientAuthHeaderAsync()
        const response = await fetch(`${backendUrl}/menu/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
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
      toast({
        title: t("toast.successTitle"),
        description: editingProduct ? t("toast.updated") : t("toast.created")
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("toast.saveError")
      toast({
        title: t("toast.errorTitle"),
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      description: product.description || "",
      available: product.available,
      image_url: product.image_url || ""
    })
    setImageFile(null)
    setIsDialogOpen(true)
  }

  const handleDelete = async (productId: string) => {
    if (confirm(t("confirmDelete"))) {
      try {
        const authHeader = await getClientAuthHeaderAsync()
        const response = await fetch(`${backendUrl}/menu/${productId}`, {
          method: "DELETE",
          headers: {
            ...authHeader,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        setProducts(products.filter(p => p.id !== productId))
        toast({
          title: t("toast.successTitle"),
          description: t("toast.deleted")
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t("toast.deleteError")
        toast({
          title: t("toast.errorTitle"),
          description: errorMessage,
          variant: "destructive"
        })
      }
    }
  }

  const toggleAvailability = async (productId: string) => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/menu/${productId}/toggle`, {
        method: "PATCH",
        headers: {
          ...authHeader,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setProducts(products.map(p => 
        p.id === productId ? { ...p, available: result.available } : p
      ))
      toast({
        title: t("toast.successTitle"),
        description: t(result.available ? "toast.activated" : "toast.deactivated")
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("toast.toggleError")
      toast({
        title: t("toast.errorTitle"),
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      price: "",
      description: "",
      available: true,
      image_url: ""
    })
    setEditingProduct(null)
    setImageFile(null)
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
          <h2 className="text-2xl font-bold text-gray-900">{t("header.title")}</h2>
          <p className="text-gray-600">{t("header.subtitle")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="bg-gray-900 hover:bg-gray-800 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t("actions.newProduct")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                {editingProduct ? t("dialog.editTitle") : t("dialog.createTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700">{t("form.name")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("form.namePlaceholder")}
                    required
                    className="border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-gray-700">{t("form.category")}</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger className="border-gray-300 focus:border-gray-900 focus:ring-gray-900">
                      <SelectValue placeholder={t("form.categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.key} value={category.label}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price" className="text-gray-700">{t("form.price")}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder={t("form.pricePlaceholder")}
                  required
                  className="border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700">{t("form.description")}</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("form.descriptionPlaceholder")}
                  className="border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image" className="text-gray-700">{t("form.image")}</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
                {formData.image_url && !imageFile && (
                  <p className="text-xs text-gray-500 break-all">
                    {t("form.currentImage")}: {formData.image_url}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="rounded border-gray-300 focus:ring-gray-900"
                />
                <Label htmlFor="available" className="text-gray-700">{t("form.available")}</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-300 hover:bg-gray-50 text-gray-700">
                  {t("actions.cancel")}
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white">
                  {editingProduct ? t("actions.update") : t("actions.create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
        />
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t("table.product")}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t("table.category")}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t("table.price")}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t("table.status")}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-600">{product.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {product.available ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600">{t("status.available")}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">{t("status.unavailable")}</span>
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
                        className={`font-medium transition-all duration-200 ${
                          product.available 
                            ? "border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-800 bg-orange-50/50" 
                            : "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 hover:text-green-800 bg-green-50/50"
                        }`}
                      >
                        {product.available ? t("actions.deactivate") : t("actions.activate")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                        className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-800 bg-blue-50/50 font-medium transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 hover:text-red-800 bg-red-50/50 font-medium transition-all duration-200"
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
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">
              {searchTerm ? t("empty.search") : t("empty.default")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 
