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
  RefreshCw
} from "lucide-react"
import ProductsManagement from "./admin/products-management"
import PromotionsManagement from "./admin/promotions-management"
import ScheduleManagement from "./admin/schedule-management"

interface DashboardMetrics {
  dailySales: number
  weeklySales: number
  monthlySales: number
  totalOrders: number
  averageOrderValue: number
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
    topProducts: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Simular datos del dashboard - en producción esto vendría de tu API
      const mockData: DashboardMetrics = {
        dailySales: 1250.50,
        weeklySales: 8750.25,
        monthlySales: 32500.75,
        totalOrders: 45,
        averageOrderValue: 27.78,
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
    } finally {
      setLoading(false)
    }
  }

  const refreshData = () => {
    fetchDashboardData()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Settings className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary">Panel de Administración</h1>
                <p className="text-muted-foreground text-sm">Gestión completa del local gastronómico</p>
              </div>
            </div>
            <Button
              onClick={refreshData}
              disabled={loading}
              className="bg-secondary hover:bg-secondary-hover text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.dailySales.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Ventas del Día</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.weeklySales.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Ventas de la Semana</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.monthlySales.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Ventas del Mes</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">{metrics.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Pedidos Totales</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.averageOrderValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Ticket Promedio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Promociones
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Horarios & Mesas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ranking de productos */}
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text">Productos Más Vendidos</h3>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Ver Todos
                  </Button>
                </div>
                <div className="space-y-3">
                  {metrics.topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-text">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.quantity} unidades</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">${product.revenue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Ingresos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gráfico de ventas (placeholder) */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-text mb-4">Tendencia de Ventas</h3>
                <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Gráfico de ventas</p>
                    <p className="text-xs text-muted-foreground">(Integrar librería de gráficos)</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="products">
            <ProductsManagement />
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsManagement />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 