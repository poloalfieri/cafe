"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Settings, 
  Package,
  Clock,
  BarChart3,
  Plus,
  RefreshCw,
  Building,
  CreditCard,
  Share,
  Archive,
  ChefHat
} from "lucide-react"
import ProductsManagement from "./admin/products-management"
import PromotionsManagement from "./admin/promotions-management"
import ScheduleManagement from "./admin/schedule-management"
import MetricsDashboard from "./MetricsDashboard"
import BranchesManagement from "./admin/branches-management"
import BankConfigManagement from "./admin/bank-config-management"
import IngredientsManagement from "./admin/ingredients-management"
import RecipiesManagement from "./admin/recipies-management"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface DashboardMetrics {
  dailySales: number
  weeklySales: number
  monthlySales: number
  totalOrders: number
  averageOrderValue: number
  totalIngredients: number
  lowStockItems: number
  topProducts: Array<{
    name: string
    quantity: number
    revenue: number
  }>
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalIngredients: 0,
    lowStockItems: 0,
    topProducts: []
  })
  const [loading, setLoading] = useState(true)
  const [lowStock, setLowStock] = useState<Array<{ name: string; currentStock: number; minStock: number }>>([])
  const [showLowStockDialog, setShowLowStockDialog] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    // Low stock check on each load
    ;(async () => {
      try {
        const res = await fetch('/api/ingredients?page=1&pageSize=1000')
        const json = await res.json()
        const list = json.data?.ingredients || []
        const lows = list.filter((i: any) => i.trackStock && i.currentStock <= i.minStock)
          .map((i: any) => ({ name: i.name, currentStock: i.currentStock, minStock: i.minStock }))
        setLowStock(lows)
        setShowLowStockDialog(lows.length > 0)
      } catch (_) {}
    })()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch ingredients data from API
      const ingredientsResponse = await fetch('/api/ingredients')
      const ingredientsData = await ingredientsResponse.json()
      
      const totalIngredients = ingredientsData.data?.ingredients?.length || 0
      const lowStockItems = ingredientsData.data?.ingredients?.filter((ing: any) => ing.currentStock < 100).length || 0

      // Simular datos del dashboard - en producción esto vendría de tu API
      const mockData: DashboardMetrics = {
        dailySales: 1250.50,
        weeklySales: 8750.25,
        monthlySales: 32500.75,
        totalOrders: 45,
        averageOrderValue: 27.78,
        totalIngredients,
        lowStockItems,
        topProducts: [
          { name: "Café Americano", quantity: 28, revenue: 98.00 },
          { name: "Croissant", quantity: 22, revenue: 55.00 },
          { name: "Cappuccino", quantity: 18, revenue: 72.00 },
          { name: "Tarta de Manzana", quantity: 15, revenue: 75.00 },
          { name: "Café Latte", quantity: 12, revenue: 48.00 }
        ]
      }
      setMetrics(mockData)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      // Fallback to mock data
      setMetrics({
        dailySales: 1250.50,
        weeklySales: 8750.25,
        monthlySales: 32500.75,
        totalOrders: 45,
        averageOrderValue: 27.78,
        totalIngredients: 5,
        lowStockItems: 1,
        topProducts: [
          { name: "Café Americano", quantity: 28, revenue: 98.00 },
          { name: "Croissant", quantity: 22, revenue: 55.00 },
          { name: "Cappuccino", quantity: 18, revenue: 72.00 },
          { name: "Tarta de Manzana", quantity: 15, revenue: 75.00 },
          { name: "Café Latte", quantity: 12, revenue: 48.00 }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshData = () => {
    fetchDashboardData()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <Settings className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
                <p className="text-gray-600 text-sm">Gestión completa del local gastronómico</p>
              </div>
            </div>
            <Button
              onClick={refreshData}
              disabled={loading}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">${metrics.dailySales.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">Ventas del Día</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">${metrics.weeklySales.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">Ventas Semanales</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">${metrics.monthlySales.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">Ventas Mensuales</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalOrders}</p>
                  <p className="text-xs text-gray-600">Pedidos Totales</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">${metrics.averageOrderValue.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">Ticket Promedio</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Archive className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalIngredients}</p>
                  <p className="text-xs text-gray-600">Ingredientes</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  metrics.lowStockItems > 0 ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  <Package className={`w-5 h-5 ${
                    metrics.lowStockItems > 0 ? 'text-red-600' : 'text-green-600'
                  }`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{metrics.lowStockItems}</p>
                  <p className="text-xs text-gray-600">Stock Bajo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-6">
        <Dialog open={showLowStockDialog} onOpenChange={setShowLowStockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stock mínimo alcanzado</DialogTitle>
              <DialogDescription>
                Los siguientes ingredientes están en mínimo. Reponer stock y revisar productos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {lowStock.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span>
                    {i.currentStock.toFixed(2)} / min {i.minStock.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-9 mb-6 bg-white border border-gray-200">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <Package className="w-4 h-4" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <Archive className="w-4 h-4" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <ChefHat className="w-4 h-4" />
              Recetas
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4" />
              Promociones
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <Clock className="w-4 h-4" />
              Horarios & Mesas
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <Building className="w-4 h-4" />
              Sucursales
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="banking" className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white">
              <CreditCard className="w-4 h-4" />
              Cuenta Bancaria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <MetricsDashboard />
          </TabsContent>

          <TabsContent value="products">
            <ProductsManagement />
          </TabsContent>

          <TabsContent value="stock">
            <IngredientsManagement />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipiesManagement />
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsManagement />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleManagement />
          </TabsContent>

          <TabsContent value="branches">
            <BranchesManagement />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas Avanzadas</h3>
              <MetricsDashboard />
            </div>
          </TabsContent>

          <TabsContent value="banking">
            <BankConfigManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 