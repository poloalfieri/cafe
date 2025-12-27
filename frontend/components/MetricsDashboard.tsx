"use client"

import { useState, useEffect } from "react"
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

interface MetricsData {
  salesMonthly: { labels: string[]; values: number[] }
  ordersStatus: { labels: string[]; values: number[] }
  dailyRevenue: { labels: string[]; values: number[] }
  paymentMethods: { labels: string[]; values: number[] }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

const COLORS = {
  primary: "#8884d8",
  secondary: "#82ca9d",
  accent: "#ffc658",
  danger: "#ff7300",
  success: "#00C49F",
  warning: "#FFBB28",
}

export default function MetricsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()

  useEffect(() => {
    if (session?.accessToken) {
      fetchMetricsData()
    }
  }, [session])

  const fetchMetricsData = async () => {
    if (!session?.accessToken) {
      setError("No hay sesión activa")
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const endpoints = [
        "sales-monthly",
        "orders-status", 
        "daily-revenue",
        "payment-methods"
      ]
      
      const results = await Promise.all(
        endpoints.map(endpoint => 
          fetch(`${API_BASE_URL}/api/metrics/${endpoint}`, {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json'
            }
          })
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`)
              }
              return res.json()
            })
            .catch(err => {
              // Error ya manejado por setError
              return { labels: [], values: [] }
            })
        )
      )
      
      // Validar que todos los resultados tengan la estructura correcta
      const validatedResults = results.map(result => {
        if (!result || typeof result !== 'object') {
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
        paymentMethods: validatedResults[3]
      })
    } catch (err) {
      // Error ya manejado por setError
      setError("Error al cargar los datos de métricas")
    } finally {
      setLoading(false)
    }
  }

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
          <p className="text-muted-foreground">Cargando métricas...</p>
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
            onClick={fetchMetricsData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reintentar
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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard de Métricas</h2>
        <button
          onClick={fetchMetricsData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
        >
          <Loader2 className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {/* Ventas Mensuales - LineChart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ventas Mensuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                  labelFormatter={(label) => `Mes: ${label}`}
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
              Ingresos Diarios (Última Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                  labelFormatter={(label) => `Día: ${label}`}
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
              Estado de Pedidos
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
                  formatter={(value: number) => [formatNumber(value), "Pedidos"]}
                  labelFormatter={(label) => `Estado: ${label}`}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Métodos de Pago - RadarChart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Métodos de Pago Más Usados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={paymentMethodsData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="method" />
                <PolarRadiusAxis tickFormatter={(value) => formatNumber(value)} />
                <Radar
                  name="Uso"
                  dataKey="count"
                  stroke={COLORS.accent}
                  fill={COLORS.accent}
                  fillOpacity={0.6}
                />
                <Tooltip 
                  formatter={(value: number) => [formatNumber(value), "Transacciones"]}
                  labelFormatter={(label) => `Método: ${label}`}
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