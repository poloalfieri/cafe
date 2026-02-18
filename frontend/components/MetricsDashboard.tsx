"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect, useCallback, useRef } from "react"
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
import { Loader2, TrendingUp, DollarSign, ShoppingCart, CreditCard } from "lucide-react"
import { useTranslations } from "next-intl"

interface MetricsData {
  salesMonthly: { labels: string[]; values: number[] }
  ordersStatus: { labels: string[]; values: number[] }
  dailyRevenue: { labels: string[]; values: number[] }
  paymentMethods: { labels: string[]; values: number[] }
}

function getApiBaseUrl() {
  return getTenantApiBase()
}

const COLORS = {
  primary: "#8884d8",
  secondary: "#82ca9d",
  accent: "#ffc658",
  danger: "#ff7300",
  success: "#00C49F",
  warning: "#FFBB28",
}

interface MetricsDashboardProps {
  branchId?: string
}

export default function MetricsDashboard({ branchId }: MetricsDashboardProps) {
  const t = useTranslations("admin.metrics")
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()
  const inFlightKeyRef = useRef<string | null>(null)
  const completedKeyRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchMetricsData = useCallback(async (force = false) => {
    if (!session?.accessToken) {
      setError(t("errors.noSession"))
      setLoading(false)
      return
    }
 
    const tzOffset = -new Date().getTimezoneOffset()
    const requestKey = `${session.accessToken}|${branchId || "all"}|${tzOffset}`
    if (!force && completedKeyRef.current === requestKey) {
      return
    }
    if (inFlightKeyRef.current === requestKey) {
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    inFlightKeyRef.current = requestKey

    setLoading(true)
    setError(null)

    try {
      const endpoints = [
        "sales-monthly",
        "orders-status",
        "daily-revenue",
        "payment-methods",
      ]

      const params = new URLSearchParams()
      if (branchId) params.set("branch_id", branchId)
      params.set("tzOffset", String(tzOffset))
      const query = params.toString() ? `?${params.toString()}` : ""

      const results = await Promise.all(
        endpoints.map((endpoint) =>
          fetch(`${getApiBaseUrl()}/metrics/${endpoint}${query}`, {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`)
              }
              return res.json()
            })
            .catch((err) => {
              if (err?.name === "AbortError") {
                throw err
              }
              return { labels: [], values: [] }
            }),
        ),
      )

      // Validar que todos los resultados tengan la estructura correcta
      const validatedResults = results.map((result) => {
        if (!result || typeof result !== "object") {
          return { labels: [], values: [] }
        }
        if (!Array.isArray(result.labels) || !Array.isArray(result.values)) {
          return { labels: [], values: [] }
        }
        return result
      })

      setData({
        salesMonthly: validatedResults[0],
        ordersStatus: validatedResults[1],
        dailyRevenue: validatedResults[2],
        paymentMethods: validatedResults[3],
      })
      completedKeyRef.current = requestKey
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(t("errors.loadMetrics"))
      }
    } finally {
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [branchId, session?.accessToken, t])

  useEffect(() => {
    void fetchMetricsData()
  }, [fetchMetricsData])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-AR').format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button 
            onClick={() => {
              void fetchMetricsData(true)
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {t("actions.retry")}
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Preparar datos para los gráficos con validación
  const salesMonthlyData = data.salesMonthly?.labels?.map((label, index) => ({
    month: label,
    sales: data.salesMonthly?.values?.[index] || 0
  })) || []

  const ordersStatusData = data.ordersStatus?.labels?.map((label, index) => ({
    status: label,
    count: data.ordersStatus?.values?.[index] || 0
  })) || []

  const dailyRevenueData = data.dailyRevenue?.labels?.map((label, index) => ({
    day: label,
    revenue: data.dailyRevenue?.values?.[index] || 0
  })) || []

  const paymentMethodsData = data.paymentMethods?.labels?.map((label, index) => ({
    method: label,
    count: data.paymentMethods?.values?.[index] || 0
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{t("header.title")}</h2>
        <button
          onClick={() => {
            void fetchMetricsData(true)
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 self-start sm:self-auto"
        >
          <Loader2 className="h-4 w-4" />
          {t("actions.refresh")}
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
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
