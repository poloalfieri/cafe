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
import { useTranslations } from "next-intl"
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
  minStock: number
  trackStock: boolean
  createdAt: string
  updatedAt: string
}

interface IngredientFormData {
  name: string
  unit: string
  currentStock: number
  unitCost: number | null
  minStock: number
  trackStock: boolean
}

interface IngredientsManagementProps {
  branchId?: string
}

export default function IngredientsManagement({ branchId }: IngredientsManagementProps) {
  const t = useTranslations("admin.ingredients")
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<IngredientFormData>({
    name: '',
    unit: 'g',
    currentStock: 0,
    unitCost: null,
    minStock: 0,
    trackStock: true
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        search: searchTerm
      })
      if (branchId) {
        params.set('branch_id', branchId)
      }
      const response = await api.get(`/api/ingredients?${params.toString()}`)
      setIngredients(response.data.ingredients)
      setTotalPages(response.data.pagination.totalPages)
    } catch (error) {
      console.error('Error fetching ingredients:', error)
      toast({
        title: t("toast.errorTitle"),
        description: t("toast.loadError"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIngredients()
  }, [page, searchTerm, branchId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.patch(`/api/ingredients/${editingId}`, {
          ...formData,
          branch_id: branchId
        })
        toast({
          title: t("toast.successTitle"),
          description: t("toast.updated")
        })
      } else {
        await api.post('/api/ingredients', {
          ...formData,
          branch_id: branchId
        })
        toast({
          title: t("toast.successTitle"),
          description: t("toast.created")
        })
      }
      
      setShowModal(false)
      setEditingId(null)
      setFormData({ name: '', unit: 'g', currentStock: 0, unitCost: null, minStock: 0, trackStock: true })
      fetchIngredients()
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error.data?.error || t("toast.saveError"),
        variant: "destructive"
      })
    }
  }

  const handleEdit = (ingredient: Ingredient) => {
    setFormData({
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: ingredient.currentStock,
      unitCost: ingredient.unitCost,
      minStock: ingredient.minStock,
      trackStock: ingredient.trackStock
    })
    setEditingId(ingredient.id)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return
    
    try {
      await api.delete(`/api/ingredients/${id}`, {
        branch_id: branchId
      })
      toast({
        title: t("toast.successTitle"),
        description: t("toast.deleted")
      })
      fetchIngredients()
    } catch (error: any) {
      if (error.status === 409) {
        toast({
          title: t("toast.errorTitle"),
          description: t("toast.deleteInUse"),
          variant: "destructive"
        })
      } else {
        toast({
          title: t("toast.errorTitle"),
          description: t("toast.deleteError"),
          variant: "destructive"
        })
      }
    }
  }

  const openNewModal = () => {
    setFormData({ name: '', unit: 'g', currentStock: 0, unitCost: null, minStock: 0, trackStock: true })
    setEditingId(null)
    setShowModal(true)
  }

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock <= 0) return { variant: 'destructive' as const, label: t("status.none") }
    if (stock <= minStock) return { variant: 'destructive' as const, label: t("status.min") }
    if (stock < minStock * 2) return { variant: 'secondary' as const, label: t("status.low") }
    return { variant: 'default' as const, label: t("status.ok") }
  }

  const filteredIngredients = ingredients.filter(ingredient =>
    ingredient.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("header.title")}</h2>
          <p className="text-gray-600">{t("header.subtitle")}</p>
        </div>
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogTrigger asChild>
            <Button onClick={openNewModal} className="bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-2" />
              {t("actions.new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
              <DialogDescription>
                {editingId ? t("dialog.editDescription") : t("dialog.newDescription")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">{t("form.name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("form.namePlaceholder")}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="unit">{t("form.unit")}</Label>
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
                <Label htmlFor="currentStock">{t("form.currentStock")}</Label>
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
                <Label htmlFor="unitCost">{t("form.unitCost")}</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitCost || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    unitCost: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="minStock">{t("form.minStock")}</Label>
                <Input
                  id="minStock"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="trackStock"
                  type="checkbox"
                  checked={formData.trackStock}
                  onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
                />
                <Label htmlFor="trackStock">{t("form.trackStock")}</Label>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  {t("actions.cancel")}
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                  {editingId ? t("actions.update") : t("actions.create")}
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
                <p className="text-sm text-gray-600">{t("stats.total")}</p>
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
                <p className="text-sm text-gray-600">{t("stats.lowStock")}</p>
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
                <p className="text-sm text-gray-600">{t("stats.totalStock")}</p>
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
                <p className="text-sm text-gray-600">{t("stats.inventoryValue")}</p>
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
              placeholder={t("searchPlaceholder")}
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
          <CardTitle>{t("table.title")}</CardTitle>
          <CardDescription>
            {t("table.subtitle")}
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
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.unit")}</TableHead>
                  <TableHead>{t("table.currentStock")}</TableHead>
                  <TableHead>{t("table.min")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.unitCost")}</TableHead>
                  <TableHead>{t("table.totalValue")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((ingredient) => {
                  const status = getStockStatus(ingredient.currentStock, ingredient.minStock)
                  return (
                    <TableRow key={ingredient.id} className={ingredient.currentStock <= ingredient.minStock ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell>{ingredient.unit}</TableCell>
                      <TableCell>{ingredient.currentStock.toFixed(2)}</TableCell>
                      <TableCell>{ingredient.minStock.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell>
                        {ingredient.unitCost != null ? `$${ingredient.unitCost.toFixed(2)}` : t("table.notAvailable")}
                      </TableCell>
                      <TableCell>
                        {ingredient.unitCost != null ? `$${(ingredient.currentStock * ingredient.unitCost).toFixed(2)}` : t("table.notAvailable")}
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
            {t("pagination.prev")}
          </Button>
          <span className="flex items-center px-4">
            {t("pagination.status", { page, totalPages })}
          </span>
          <Button 
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            {t("pagination.next")}
          </Button>
        </div>
      )}
    </div>
  )
} 
