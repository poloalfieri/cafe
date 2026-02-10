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
import { api, getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("admin.dashboard")
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
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>("")

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001"

  useEffect(() => {
    fetchBranches()
    // Low stock check on each load
    ;(async () => {
      try {
        const json = await api.get('/api/ingredients?page=1&pageSize=1000')
        const list = json.data?.ingredients || []
        const lows = list.filter((i: any) => i.trackStock && i.currentStock <= i.minStock)
          .map((i: any) => ({ name: i.name, currentStock: i.currentStock, minStock: i.minStock }))
        setLowStock(lows)
        setShowLowStockDialog(lows.length > 0)
      } catch (_) {}
    })()
  }, [])

  useEffect(() => {
    fetchDashboardData(selectedBranchId)
  }, [selectedBranchId])

  const fetchBranches = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches`, {
        headers: {
          ...authHeader,
        },
      })
      if (!response.ok) {
        return
      }
      const data = await response.json()
      const list = Array.isArray(data?.branches) ? data.branches : []
      setBranches(list)
      if (!selectedBranchId && list.length > 0) {
        setSelectedBranchId(list[0].id)
      }
    } catch (_) {
      // ignore
    }
  }

  const fetchDashboardData = async (branchId?: string) => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const tzOffset = -new Date().getTimezoneOffset()
      const params = new URLSearchParams()
      if (branchId) params.set("branch_id", branchId)
      params.set("tzOffset", String(tzOffset))
      const query = params.toString() ? `?${params.toString()}` : ""
      const summaryResponse = await fetch(`${backendUrl}/api/metrics/summary${query}`, {
        headers: {
          ...authHeader,
        },
      })
      if (!summaryResponse.ok) {
        throw new Error(`Summary error: ${summaryResponse.status}`)
      }
      const summary = await summaryResponse.json()
      setMetrics({
        dailySales: summary.dailySales || 0,
        weeklySales: summary.weeklySales || 0,
        monthlySales: summary.monthlySales || 0,
        totalOrders: summary.totalOrders || 0,
        averageOrderValue: summary.averageOrderValue || 0,
        totalIngredients: summary.totalIngredients || 0,
        lowStockItems: summary.lowStockItems || 0,
        topProducts: Array.isArray(summary.topProducts) ? summary.topProducts : [],
      })
    } catch (error) {
      console.error(t("errors.fetchDashboard"), error)
      setMetrics({
        dailySales: 0,
        weeklySales: 0,
        monthlySales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        totalIngredients: 0,
        lowStockItems: 0,
        topProducts: []
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshData = () => {
    fetchDashboardData(selectedBranchId)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Settings className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text">{t("header.title")}</h1>
                <p className="text-muted-foreground text-sm">{t("header.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {branches.length > 0 && (
                <div className="min-w-[220px]">
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t("branchSelector.label")}
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button
                onClick={refreshData}
                disabled={loading}
                className="bg-primary hover:bg-primary-hover text-white px-4 py-2 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {t("actions.refresh")}
              </Button>
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.dailySales.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.dailySales")}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.weeklySales.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.weeklySales")}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.monthlySales.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.monthlySales")}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">{metrics.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.totalOrders")}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">${metrics.averageOrderValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.averageTicket")}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <Archive className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">{metrics.totalIngredients}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.ingredients")}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-text" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">{metrics.lowStockItems}</p>
                  <p className="text-xs text-muted-foreground">{t("metrics.lowStock")}</p>
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
            <DialogTitle>{t("lowStock.title")}</DialogTitle>
            <DialogDescription>
              {t("lowStock.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {lowStock.map((i, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="font-medium text-text">{i.name}</span>
                <span>
                  {t("lowStock.stockLine", {
                    current: i.currentStock.toFixed(2),
                    min: i.minStock.toFixed(2)
                  })}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
        </Dialog>
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-9 mb-6 bg-card border border-border">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4" />
              {t("tabs.dashboard")}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Package className="w-4 h-4" />
              {t("tabs.products")}
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Archive className="w-4 h-4" />
              {t("tabs.stock")}
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <ChefHat className="w-4 h-4" />
              {t("tabs.recipes")}
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4" />
              {t("tabs.promotions")}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Clock className="w-4 h-4" />
              {t("tabs.schedule")}
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Building className="w-4 h-4" />
              {t("tabs.branches")}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4" />
              {t("tabs.analytics")}
            </TabsTrigger>
            <TabsTrigger value="banking" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <CreditCard className="w-4 h-4" />
              {t("tabs.banking")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <MetricsDashboard branchId={selectedBranchId || undefined} />
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
            <PromotionsManagement branchId={selectedBranchId || undefined} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleManagement branchId={selectedBranchId} />
          </TabsContent>

          <TabsContent value="branches">
            <BranchesManagement />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-text mb-4">{t("analytics.title")}</h3>
              <MetricsDashboard branchId={selectedBranchId || undefined} />
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
