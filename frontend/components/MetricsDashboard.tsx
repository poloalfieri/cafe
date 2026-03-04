"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, DollarSign, ShoppingCart, CreditCard, Clock } from "lucide-react"
import { useTranslations } from "next-intl"

type MetricsPeriod = { type?: string; days?: number; from?: string; to?: string }

interface MetricsData {
  salesMonthly: { labels: string[]; values: number[] }
  ordersStatus: {
    labels: string[]
    values: number[]
    period?: MetricsPeriod
  }
  dailyRevenue: { labels: string[]; values: number[] }
  paymentMethods: {
    labels: string[]
    values: number[]
    period?: MetricsPeriod
  }
  topProducts: {
    items: Array<{
      product_id?: string | number
      name: string
      quantity: number
      orders_count?: number
      image_url?: string | null
    }>
    period?: MetricsPeriod
  }
  peakHours: { labels: string[]; values: number[] }
}

const EMPTY_METRICS: MetricsData = {
  salesMonthly: { labels: [], values: [] },
  ordersStatus: { labels: [], values: [] },
  dailyRevenue: { labels: [], values: [] },
  paymentMethods: { labels: [], values: [] },
  topProducts: { items: [] },
  peakHours: { labels: [], values: [] },
}

const COLORS = {
  primary: "#8884d8",
  secondary: "#82ca9d",
  accent: "#ffc658",
  danger: "#ff7300",
  success: "#00C49F",
  warning: "#FFBB28",
}

const STALE_TIME = 3 * 60 * 60 * 1000 // 3 hours

interface MetricsDashboardProps {
  branchId?: string
}

export default function MetricsDashboard({ branchId }: MetricsDashboardProps) {
  const t = useTranslations("admin.metrics")
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const backendUrl = getTenantApiBase()
  const tzOffset = -new Date().getTimezoneOffset()
  const token = session?.accessToken

  const metricsQuery = useQuery<MetricsData>({
    queryKey: ["metrics-charts", backendUrl, branchId || "all", tzOffset],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()
      if (branchId) params.set("branch_id", branchId)
      params.set("tzOffset", String(tzOffset))
      const query = params.toString() ? `?${params.toString()}` : ""

      const endpoints = [
        "sales-monthly",
        "orders-status",
        "daily-revenue",
        "payment-methods",
        "top-products",
        "peak-hours",
      ]

      const results = await Promise.all(
        endpoints.map((endpoint) =>
          fetch(`${backendUrl}/metrics/${endpoint}${query}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal,
          })
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              return res.json()
            })
            .catch((err) => {
              if (err?.name === "AbortError") throw err
              return null
            })
        )
      )

      const validate = (result: any, idx: number): any => {
        if (!result || typeof result !== "object") {
          return idx === 4 ? { items: [] } : { labels: [], values: [] }
        }
        if (idx === 4) {
          return Array.isArray(result.items) ? result : { items: [] }
        }
        if (!Array.isArray(result.labels) || !Array.isArray(result.values)) {
          return { labels: [], values: [] }
        }
        return result
      }

      const [salesMonthly, ordersStatus, dailyRevenue, paymentMethods, topProducts, peakHours] =
        results.map(validate)

      return { salesMonthly, ordersStatus, dailyRevenue, paymentMethods, topProducts, peakHours }
    },
    enabled: Boolean(token),
    staleTime: STALE_TIME,
    retry: false,
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["metrics-charts", backendUrl, branchId || "all", tzOffset],
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-AR").format(value)
  }

  const formatPeriodDate = (value?: string) => {
    if (!value) return ""
    const dt = new Date(`${value}T00:00:00`)
    if (Number.isNaN(dt.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt)
  }

  const buildPeriodLabel = (period?: MetricsPeriod) => {
    const from = formatPeriodDate(period?.from)
    if (period?.type === "all_time") {
      if (from) {
        return t("charts.periodAllTimeSince", { from })
      }
      return t("charts.periodAllTime")
    }
    const days = period?.days || 30
    const to = formatPeriodDate(period?.to)
    if (!from || !to) return t("charts.periodFallback", { days })
    return t("charts.periodRange", { days, from, to })
  }

  if (metricsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    )
  }

  if (metricsQuery.isError && !metricsQuery.data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{t("errors.loadMetrics")}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {t("actions.retry")}
          </button>
        </div>
      </div>
    )
  }

  const data = metricsQuery.data ?? EMPTY_METRICS

  const salesMonthlyData =
    data.salesMonthly?.labels?.map((label, index) => ({
      month: label,
      sales: data.salesMonthly?.values?.[index] || 0,
    })) || []

  const ordersStatusData =
    data.ordersStatus?.labels?.map((label, index) => ({
      status: label,
      count: data.ordersStatus?.values?.[index] || 0,
    })) || []

  const dailyRevenueData =
    data.dailyRevenue?.labels?.map((label, index) => ({
      day: label,
      revenue: data.dailyRevenue?.values?.[index] || 0,
    })) || []

  const paymentMethodsData =
    data.paymentMethods?.labels?.map((label, index) => ({
      method: label,
      count: data.paymentMethods?.values?.[index] || 0,
    })) || []

  const topProducts = Array.isArray(data.topProducts?.items) ? data.topProducts.items : []
  const peakHoursData =
    data.peakHours?.labels?.map((label, index) => ({
      hour: label,
      count: data.peakHours?.values?.[index] || 0,
    })) || []

  const topProductsPeriodLabel = buildPeriodLabel(data.topProducts?.period)
  const ordersStatusPeriodLabel = buildPeriodLabel(data.ordersStatus?.period)
  const paymentMethodsPeriodLabel = buildPeriodLabel(data.paymentMethods?.period)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{t("header.title")}</h2>
        <button
          onClick={handleRefresh}
          disabled={metricsQuery.isFetching}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          <Loader2 className={`h-4 w-4 ${metricsQuery.isFetching ? "animate-spin" : ""}`} />
          {t("actions.refresh")}
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* Picos por horario */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t("charts.peakHours")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [formatNumber(value), t("charts.ordersLegend")]}
                />
                <Legend />
                <Bar dataKey="count" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Productos más vendidos */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {t("charts.topProducts")}
            </CardTitle>
            <p className="text-xs text-gray-500">{topProductsPeriodLabel}</p>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-500">{t("charts.topProductsEmpty")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {topProducts.map((item, index) => (
                  <div
                    key={`${item.product_id ?? item.name}-${index}`}
                    className="flex flex-col items-center text-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🍽️</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-gray-800 truncate max-w-[120px]">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {t("charts.topProductsQtyUnits", { count: Math.round(item.quantity || 0) })}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {t("charts.topProductsQtyOrders", { count: Math.round(item.orders_count || 0) })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas Mensuales - LineChart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("charts.monthlySales")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), t("charts.salesLegend")]}
                  labelFormatter={(label) => t("charts.monthLabel", { label })}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke={COLORS.primary}
                  strokeWidth={3}
                  dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ingresos Diarios - BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t("charts.dailyRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), t("charts.revenueLegend")]}
                  labelFormatter={(label) => t("charts.dayLabel", { label })}
                />
                <Legend />
                <Bar dataKey="revenue" fill={COLORS.success} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Estado de Pedidos - PieChart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {t("charts.orderStatus")}
            </CardTitle>
            <p className="text-xs text-gray-500">{ordersStatusPeriodLabel}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ordersStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {ordersStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.success : COLORS.danger} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatNumber(value), t("charts.ordersLegend")]}
                  labelFormatter={(label) => t("charts.statusLabel", { label })}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Métodos de Pago - RadarChart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("charts.paymentMethods")}
            </CardTitle>
            <p className="text-xs text-gray-500">{paymentMethodsPeriodLabel}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={paymentMethodsData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="method" />
                <PolarRadiusAxis tickFormatter={(value) => formatNumber(value)} />
                <Radar
                  name={t("charts.usage")}
                  dataKey="count"
                  stroke={COLORS.accent}
                  fill={COLORS.accent}
                  fillOpacity={0.6}
                />
                <Tooltip
                  formatter={(value: number) => [formatNumber(value), t("charts.transactionsLegend")]}
                  labelFormatter={(label) => t("charts.methodLabel", { label })}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
