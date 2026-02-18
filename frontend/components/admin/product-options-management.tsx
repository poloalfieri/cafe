"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { api } from "@/lib/fetcher"
import { useTranslations } from "next-intl"
import {
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Settings2,
  ListChecks,
  GripVertical,
  Package,
  DollarSign,
  AlertCircle,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────

interface OptionItem {
  id: string
  groupId: string
  ingredientId: string
  priceAddition: number
  ingredientName: string
  ingredientUnit: string
  currentStock: number
}

interface OptionGroup {
  id: string
  productId: string
  name: string
  isRequired: boolean
  maxSelections: number
  items: OptionItem[]
}

interface Ingredient {
  id: string
  name: string
  unit: string
  currentStock: number
}

interface Product {
  id: string
  name: string
}

interface ProductOptionsManagementProps {
  product: Product
  ingredients: Ingredient[]
  branchId?: string
}

// ── Component ──────────────────────────────────────────────

export default function ProductOptionsManagement({
  product,
  ingredients,
  branchId,
}: ProductOptionsManagementProps) {
  const t = useTranslations("admin.productOptions")
  const [groups, setGroups] = useState<OptionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Group dialog
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null)
  const [groupForm, setGroupForm] = useState({
    name: "",
    isRequired: false,
    maxSelections: 1,
  })

  // Item dialog
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState({
    ingredientId: "",
    priceAddition: "0",
  })

  const backendUrl = getTenantApiBase()

  // ── Data Fetching ──────────────────────────────────────

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get(`${backendUrl}/product-options/groups?productId=${product.id}`)
      const list = (response as any).data || []
      setGroups(list)
      const allIds = new Set(list.map((g: OptionGroup) => g.id))
      setExpandedGroups(allIds)
    } catch {
      // Silently handle - empty options is not an error
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [product.id, backendUrl])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  // ── Group CRUD ─────────────────────────────────────────

  const openNewGroupDialog = () => {
    setEditingGroup(null)
    setGroupForm({ name: "", isRequired: false, maxSelections: 1 })
    setShowGroupDialog(true)
  }

  const openEditGroupDialog = (group: OptionGroup) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.name,
      isRequired: group.isRequired,
      maxSelections: group.maxSelections,
    })
    setShowGroupDialog(true)
  }

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingGroup) {
        await api.patch(`${backendUrl}/product-options/groups/${editingGroup.id}`, {
          name: groupForm.name,
          isRequired: groupForm.isRequired,
          maxSelections: groupForm.maxSelections,
        })
        toast({ title: t("toast.successTitle"), description: t("toast.groupUpdated") })
      } else {
        await api.post(`${backendUrl}/product-options/groups`, {
          productId: product.id,
          name: groupForm.name,
          isRequired: groupForm.isRequired,
          maxSelections: groupForm.maxSelections,
        })
        toast({ title: t("toast.successTitle"), description: t("toast.groupCreated") })
      }
      setShowGroupDialog(false)
      fetchGroups()
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error?.data?.error || error.message || t("toast.groupSaveError"),
        variant: "destructive",
      })
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm(t("confirmDeleteGroup"))) return
    try {
      await api.delete(`${backendUrl}/product-options/groups/${groupId}`)
      toast({ title: t("toast.successTitle"), description: t("toast.groupDeleted") })
      fetchGroups()
    } catch {
      toast({
        title: t("toast.errorTitle"),
        description: t("toast.groupDeleteError"),
        variant: "destructive",
      })
    }
  }

  // ── Item CRUD ──────────────────────────────────────────

  const openAddItemDialog = (groupId: string) => {
    setTargetGroupId(groupId)
    setItemForm({ ingredientId: "", priceAddition: "0" })
    setShowItemDialog(true)
  }

  const getAvailableIngredients = (groupId: string): Ingredient[] => {
    const group = groups.find((g) => g.id === groupId)
    const usedIds = new Set((group?.items || []).map((i) => i.ingredientId))
    return ingredients.filter((ing) => !usedIds.has(ing.id) && ing.currentStock > 0)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetGroupId || !itemForm.ingredientId) return
    try {
      await api.post(`${backendUrl}/product-options/items`, {
        groupId: targetGroupId,
        ingredientId: itemForm.ingredientId,
        priceAddition: parseFloat(itemForm.priceAddition) || 0,
      })
      toast({ title: t("toast.successTitle"), description: t("toast.itemAdded") })
      setShowItemDialog(false)
      fetchGroups()
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error?.data?.error || error.message || t("toast.itemAddError"),
        variant: "destructive",
      })
    }
  }

  const handleUpdateItemPrice = async (itemId: string, priceAddition: number) => {
    try {
      await api.patch(`${backendUrl}/product-options/items/${itemId}`, { priceAddition })
      toast({ title: t("toast.successTitle"), description: t("toast.priceUpdated") })
      fetchGroups()
    } catch {
      toast({
        title: t("toast.errorTitle"),
        description: t("toast.priceUpdateError"),
        variant: "destructive",
      })
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm(t("confirmDeleteItem"))) return
    try {
      await api.delete(`${backendUrl}/product-options/items/${itemId}`)
      toast({ title: t("toast.successTitle"), description: t("toast.itemDeleted") })
      fetchGroups()
    } catch {
      toast({
        title: t("toast.errorTitle"),
        description: t("toast.itemDeleteError"),
        variant: "destructive",
      })
    }
  }

  // ── UI Helpers ─────────────────────────────────────────

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            {t("subtitle")}
          </p>
        </div>
        <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="bg-gray-900 hover:bg-gray-800"
              onClick={openNewGroupDialog}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("actions.newGroup")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] bg-white">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? t("dialog.editGroupTitle") : t("dialog.newGroupTitle")}
              </DialogTitle>
              <DialogDescription>
                {editingGroup
                  ? t("dialog.editGroupDescription")
                  : t("dialog.newGroupDescription")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">{t("form.groupName")}</Label>
                <Input
                  id="groupName"
                  value={groupForm.name}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, name: e.target.value })
                  }
                  placeholder={t("form.groupNamePlaceholder")}
                  required
                  className="border-gray-300"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("form.isRequired")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("form.isRequiredHint")}
                  </p>
                </div>
                <Switch
                  checked={groupForm.isRequired}
                  onCheckedChange={(checked) =>
                    setGroupForm({ ...groupForm, isRequired: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxSelections">{t("form.maxSelections")}</Label>
                <Input
                  id="maxSelections"
                  type="number"
                  min="1"
                  value={groupForm.maxSelections}
                  onChange={(e) =>
                    setGroupForm({
                      ...groupForm,
                      maxSelections: parseInt(e.target.value) || 1,
                    })
                  }
                  className="border-gray-300 w-24"
                />
                <p className="text-xs text-gray-500">
                  {t("form.maxSelectionsHint")}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGroupDialog(false)}
                >
                  {t("actions.cancel")}
                </Button>
                <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                  {editingGroup ? t("actions.update") : t("actions.create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty State */}
      {groups.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-300 rounded-lg">
          <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">{t("empty.title")}</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            {t("empty.subtitle")}
          </p>
        </div>
      )}

      {/* Option Groups */}
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.id)
        return (
          <Card
            key={group.id}
            className="border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Group Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleExpanded(group.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 hidden sm:block" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                      {group.name}
                    </h4>
                    {group.isRequired ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5">
                        {t("badge.required")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5"
                      >
                        {t("badge.optional")}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {group.maxSelections === 1
                        ? t("badge.selectOne")
                        : t("badge.selectUpTo", {
                            count: group.maxSelections,
                          })}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("groupItemCount", { count: group.items.length })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEditGroupDialog(group)
                  }}
                >
                  <Settings2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteGroup(group.id)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Group Content (expanded) */}
            {isExpanded && (
              <CardContent className="p-0">
                {/* Items List */}
                {group.items.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{t("items.empty")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.ingredientName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{item.ingredientUnit}</span>
                              {item.currentStock <= 0 && (
                                <span className="flex items-center gap-0.5 text-red-500">
                                  <AlertCircle className="w-3 h-3" />
                                  {t("items.noStock")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.priceAddition}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val >= 0) {
                                  handleUpdateItemPrice(item.id, val)
                                }
                              }}
                              className="w-20 h-8 text-sm border-gray-300"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Item Button */}
                <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400"
                    onClick={() => openAddItemDialog(group.id)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("actions.addItem")}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Add Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle>{t("dialog.addItemTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.addItemDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("form.ingredient")}</Label>
              <Select
                value={itemForm.ingredientId}
                onValueChange={(v) =>
                  setItemForm({ ...itemForm, ingredientId: v })
                }
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder={t("form.ingredientPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {targetGroupId &&
                    getAvailableIngredients(targetGroupId).map((ing) => (
                      <SelectItem key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </SelectItem>
                    ))}
                  {targetGroupId &&
                    getAvailableIngredients(targetGroupId).length === 0 && (
                      <SelectItem value="__empty__" disabled>
                        {t("form.noIngredientsAvailable")}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("form.priceAddition")}</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemForm.priceAddition}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, priceAddition: e.target.value })
                  }
                  placeholder="0.00"
                  className="pl-9 border-gray-300"
                />
              </div>
              <p className="text-xs text-gray-500">{t("form.priceAdditionHint")}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowItemDialog(false)}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                {t("actions.add")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
