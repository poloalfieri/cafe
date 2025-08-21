"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, Minus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import MozoPaymentModal from "@/components/mozo-payment-modal"

interface Product {
  id: string
  name: string
  description?: string
  price: number
  category: string
  image?: string
  available: boolean
}

interface CartItem extends Product {
  quantity: number
}

export default function CrearPedidoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const mesa_id = searchParams.get("mesa_id")
  
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [categories, setCategories] = useState<string[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    if (!mesa_id) {
      toast({
        title: "Error",
        description: "No se especificó la mesa",
        variant: "destructive",
      })
      router.push("/mozo")
      return
    }
    
    fetchProducts()
  }, [mesa_id, router, toast])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch("http://localhost:5001/products")
      if (response.ok) {
        const data = await response.json()
        const availableProducts = data.filter((product: Product) => product.available)
        setProducts(availableProducts)
        
        // Extraer categorías únicas
        const uniqueCategories = Array.from(new Set(availableProducts.map((p: Product) => p.category))) as string[]
        setCategories(uniqueCategories)
      } else {
        // Fallback data
        const fallbackProducts: Product[] = [
          { id: "1", name: "Café Americano", description: "Café negro tradicional", price: 3.50, category: "Bebidas", available: true },
          { id: "2", name: "Cappuccino", description: "Café con leche espumada", price: 4.00, category: "Bebidas", available: true },
          { id: "3", name: "Croissant", description: "Croissant de mantequilla", price: 2.50, category: "Panadería", available: true },
          { id: "4", name: "Tarta de Manzana", description: "Tarta casera de manzana", price: 5.00, category: "Postres", available: true },
          { id: "5", name: "Ensalada César", description: "Ensalada con aderezo César", price: 8.50, category: "Platos Principales", available: true },
          { id: "6", name: "Pasta Carbonara", description: "Pasta con salsa carbonara", price: 12.00, category: "Platos Principales", available: true }
        ]
        setProducts(fallbackProducts)
        setCategories(Array.from(new Set(fallbackProducts.map(p => p.category))))
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id)
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        return [...prevCart, { ...product, quantity: 1 }]
      }
    })
    
    toast({
      title: "Producto agregado",
      description: `${product.name} agregado al carrito`,
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      )
    )
  }

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const getFilteredProducts = () => {
    if (selectedCategory === "all") return products
    return products.filter(product => product.category === selectedCategory)
  }

  const handlePaymentComplete = () => {
    // Limpiar carrito y redirigir
    setCart([])
    toast({
      title: "Pedido completado",
      description: `Pedido para Mesa ${mesa_id} completado exitosamente`,
    })
    router.push("/mozo")
  }

  if (!mesa_id) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-gray-100"
                onClick={() => router.push("/mozo")}
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Crear Pedido</h1>
                <p className="text-sm text-gray-600">Mesa {mesa_id}</p>
              </div>
            </div>
            
            {/* Cart Summary */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white px-3 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="font-semibold">{cart.length} items</span>
                  <span className="font-bold">${getCartTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Productos */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
                
                {/* Filtro de categorías */}
                <div className="flex gap-2">
                  <Button
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("all")}
                    className={selectedCategory === "all" ? "bg-blue-600 text-white" : ""}
                  >
                    Todos
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={selectedCategory === category ? "bg-blue-600 text-white" : ""}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando productos...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getFilteredProducts().map((product) => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
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
                            <h3 className="font-semibold text-gray-900 text-sm mb-1">{product.name}</h3>
                            <p className="text-xs text-gray-600 mb-2">{product.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-blue-600">${product.price.toFixed(2)}</span>
                              <Button
                                onClick={() => addToCart(product)}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Carrito */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Carrito</h2>
              
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2 opacity-30">🛒</div>
                  <p className="text-gray-500 text-sm">Carrito vacío</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                          <p className="text-xs text-gray-600">${item.price.toFixed(2)} c/u</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 rounded-full"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          
                          <span className="font-semibold text-gray-900 min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          
                          <Button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            size="icon"
                            className="h-6 w-6 rounded-full bg-blue-600 hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3 text-white" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-lg font-bold text-blue-600">${getCartTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-lg"
                    size="lg"
                  >
                    Pagar ${getCartTotal().toFixed(2)}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pago del Mozo */}
      <MozoPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        mesaId={mesa_id}
        totalAmount={getCartTotal()}
        items={cart.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))}
      />
    </div>
  )
} 