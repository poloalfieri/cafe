"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect, useCallback } from "react"
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
  ChefHat,
  UserPlus
} from "lucide-react"
import ProductsManagement from "./admin/products-management"
import PromotionsManagement from "./admin/promotions-management"
import ScheduleManagement from "./admin/schedule-management"
import MetricsDashboard from "./MetricsDashboard"
import BranchesManagement from "./admin/branches-management"
import BankConfigManagement from "./admin/bank-config-management"
import IngredientsManagement from "./admin/ingredients-management"
import RecipiesManagement from "./admin/recipies-management"
import CashierManagement from "./admin/cashier-management"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useTranslations } from "next-intl"
import { supabase } from "@/lib/auth/supabase-browser"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LogOut } from "lucide-react"

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

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

export default function AdminDashboard() {
  const t = useTranslations("admin.dashboard")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
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
  const [loggingOut, setLoggingOut] = useState(false)
  const [lowStock, setLowStock] = useState<Array<{ name: string; currentStock: number; minStock: number }>>([])
  const [showLowStockDialog, setShowLowStockDialog] = useState(false)
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>("")
  const [branchesReady, setBranchesReady] = useState(false)

  const backendUrl = getTenantApiBase()
  const isMetricsScopeReady = branchesReady && (branches.length === 0 || Boolean(selectedBranchId))

  useEffect(() => {
    fetchBranches()
    // Low stock check on each load
    ;(async () => {
      try {
        const json = await api.get(`${backendUrl}/ingredients?page=1&pageSize=1000`)
        const list = json.data?.ingredients || []
        const lows = list.filter((i: any) => i.trackStock && i.currentStock <= i.minStock)
          .map((i: any) => ({ name: i.name, currentStock: i.currentStock, minStock: i.minStock }))
        setLowStock(lows)
        setShowLowStockDialog(lows.length > 0)
      } catch (_) {}
    })()
  }, [])

  useEffect(() => {
    if (!isMetricsScopeReady) {
      return
    }
    void fetchDashboardData(selectedBranchId || undefined)
  }, [isMetricsScopeReady, selectedBranchId])

  const fetchBranches = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches`, {
        headers: {
          ...authHeader,
        },
      })
      if (!response.ok) {
        setBranches([])
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
    } finally {
      setBranchesReady(true)
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
      const summaryResponse = await fetch(`${backendUrl}/metrics/summary${query}`, {
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

  const handleLogout = useCallback(async () => {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
    } finally {
      sessionStorage.removeItem("supabase_session")
      const qs = searchParams.toString()
      const next = qs ? `${pathname}?${qs}` : pathname
      router.replace(`/login?next=${encodeURIComponent(next)}`)
      setLoggingOut(false)
    }
  }, [pathname, router, searchParams])

  const refreshData = () => {
    if (!isMetricsScopeReady) {
      return
    }
    void fetchDashboardData(selectedBranchId || undefined)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Settings className="text-white w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-text">{t("header.title")}</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">{t("header.subtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {branches.length > 0 && (
                <div className="w-full sm:w-auto sm:min-w-[220px]">
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
                disabled={loading || !isMetricsScopeReady}
                className="bg-primary hover:bg-primary-hover text-white px-3 sm:px-4 py-2 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{t("actions.refresh")}</span>
              </Button>
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                variant="outline"
                className="px-3 sm:px-4 py-2 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{loggingOut ? t("actions.loggingOut") : t("actions.logout")}</span>
              </Button>
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 mb-6">
            {([
              { key: "daily", icon: DollarSign, value: metrics.dailySales, isCurrency: true, label: t("metrics.dailySales") },
              { key: "weekly", icon: TrendingUp, value: metrics.weeklySales, isCurrency: true, label: t("metrics.weeklySales") },
              { key: "monthly", icon: BarChart3, value: metrics.monthlySales, isCurrency: true, label: t("metrics.monthlySales") },
              { key: "orders", icon: ShoppingCart, value: metrics.totalOrders, isCurrency: false, label: t("metrics.totalOrders") },
              { key: "avg", icon: Users, value: metrics.averageOrderValue, isCurrency: true, label: t("metrics.averageTicket") },
              { key: "ingredients", icon: Archive, value: metrics.totalIngredients, isCurrency: false, label: t("metrics.ingredients") },
              { key: "lowStock", icon: Package, value: metrics.lowStockItems, isCurrency: false, label: t("metrics.lowStock") },
            ] as const).map((metric) => {
              const Icon = metric.icon
              const fullValue = metric.isCurrency ? `$${metric.value.toFixed(2)}` : metric.value.toString()
              const compactValue = metric.isCurrency ? formatCompact(metric.value) : metric.value.toString()
              const isExpanded = expandedMetric === metric.key
              return (
                <div
                  key={metric.key}
                  className="bg-card rounded-xl border border-border shadow-sm overflow-hidden cursor-pointer sm:cursor-default active:scale-[0.97] sm:active:scale-100 transition-transform"
                  onClick={() => setExpandedMetric(isExpanded ? null : metric.key)}
                >
                  {/* Mobile: vertical layout */}
                  <div className="sm:hidden p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-text" />
                      </div>
                    </div>
                    <p className={`font-bold text-text leading-tight ${isExpanded && fullValue !== compactValue ? "text-sm" : "text-lg"}`}>
                      {isExpanded ? fullValue : compactValue}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{metric.label}</p>
                  </div>
                  {/* Desktop: horizontal layout (unchanged) */}
                  <div className="hidden sm:block p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-text" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-text">{fullValue}</p>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
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
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mb-6">
            <TabsList className="inline-flex w-auto min-w-full lg:grid lg:w-full lg:grid-cols-9 bg-card border border-border">
              <TabsTrigger value="dashboard" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.dashboard")}</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.products")}</span>
              </TabsTrigger>
              <TabsTrigger value="stock" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.stock")}</span>
              </TabsTrigger>
              <TabsTrigger value="recipes" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <ChefHat className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.recipes")}</span>
              </TabsTrigger>
              <TabsTrigger value="promotions" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.promotions")}</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.schedule")}</span>
              </TabsTrigger>
              <TabsTrigger value="branches" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <Building className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.branches")}</span>
              </TabsTrigger>
              <TabsTrigger value="banking" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.banking")}</span>
              </TabsTrigger>
              <TabsTrigger value="cashiers" className="flex items-center gap-2 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">{t("tabs.cashiers")}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            {isMetricsScopeReady ? (
              <MetricsDashboard branchId={selectedBranchId || undefined} />
            ) : (
              <div className="flex items-center justify-center min-h-[280px]">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="products">
            <ProductsManagement branchId={selectedBranchId || undefined} />
          </TabsContent>

          <TabsContent value="stock">
            <IngredientsManagement branchId={selectedBranchId || undefined} />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipiesManagement branchId={selectedBranchId || undefined} />
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

          <TabsContent value="banking">
            <BankConfigManagement branchId={selectedBranchId || undefined} />
          </TabsContent>

          <TabsContent value="cashiers">
            <CashierManagement branchId={selectedBranchId || undefined} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 
