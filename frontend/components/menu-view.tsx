"use client"

import { useState, useEffect } from "react"
import { Bell, ShoppingCart, RefreshCw, Search, Heart, Plus, Minus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart, Product } from "@/contexts/cart-context"
import Link from "next/link"
import CallWaiterModal from "./call-waiter-modal"
import { useSearchParams } from "next/navigation"
import InstructionsModal from "./instructions-modal"
import { useTranslations } from "next-intl"

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
  const [likedItems, setLikedItems] = useState<string[]>([])
  const t = useTranslations("usuario.menu")
  useEffect(() => {
    setSelectedCategory(t("all"))
  }, [t])

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)
  
  // Obtener parámetros de la URL
  const searchParams = useSearchParams()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")

  const getMesaSession = (): { mesa_id: string | null; token: string | null } => {
    if (mesa_id && token) return { mesa_id, token }
    if (typeof window === "undefined") return { mesa_id, token }
    try {
      const stored = sessionStorage.getItem("mesa_session")
      if (!stored) return { mesa_id, token }
      const parsed = JSON.parse(stored)
      return {
        mesa_id: typeof parsed?.mesa_id === "string" ? parsed.mesa_id : mesa_id,
        token: typeof parsed?.token === "string" ? parsed.token : token
      }
    } catch {
      return { mesa_id, token }
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

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'

  // Mantener exactamente la misma llamada a la API que ya tienes
  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true)
      setError("")
      
      const response = await fetch(`${backendUrl}/menu/`)
      if (!response.ok) throw new Error("Error al cargar el menú")
      
      const data: ApiProduct[] = await response.json()
      const normalized = Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        image: item.image || item.image_url || undefined
      })) : []
      setProducts(normalized)
      
      // Extraer categorías únicas sin usar Set
      const uniqueCategories = getUniqueCategories(data)
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
  const filteredProducts = products.filter((product: ApiProduct) => {
    const matchesCategory = selectedCategory === t("all") || product.category === selectedCategory
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const isAvailable = product.available !== false // Mostrar solo productos disponibles
    return matchesCategory && matchesSearch && isAvailable
  })

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

  const toggleLike = (productId: string): void => {
    setLikedItems(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId)
      } else {
        return [...prev, productId]
      }
    })
  }

  const isLiked = (productId: string): boolean => {
    return likedItems.includes(productId)
  }

  const handleCallWaiter = (): void => {
    setShowCallWaiterModal(true)
  }

  const handleConfirmCallWaiter = async (data: { message?: string, paymentMethod: 'CARD' | 'CASH' | 'QR' }): Promise<void> => {
    try {
      const session = getMesaSession()
      if (!session.mesa_id || !session.token) {
        setShowCallWaiterModal(false)
        return
      }
      
      const response = await fetch(`${backendUrl}/waiter/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          mesa_id: session.mesa_id,
          token: session.token,
          payment_method: data.paymentMethod,
          message: data.message || ""
        }),
      })

      if (response.ok) {
        // Llamada al mozo exitosa
      } else {
        // Error ya manejado silenciosamente
      }
    } catch (error) {
      // Error ya manejado silenciosamente
    } finally {
      setShowCallWaiterModal(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value
    setSearchQuery(value)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderno con mejor contraste */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Search bar desktop */}
            <div className="hidden sm:flex items-center bg-gray-100 rounded-full px-4 py-2 min-w-[300px]">
              <Search className="w-4 h-4 text-gray-500 mr-2" />
              <input 
                type="text" 
                placeholder={t("searchDesktopPlaceholder")}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none flex-1 text-sm text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Actions con mejor contraste - botón de mozo más llamativo */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleCallWaiter}
                className="rounded-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">{t("waiter")}</span>
              </Button>

              <Link href={`/usuario/cart`}>
                <Button variant="ghost" size="icon" className="rounded-full relative hover:bg-gray-100">
                  <ShoppingCart className="w-5 h-5 text-gray-700" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>

          {/* Search bar móvil */}
          <div className="sm:hidden mt-3">
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
              <Search className="w-4 h-4 text-gray-500 mr-2" />
              <input 
                type="text" 
                placeholder={t("searchMobilePlaceholder")}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none flex-1 text-sm text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("exploreTitle")}</h1>
            <p className="text-gray-600 text-sm">{t("exploreSubtitle")}</p>
          </div>
          <Button
            onClick={fetchProducts}
            variant="outline"
            size="icon"
            className="rounded-full border-gray-300 hover:bg-gray-50 w-10 h-10"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 text-gray-700 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Categories con mejor padding */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {categories.map((category: string) => (
            <Button
              key={category}
              onClick={() => setSelectedCategory(category)}
              variant={selectedCategory === category ? "default" : "outline"}
              className={`whitespace-nowrap rounded-full px-6 py-3 text-sm font-medium ${
                selectedCategory === category
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">{t("loadingMenu")}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">❌ {error}</div>
            <Button onClick={fetchProducts} variant="outline" className="border-gray-300 hover:bg-gray-50">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("noResultsTitle")}</h3>
                <p className="text-gray-600">{t("noResultsSubtitle")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((product: ApiProduct) => {
                  const quantity = getProductQuantity(product.id)
                  return (
                    <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-4">
                        {/* Product Image */}
                        <div className="relative w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white w-6 h-6"
                            onClick={() => toggleLike(product.id)}
                          >
                            <Heart className={`w-3 h-3 ${isLiked(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                          </Button>
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
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">{product.name}</h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {product.description || t("defaultDescription")}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                            
                            {/* Selector de cantidad mejorado */}
                            {quantity === 0 ? (
                              <Button
                                onClick={() => handleAddToCart(product)}
                                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                {t("add")}
                              </Button>
                            ) : (
                              <div className="flex items-center gap-3 bg-gray-50 rounded-full px-3 py-2">
                                <Button
                                  onClick={() => handleQuantityChange(product.id, quantity - 1)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full hover:bg-white"
                                >
                                  {quantity === 1 ? (
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  ) : (
                                    <Minus className="w-4 h-4 text-gray-700" />
                                  )}
                                </Button>
                                
                                <span className="font-semibold text-gray-900 min-w-[20px] text-center">
                                  {quantity}
                                </span>
                                
                                <Button
                                  onClick={() => handleQuantityChange(product.id, quantity + 1)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full hover:bg-white"
                                >
                                  <Plus className="w-4 h-4 text-gray-700" />
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
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t("bestSellers")}</h2>
                <div className="space-y-4">
                  {products.slice(0, 3).map((product: ApiProduct) => {
                    const quantity = getProductQuantity(product.id)
                    return (
                      <div key={product.id} className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
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
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                          <p className="text-xs text-gray-600">{product.description}</p>
                          <p className="font-bold text-gray-900 mt-1">${product.price.toFixed(2)}</p>
                        </div>
                        
                        {/* Selector de cantidad para más vendidos */}
                        {quantity === 0 ? (
                          <Button
                            onClick={() => handleAddToCart(product)}
                            size="sm"
                            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 flex items-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            {t("add")}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 bg-gray-50 rounded-full px-2 py-1">
                            <Button
                              onClick={() => handleQuantityChange(product.id, quantity - 1)}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-white"
                            >
                              {quantity === 1 ? (
                                <Trash2 className="w-3 h-3 text-red-600" />
                              ) : (
                                <Minus className="w-3 h-3 text-gray-700" />
                              )}
                            </Button>
                            
                            <span className="font-semibold text-gray-900 min-w-[16px] text-center text-sm">
                              {quantity}
                            </span>
                            
                            <Button
                              onClick={() => handleQuantityChange(product.id, quantity + 1)}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-white"
                            >
                              <Plus className="w-3 h-3 text-gray-700" />
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
    </div>
  )
}
