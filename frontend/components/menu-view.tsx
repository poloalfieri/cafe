"use client"

import { useState, useEffect } from "react"
import { Bell, Search, Plus, Minus, Trash2, SlidersHorizontal, X, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart, Product } from "@/contexts/cart-context"
import CallWaiterModal from "./call-waiter-modal"
import { useSearchParams } from "next/navigation"
import InstructionsModal from "./instructions-modal"
import FloatingCartBar from "./floating-cart-bar"
import CategoryFiltersModal from "./category-filters-modal"
import { useTranslations } from "next-intl"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  buildCartLineId,
  calculateSelectedOptionsTotal,
  type ProductOptionGroup,
  type ProductOptionItem,
  type SelectedProductOption,
} from "@/lib/product-options"

// Tipo para los productos que vienen de la API
interface ApiProduct {
  id: string
  name: string
  description?: string
  price: number
  category: string
  image?: string
  image_url?: string
  available?: boolean
}

export default function MenuView() {
  const { addItem, removeOneByProductId, getProductQuantity } = useCart()
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")
  const [showCallWaiterModal, setShowCallWaiterModal] = useState<boolean>(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showFiltersModal, setShowFiltersModal] = useState<boolean>(false)
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(false)
  const [optionsProduct, setOptionsProduct] = useState<ApiProduct | null>(null)
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([])
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({})
  const [optionsLoadingProductId, setOptionsLoadingProductId] = useState<string | null>(null)
  const t = useTranslations("usuario.menu")
  useEffect(() => {
    setSelectedCategory(t("all"))
  }, [t])
  
  // Obtener parámetros de la URL
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  const branch_id = searchParams.get("branch_id")

  const getMesaSession = (): { mesa_id: string | null; token: string | null; branch_id: string | null } => {
    if (mesa_id && token && branch_id) return { mesa_id, token, branch_id }
    if (typeof window === "undefined") return { mesa_id, token, branch_id }
    try {
      const stored = sessionStorage.getItem("mesa_session")
      if (!stored) return { mesa_id, token, branch_id }
      const parsed = JSON.parse(stored)
      return {
        mesa_id: typeof parsed?.mesa_id === "string" ? parsed.mesa_id : mesa_id,
        token: typeof parsed?.token === "string" ? parsed.token : token,
        branch_id: typeof parsed?.branch_id === "string" ? parsed.branch_id : branch_id
      }
    } catch {
      return { mesa_id, token, branch_id }
    }
  }

  // Función helper para obtener categorías únicas sin usar Set
  const getUniqueCategories = (products: ApiProduct[]): string[] => {
    const categoryMap: { [key: string]: boolean } = {}
    products.forEach(product => {
      categoryMap[product.category] = true
    })
    return [t("all"), ...Object.keys(categoryMap)]
  }

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true)
      setError("")

      const session = getMesaSession()
      if (!session.mesa_id || !session.branch_id) {
        setError("No se pudo identificar la mesa")
        return
      }

      const query = `?mesa_id=${encodeURIComponent(session.mesa_id)}&branch_id=${encodeURIComponent(session.branch_id)}`
      const { apiFetchTenant } = await import('@/lib/apiClient')
      const data: ApiProduct[] = await apiFetchTenant(`/menu${query}`)
      
      const normalized = Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        image: item.image || item.image_url || undefined
      })) : []
      setProducts(normalized)
      
      const uniqueCategories = getUniqueCategories(normalized)
      setCategories(uniqueCategories)
      
    } catch (err) {
      setError("No se pudo cargar el menú")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // Filtrar productos basado en categoría, búsqueda y disponibilidad
  // y ordenar alfabéticamente por nombre dentro de cada categoría
  const filteredProducts = products
    .filter((product: ApiProduct) => {
      const matchesCategory = selectedCategory === t("all") || product.category === selectedCategory
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const isAvailable = product.available !== false // Mostrar solo productos disponibles
      return matchesCategory && matchesSearch && isAvailable
    })
    .sort((a: ApiProduct, b: ApiProduct) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    )

  const normalizePrice = (value: number): number => Math.round(value * 100) / 100

  const buildBaseCartProduct = (product: ApiProduct): Product => {
    const basePrice = normalizePrice(Number(product.price) || 0)
    return {
      id: String(product.id),
      name: product.name,
      price: basePrice,
      basePrice,
      description: product.description,
      category: product.category,
      image: product.image,
      selectedOptions: [],
      lineId: buildCartLineId(String(product.id), []),
    }
  }

  const fetchProductOptionGroups = async (productId: string): Promise<ProductOptionGroup[]> => {
    const { apiFetchTenant } = await import("@/lib/apiClient")
    const response = await apiFetchTenant(
      `/product-options/groups?productId=${encodeURIComponent(productId)}`
    )
    return Array.isArray(response?.data) ? response.data : []
  }

  const closeOptionsDialog = (): void => {
    setShowOptionsDialog(false)
    setOptionsProduct(null)
    setOptionGroups([])
    setSelectedOptionIds({})
  }

  const handleAddToCart = async (product: ApiProduct): Promise<void> => {
    const productId = String(product.id)
    setOptionsLoadingProductId(productId)
    try {
      const groups = await fetchProductOptionGroups(productId)
      if (groups.length === 0) {
        addItem(buildBaseCartProduct(product))
        return
      }

      setOptionsProduct(product)
      setOptionGroups(groups)
      setSelectedOptionIds({})
      setShowOptionsDialog(true)
    } catch {
      toast({
        title: t("options.errorTitle"),
        description: t("options.loadError"),
        variant: "destructive",
      })
    } finally {
      setOptionsLoadingProductId(null)
    }
  }

  const getSelectedIdsForGroup = (groupId: string): string[] => {
    return selectedOptionIds[groupId] || []
  }

  const isOptionSelected = (groupId: string, itemId: string): boolean => {
    return getSelectedIdsForGroup(groupId).includes(itemId)
  }

  const toggleOptionSelection = (group: ProductOptionGroup, item: ProductOptionItem): void => {
    if ((item.currentStock || 0) <= 0) return

    setSelectedOptionIds((previous) => {
      const currentGroupSelection = previous[group.id] || []
      const alreadySelected = currentGroupSelection.includes(item.id)

      if (group.maxSelections <= 1) {
        return {
          ...previous,
          [group.id]: alreadySelected ? [] : [item.id],
        }
      }

      if (alreadySelected) {
        return {
          ...previous,
          [group.id]: currentGroupSelection.filter((id) => id !== item.id),
        }
      }

      if (currentGroupSelection.length >= group.maxSelections) {
        toast({
          title: t("options.maxReachedTitle"),
          description: t("options.maxReachedBody", {
            group: group.name,
            count: group.maxSelections,
          }),
        })
        return previous
      }

      return {
        ...previous,
        [group.id]: [...currentGroupSelection, item.id],
      }
    })
  }

  const getDialogSelectedOptions = (): SelectedProductOption[] => {
    const selectedOptions: SelectedProductOption[] = []
    optionGroups.forEach((group) => {
      const selectedIds = getSelectedIdsForGroup(group.id)
      selectedIds.forEach((selectedId) => {
        const selectedItem = group.items.find((item) => item.id === selectedId)
        if (!selectedItem || (selectedItem.currentStock || 0) <= 0) return
        selectedOptions.push({
          id: selectedItem.id,
          groupId: group.id,
          groupName: group.name,
          ingredientId: selectedItem.ingredientId,
          ingredientName: selectedItem.ingredientName,
          priceAddition: normalizePrice(selectedItem.priceAddition || 0),
        })
      })
    })
    return selectedOptions
  }

  const requiredGroupWithoutStock = optionGroups.find((group) => {
    if (!group.isRequired) return false
    return !group.items.some((item) => (item.currentStock || 0) > 0)
  })

  const missingRequiredSelection = optionGroups.find((group) => {
    if (!group.isRequired) return false
    return getSelectedIdsForGroup(group.id).length === 0
  })

  const selectedDialogOptions = getDialogSelectedOptions()
  const dialogOptionsTotal = calculateSelectedOptionsTotal(selectedDialogOptions)
  const dialogBasePrice = normalizePrice(Number(optionsProduct?.price || 0))
  const dialogFinalPrice = normalizePrice(dialogBasePrice + dialogOptionsTotal)

  const handleConfirmOptions = (): void => {
    if (!optionsProduct) return

    if (requiredGroupWithoutStock) {
      toast({
        title: t("options.errorTitle"),
        description: t("options.requiredNoStock", { group: requiredGroupWithoutStock.name }),
        variant: "destructive",
      })
      return
    }

    if (missingRequiredSelection) {
      toast({
        title: t("options.errorTitle"),
        description: t("options.requiredMissing", { group: missingRequiredSelection.name }),
        variant: "destructive",
      })
      return
    }

    const cartProduct: Product = {
      id: String(optionsProduct.id),
      name: optionsProduct.name,
      price: dialogFinalPrice,
      basePrice: dialogBasePrice,
      description: optionsProduct.description,
      category: optionsProduct.category,
      image: optionsProduct.image,
      selectedOptions: selectedDialogOptions,
      lineId: buildCartLineId(String(optionsProduct.id), selectedDialogOptions),
    }

    addItem(cartProduct)
    closeOptionsDialog()
  }

  const handleDecreaseProduct = (productId: string): void => {
    removeOneByProductId(productId)
  }

  const getTotalProductQuantity = (productId: string): number => {
    return getProductQuantity(productId)
  }

  const handleCallWaiter = (): void => {
    setShowCallWaiterModal(true)
  }

  const handleConfirmCallWaiter = async (data: { message?: string }): Promise<void> => {
    try {
      const session = getMesaSession()
      if (!session.mesa_id || !session.token || !session.branch_id) {
        setShowCallWaiterModal(false)
        return
      }
      
      const { getTenantApiBase } = await import('@/lib/apiClient')
      const response = await fetch(`${getTenantApiBase()}/waiter/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          mesa_id: session.mesa_id,
          branch_id: session.branch_id,
          token: session.token,
          message: data.message || ""
        }),
      })

      if (response.ok) {
        toast({
          title: t("calledTitle"),
          description: t("calledBody")
        })
      } else {
        toast({
          title: t("callErrorTitle"),
          description: t("callErrorBody"),
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: t("callErrorTitle"),
        description: t("callErrorBody"),
        variant: "destructive"
      })
    } finally {
      setShowCallWaiterModal(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value
    setSearchQuery(value)
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden w-full max-w-full">
      {/* Header moderno con mejor contraste */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm w-full">
        <div className="container mx-auto px-4 py-3 max-w-full">
          <div className="flex items-center justify-between">
            {/* Search bar desktop */}
            <div className="hidden sm:flex items-center bg-gray-100 rounded-full px-4 py-2 min-w-[300px]">
              <Search className="w-4 h-4 text-gray-600 mr-2" />
              <input 
                type="text" 
                placeholder={t("searchDesktopPlaceholder")}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none flex-1 text-sm text-gray-900 placeholder:text-gray-500"
              />
            </div>

            {/* Actions con mejor contraste - botón de mozo más llamativo */}
            <div className="ml-auto flex items-center gap-2">
              <Button 
                onClick={handleCallWaiter}
                className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Bell className="w-5 h-5" />
                <span className="text-sm font-medium">{t("waiter")}</span>
              </Button>
            </div>
          </div>

          {/* Search bar móvil */}
          <div className="sm:hidden mt-3">
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
              <Search className="w-4 h-4 text-gray-600 mr-2" />
              <input 
                type="text" 
                placeholder={t("searchMobilePlaceholder")}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none flex-1 text-sm text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 pb-32">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("exploreTitle")}</h1>
          <p className="text-gray-600 text-sm">{t("exploreSubtitle")}</p>
        </div>
        {/* Categories - Single chip status + Filters button */}
        <div className="sticky top-[73px] bg-gray-50 z-40 w-full overflow-hidden">
          <div className="w-full px-4 py-3">
            <div className="flex gap-3 items-center justify-between w-full max-w-full">
              {/* Chip de estado único - muestra categoría actual */}
              <Button
                onClick={() => {
                  if (selectedCategory !== t("all")) {
                    setSelectedCategory(t("all"))
                  }
                }}
                variant={selectedCategory === t("all") ? "default" : "outline"}
                className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === t("all")
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="truncate max-w-[200px]">{selectedCategory}</span>
                {selectedCategory !== t("all") && (
                  <X className="w-4 h-4 flex-shrink-0" />
                )}
              </Button>
              
              {/* Botón de "Filtros" - siempre visible */}
              <Button
                onClick={() => setShowFiltersModal(true)}
                variant="outline"
                className="rounded-full px-4 py-2 text-sm font-medium bg-white text-gray-700 border-gray-300 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>{t("filters")}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t("loadingMenu")}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-destructive mb-4">❌ {error}</div>
            <Button onClick={fetchProducts} variant="outline" className="border-border hover:bg-secondary">
              {t("retry")}
            </Button>
          </div>
        )}

        {/* Products List */}
        {!loading && !error && (
          <>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4 opacity-30">🍽️</div>
                <h3 className="text-lg font-semibold text-text mb-2">{t("noResultsTitle")}</h3>
                <p className="text-muted-foreground">{t("noResultsSubtitle")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((product: ApiProduct) => {
                  const quantity = getTotalProductQuantity(String(product.id))
                  const isLoadingOptions = optionsLoadingProductId === String(product.id)
                  return (
                    <div key={product.id} className="bg-card rounded-xl p-4 shadow-sm border border-border hover:shadow-md transition-all duration-200 overflow-hidden">
                      <div className="flex items-center gap-4 w-full">
                        {/* Product Image */}
                        <div className="relative w-20 h-20 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <span className="text-3xl">🍽️</span>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <h3 className="font-semibold text-text text-lg mb-1 truncate">{product.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {product.description || t("defaultDescription")}
                          </p>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span className="text-xl font-bold text-text flex-shrink-0">${product.price.toFixed(0)}</span>
                            
                            {/* Selector de cantidad mejorado */}
                            {quantity === 0 ? (
                                <Button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={isLoadingOptions}
                                  className="rounded-full bg-primary hover:bg-primary-hover text-white px-6 py-2 flex items-center gap-2 flex-shrink-0"
                                >
                                  {isLoadingOptions ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                  {isLoadingOptions ? t("options.loading") : t("add")}
                                </Button>
                              ) : (
                              <div className="flex items-center gap-2 bg-secondary rounded-full px-2 py-1.5 flex-shrink-0">
                                <Button
                                  onClick={() => handleDecreaseProduct(String(product.id))}
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full hover:bg-card p-0 flex-shrink-0"
                                >
                                  {quantity === 1 ? (
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  ) : (
                                    <Minus className="w-3.5 h-3.5 text-text" />
                                  )}
                                </Button>
                                
                                <span className="font-semibold text-text min-w-[24px] text-center text-sm">
                                  {quantity}
                                </span>
                                
                                <Button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={isLoadingOptions}
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full hover:bg-card p-0 flex-shrink-0"
                                >
                                  {isLoadingOptions ? (
                                    <Loader2 className="w-3.5 h-3.5 text-text animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 text-text" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Best Selling Section mejorada */}
            {products.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-text mb-6">{t("bestSellers")}</h2>
                <div className="space-y-4">
                  {products.slice(0, 3).map((product: ApiProduct) => {
                    const quantity = getTotalProductQuantity(String(product.id))
                    const isLoadingOptions = optionsLoadingProductId === String(product.id)
                    return (
                      <div key={product.id} className="flex items-center gap-4 bg-card rounded-xl p-4 shadow-sm border border-border">
                        <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <span className="text-2xl">🍽️</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-text text-sm">{product.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                          <p className="font-bold text-text mt-1">${product.price.toFixed(0)}</p>
                        </div>
                        
                        {/* Selector de cantidad para más vendidos */}
                        {quantity === 0 ? (
                          <Button
                            onClick={() => handleAddToCart(product)}
                            disabled={isLoadingOptions}
                            size="sm"
                            className="rounded-full bg-primary hover:bg-primary-hover text-white px-4 py-2 flex items-center gap-2 flex-shrink-0"
                          >
                            {isLoadingOptions ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            {isLoadingOptions ? t("options.loading") : t("add")}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-secondary rounded-full px-2 py-1 flex-shrink-0">
                            <Button
                              onClick={() => handleDecreaseProduct(String(product.id))}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-card p-0"
                            >
                              {quantity === 1 ? (
                                <Trash2 className="w-3 h-3 text-destructive" />
                              ) : (
                                <Minus className="w-3 h-3 text-text" />
                              )}
                            </Button>
                            
                            <span className="font-semibold text-text min-w-[20px] text-center text-xs">
                              {quantity}
                            </span>
                            
                            <Button
                              onClick={() => handleAddToCart(product)}
                              disabled={isLoadingOptions}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-card p-0"
                            >
                              {isLoadingOptions ? (
                                <Loader2 className="w-3 h-3 text-text animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3 text-text" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <Dialog open={showOptionsDialog} onOpenChange={(open) => !open && closeOptionsDialog()}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
            <DialogTitle className="text-gray-900">
              {t("options.title", { product: optionsProduct?.name || "" })}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {t("options.subtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-5">
            {optionGroups.map((group) => {
              const selectedCount = getSelectedIdsForGroup(group.id).length
              const requiredNoStock =
                group.isRequired && !group.items.some((item) => (item.currentStock || 0) > 0)

              return (
                <div key={group.id} className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      <p className="text-xs text-gray-500">
                        {group.maxSelections <= 1
                          ? t("options.selectOne")
                          : t("options.selectUpTo", { count: group.maxSelections })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          group.isRequired
                            ? "bg-rose-100 text-rose-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {group.isRequired ? t("options.required") : t("options.optional")}
                      </span>
                      <p className="mt-1 text-xs text-gray-500">
                        {t("options.selectedCount", {
                          count: selectedCount,
                          max: group.maxSelections,
                        })}
                      </p>
                    </div>
                  </div>

                  {requiredNoStock && (
                    <p className="text-xs text-red-600">{t("options.requiredGroupNoStock")}</p>
                  )}

                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const selected = isOptionSelected(group.id, item.id)
                      const outOfStock = (item.currentStock || 0) <= 0
                      const groupSelections = getSelectedIdsForGroup(group.id)
                      const reachedLimit =
                        !selected &&
                        group.maxSelections > 1 &&
                        groupSelections.length >= group.maxSelections
                      const disabled = outOfStock || reachedLimit

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleOptionSelection(group, item)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            selected
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {selected ? <Check className="w-4 h-4 shrink-0" /> : null}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.ingredientName}</p>
                                <p
                                  className={`text-xs ${
                                    selected ? "text-white/80" : "text-gray-500"
                                  }`}
                                >
                                  {outOfStock
                                    ? t("options.noStock")
                                    : item.priceAddition > 0
                                      ? t("options.extraPrice", {
                                          price: normalizePrice(item.priceAddition).toFixed(2),
                                        })
                                      : t("options.noExtraPrice")}
                                </p>
                              </div>
                            </div>
                            {outOfStock ? (
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                                  selected ? "bg-white/20 text-white" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {t("options.outOfStock")}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold">
                                {item.priceAddition > 0
                                  ? `+$${normalizePrice(item.priceAddition).toFixed(2)}`
                                  : "$0.00"}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="w-full space-y-3">
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>{t("options.basePrice")}</span>
                  <span>${dialogBasePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("options.optionsTotal")}</span>
                  <span>${dialogOptionsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-2">
                  <span>{t("options.finalPrice")}</span>
                  <span>${dialogFinalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closeOptionsDialog}>
                  {t("options.cancel")}
                </Button>
                <Button
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={handleConfirmOptions}
                  disabled={Boolean(requiredGroupWithoutStock || missingRequiredSelection)}
                >
                  {t("options.confirm")}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CallWaiterModal
        isOpen={showCallWaiterModal}
        onConfirm={handleConfirmCallWaiter}
        onCancel={() => setShowCallWaiterModal(false)}
      />
      
      <InstructionsModal
        isOpen={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
      />

      <CategoryFiltersModal
        isOpen={showFiltersModal}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onClose={() => setShowFiltersModal(false)}
      />

      {/* Floating Cart Bar - Zona del pulgar y visibilidad del estado */}
      <FloatingCartBar />
    </div>
  )
}
