"use client"

import { useState, useEffect, useCallback } from "react"
import { getTenantApiBase } from "@/lib/apiClient"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ArrowUp, ArrowDown, Download } from "lucide-react"
import { useTranslations } from "next-intl"

interface Movement {
  id: string
  ingredientId: string
  ingredientName: string
  ingredientUnit: string
  qty: number
  type: "sale" | "adjustment" | "import" | "waste" | "return"
  reason: string | null
  source: string | null
  userId: string | null
  branchId: string | null
  createdAt: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const TYPE_LABELS: Record<string, string> = {
  sale: "Venta",
  adjustment: "Ajuste",
  import: "Importación",
  waste: "Merma",
  return: "Devolución",
}

const TYPE_COLORS: Record<string, string> = {
  sale: "bg-red-100 text-red-700",
  adjustment: "bg-yellow-100 text-yellow-700",
  import: "bg-green-100 text-green-700",
  waste: "bg-orange-100 text-orange-700",
  return: "bg-blue-100 text-blue-700",
}

interface Props {
  branchId?: string
}

export default function StockMovements({ branchId }: Props) {
  const t = useTranslations("admin.stockMovements")
  const backendUrl = getTenantApiBase()

  const [movements, setMovements] = useState<Movement[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 30, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState("")
  const [filterIngredient, setFilterIngredient] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [exportingCsv, setExportingCsv] = useState(false)

  const fetchMovements = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = new URLSearchParams({ page: String(page), pageSize: "30" })
      if (branchId) params.set("branch_id", branchId)
      if (filterType) params.set("type", filterType)
      if (filterIngredient) params.set("ingredient_id", filterIngredient)
      if (filterDateFrom) params.set("date_from", filterDateFrom)
      if (filterDateTo) params.set("date_to", filterDateTo)

      const res = await fetch(`${backendUrl}/stock-movements?${params}`, { headers: authHeader })
      if (!res.ok) throw new Error("Error al cargar movimientos")
      const json = await res.json()
      setMovements(json.data?.movements || [])
      if (json.data?.pagination) setPagination(json.data.pagination)
    } catch (e) {
      console.error("Error cargando stock movements:", e)
      setMovements([])
    } finally {
      setLoading(false)
    }
  }, [backendUrl, branchId, filterType, filterIngredient, filterDateFrom, filterDateTo])

  useEffect(() => {
    void fetchMovements(1)
  }, [fetchMovements])

  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = new URLSearchParams()
      if (branchId) params.set("branch_id", branchId)
      if (filterType) params.set("type", filterType)
      if (filterDateFrom) params.set("date_from", filterDateFrom)
      if (filterDateTo) params.set("date_to", filterDateTo)
      const res = await fetch(`${backendUrl}/reports/movements.csv?${params}`, { headers: authHeader })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // silent
    } finally {
      setExportingCsv(false)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("filters.type")}</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">{t("filters.allTypes")}</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("filters.dateFrom")}</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("filters.dateTo")}</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchMovements(1)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("actions.refresh")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportingCsv}>
          <Download className="w-4 h-4 mr-2" />
          {t("actions.exportCsv")}
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">{t("empty")}</div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{t("columns.date")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{t("columns.ingredient")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{t("columns.type")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{t("columns.qty")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">{t("columns.reason")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">{t("columns.source")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-text">
                      {m.ingredientName}
                      <span className="text-xs text-muted-foreground ml-1">({m.ingredientUnit})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[m.type] || "bg-gray-100 text-gray-700"}`}>
                        {TYPE_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      <span className={`inline-flex items-center gap-1 ${m.qty >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {m.qty >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {Math.abs(m.qty).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{m.reason || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell font-mono">{m.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("pagination.showing", { from: (pagination.page - 1) * pagination.pageSize + 1, to: Math.min(pagination.page * pagination.pageSize, pagination.total), total: pagination.total })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchMovements(pagination.page - 1)}
                >
                  {t("pagination.prev")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchMovements(pagination.page + 1)}
                >
                  {t("pagination.next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
