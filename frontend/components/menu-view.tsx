"use client"

import { useState, useEffect } from "react"
import { Bell, Search, Plus, Minus, Trash2, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart, Product } from "@/contexts/cart-context"
import CallWaiterModal from "./call-waiter-modal"
import { useSearchParams } from "next/navigation"
import InstructionsModal from "./instructions-modal"
import FloatingCartBar from "./floating-cart-bar"
import CategoryFiltersModal from "./category-filters-modal"
import { useTranslations } from "next-intl"
import { toast } from "@/hooks/use-toast"

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
  const { state, addItem, updateQuantity, removeItem } = useCart()
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")
  const [showCallWaiterModal, setShowCallWaiterModal] = useState<boolean>(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showFiltersModal, setShowFiltersModal] = useState<boolean>(false)
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

  const handleSearch = (query: string): void => {
    setSearchQuery(query)
    setSelectedCategory(t("all"))
  }

  const handleAddToCart = (product: ApiProduct): void => {
    const cartProduct: Product = {
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description,
      category: product.category,
      image: product.image
    }
    addItem(cartProduct)
  }

  const handleQuantityChange = (productId: string, newQuantity: number): void => {
    if (newQuantity <= 0) {
      // Si la cantidad es 0 o menor, eliminar el producto del carrito
      removeItem(productId)
    } else {
      updateQuantity(productId, newQuantity)
    }
  }

  const getProductQuantity = (productId: string): number => {
    const item = state.items.find(item => item.id === productId)
    return item ? item.quantity : 0
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
                  const quantity = getProductQuantity(product.id)
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
                                  className="rounded-full bg-primary hover:bg-primary-hover text-white px-6 py-2 flex items-center gap-2 flex-shrink-0"
                                >
                                  <Plus className="w-4 h-4" />
                                  {t("add")}
                                </Button>
                              ) : (
                              <div className="flex items-center gap-2 bg-secondary rounded-full px-2 py-1.5 flex-shrink-0">
                                <Button
                                  onClick={() => handleQuantityChange(product.id, quantity - 1)}
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
                                  onClick={() => handleQuantityChange(product.id, quantity + 1)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full hover:bg-card p-0 flex-shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5 text-text" />
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
                    const quantity = getProductQuantity(product.id)
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
                            size="sm"
                            className="rounded-full bg-primary hover:bg-primary-hover text-white px-4 py-2 flex items-center gap-2 flex-shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            {t("add")}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-secondary rounded-full px-2 py-1 flex-shrink-0">
                            <Button
                              onClick={() => handleQuantityChange(product.id, quantity - 1)}
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
                              onClick={() => handleQuantityChange(product.id, quantity + 1)}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-card p-0"
                            >
                              <Plus className="w-3 h-3 text-text" />
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
