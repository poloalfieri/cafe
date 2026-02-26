"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect, useRef, useCallback } from "react"
import { RefreshCw, ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle, Circle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useTranslations } from "next-intl"
import { useToast } from "@/hooks/use-toast"

const POLL_INTERVAL_MS = 15_000

interface CashSession {
  id: string
  register_id: string
  status: "OPEN" | "CLOSED"
  opening_amount: number
  expected_amount_live?: number
  expected_amount?: number
  closing_counted_amount?: number | null
  difference_amount?: number | null
  cashier_user_id: string
  opened_at: string
  closed_at?: string | null
}

interface CashMovement {
  id: string
  type: string
  amount: number
  direction: "IN" | "OUT"
  payment_method?: string | null
  note?: string | null
  impacts_cash: boolean
  source_type?: string | null
  created_at: string
}

interface CashRegister {
  id: string
  name: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n)

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

interface Props {
  branchId?: string
}

export default function CashMonitor({ branchId }: Props) {
  const t = useTranslations("admin.cashMonitor")
  const { toast } = useToast()
  const backendUrl = getTenantApiBase()
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [movements, setMovements] = useState<Record<string, CashMovement[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [filterStatus, setFilterStatus] = useState<"ALL" | "OPEN" | "CLOSED">("ALL")
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const typeLabels: Record<string, string> = {
    SALE_IN: t("types.SALE_IN"),
    REFUND_OUT: t("types.REFUND_OUT"),
    EXPENSE_OUT: t("types.EXPENSE_OUT"),
    MANUAL_IN: t("types.MANUAL_IN"),
    MANUAL_OUT: t("types.MANUAL_OUT"),
    TIP_IN: t("types.TIP_IN"),
  }

  const fetchSessions = useCallback(async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = new URLSearchParams({ limit: "50" })
      if (branchId) params.set("branch_id", branchId)
      if (filterStatus !== "ALL") params.set("status", filterStatus)
      const res = await fetch(`${backendUrl}/cash/sessions?${params}`, { headers: { ...authHeader } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const list: CashSession[] = data.data || []
      setSessions(list)
      setSessionError(null)
      setLastUpdated(new Date())
      // Auto-fetch movements for expanded sessions
      for (const sessionId of Array.from(expanded)) {
        fetchMovements(sessionId)
      }
    } catch {
      setSessionError(t("errors.loadSessions"))
    }
  }, [branchId, filterStatus, expanded])

  const fetchRegisters = useCallback(async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = branchId ? `?branch_id=${branchId}` : ""
      const res = await fetch(`${backendUrl}/cash/registers${params}`, { headers: { ...authHeader } })
      if (!res.ok) return
      const data = await res.json()
      setRegisters(data.data || [])
    } catch (_) {}
  }, [branchId])

  const fetchMovements = useCallback(async (sessionId: string) => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/cash/sessions/${sessionId}/movements`, { headers: { ...authHeader } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMovements((prev) => ({ ...prev, [sessionId]: data.data || [] }))
    } catch {
      toast({ title: t("errors.errorTitle"), description: t("errors.loadMovements"), variant: "destructive" })
    }
  }, [toast])

  // Initial load
  useEffect(() => {
    setLoading(true)
    Promise.all([fetchSessions(), fetchRegisters()]).finally(() => setLoading(false))
  }, [branchId, filterStatus])

  // Polling
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => fetchSessions(), POLL_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchSessions])

  const toggleExpand = (sessionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
        fetchMovements(sessionId)
      }
      return next
    })
  }

  const getRegisterName = (registerId: string) =>
    registers.find((r) => r.id === registerId)?.name ?? registerId.slice(0, 8) + "…"

  const expectedFor = (s: CashSession) =>
    s.status === "OPEN" ? (s.expected_amount_live ?? null) : (s.expected_amount ?? null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t("header.title")}</h2>
          <p className="text-sm text-gray-500">
            {lastUpdated
              ? t("header.lastUpdated", { time: lastUpdated.toLocaleTimeString("es-AR"), seconds: POLL_INTERVAL_MS / 1000 })
              : t("header.loading")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "ALL" | "OPEN" | "CLOSED")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("filter.all")}</SelectItem>
              <SelectItem value="OPEN">{t("filter.open")}</SelectItem>
              <SelectItem value="CLOSED">{t("filter.closed")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setLoading(true); fetchSessions().finally(() => setLoading(false)) }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      {!branchId && (
        <p className="text-sm text-amber-600">{t("noBranchSelected")}</p>
      )}

      {sessionError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-gray-900" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Circle className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">{t("empty.noSessions")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isOpen = s.status === "OPEN"
            const isExpanded = expanded.has(s.id)
            const expected = expectedFor(s)
            const sessionMovements = movements[s.id] ?? []

            // Totals
            const totalIn = sessionMovements
              .filter((m) => m.direction === "IN" && m.impacts_cash)
              .reduce((acc, m) => acc + m.amount, 0)
            const totalOut = sessionMovements
              .filter((m) => m.direction === "OUT" && m.impacts_cash)
              .reduce((acc, m) => acc + m.amount, 0)

            return (
              <Card key={s.id} className={`border ${isOpen ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
                <CardHeader className="p-4 pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={isOpen ? "bg-green-600 text-white" : "bg-gray-400 text-white"}>
                        {isOpen ? t("status.open") : t("status.closed")}
                      </Badge>
                      <CardTitle className="text-base font-semibold text-gray-900">
                        {getRegisterName(s.register_id)}
                      </CardTitle>
                      <span className="text-xs text-gray-500">#{s.id.slice(0, 8)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => toggleExpand(s.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isExpanded ? t("movements.hide") : t("movements.show")}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Session summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">{t("session.opening")}</p>
                      <p className="font-medium">{fmtTime(s.opened_at)}</p>
                    </div>
                    {s.closed_at && (
                      <div>
                        <p className="text-xs text-gray-500">{t("session.closing")}</p>
                        <p className="font-medium">{fmtTime(s.closed_at)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">{t("session.openingAmount")}</p>
                      <p className="font-medium">{fmt(s.opening_amount)}</p>
                    </div>
                    {expected !== null && (
                      <div>
                        <p className="text-xs text-gray-500">{isOpen ? t("session.expectedNow") : t("session.expectedAtClose")}</p>
                        <p className="font-semibold text-blue-700">{fmt(expected)}</p>
                      </div>
                    )}
                    {s.closing_counted_amount !== undefined && s.closing_counted_amount !== null && (
                      <div>
                        <p className="text-xs text-gray-500">{t("session.counted")}</p>
                        <p className="font-medium">{fmt(s.closing_counted_amount)}</p>
                      </div>
                    )}
                    {s.difference_amount !== undefined && s.difference_amount !== null && (
                      <div>
                        <p className="text-xs text-gray-500">{t("session.difference")}</p>
                        <p className={`font-semibold ${s.difference_amount < 0 ? "text-red-600" : s.difference_amount > 0 ? "text-green-600" : "text-gray-700"}`}>
                          {s.difference_amount > 0 ? "+" : ""}{fmt(s.difference_amount)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Movements */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      {/* Subtotals */}
                      {sessionMovements.length > 0 && (
                        <div className="flex gap-4 text-sm mb-2">
                          <span className="flex items-center gap-1 text-green-700">
                            <ArrowDownCircle className="w-4 h-4" />
                            {t("movements.cashIn")} <strong>{fmt(totalIn)}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <ArrowUpCircle className="w-4 h-4" />
                            {t("movements.cashOut")} <strong>{fmt(totalOut)}</strong>
                          </span>
                        </div>
                      )}

                      {sessionMovements.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">{t("movements.empty")}</p>
                      ) : (
                        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                          {sessionMovements.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-sm bg-white rounded-md border border-gray-100 px-3 py-2"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {m.direction === "IN"
                                  ? <ArrowDownCircle className="w-4 h-4 text-green-600 shrink-0" />
                                  : <ArrowUpCircle className="w-4 h-4 text-red-500 shrink-0" />
                                }
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{typeLabels[m.type] ?? m.type}</p>
                                  {m.note && <p className="text-xs text-gray-500 truncate">{m.note}</p>}
                                  {m.payment_method && (
                                    <p className="text-xs text-gray-400">{m.payment_method}{!m.impacts_cash && ` · ${t("movements.notImpactsCash")}`}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className={`font-semibold ${m.direction === "IN" ? "text-green-700" : "text-red-600"}`}>
                                  {m.direction === "IN" ? "+" : "-"}{fmt(m.amount)}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
