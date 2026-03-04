"use client"

import { useCallback, useEffect, useState } from "react"
import { getTenantApiBase } from "@/lib/apiClient"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Invoice {
  id: string
  branch_id: string
  order_id: string | null
  cuit: string
  pto_vta: number
  cbte_tipo: number
  cbte_nro: number
  cbte_kind: string
  cbte_formatted: string
  cae: string
  cae_vto: string
  doc_tipo: number
  doc_nro: number
  imp_total: number
  status: string
  afip_result: string | null
  afip_err: string | null
  is_credit_note: boolean
  associated_invoice_id: string | null
  created_at: string
}

interface ListResponse {
  items: Invoice[]
  total: number
  limit: number
  offset: number
}

const CBTE_TIPO_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "1", label: "Factura A" },
  { value: "6", label: "Factura B" },
  { value: "11", label: "Factura C" },
  { value: "3", label: "NC A" },
  { value: "8", label: "NC B" },
  { value: "13", label: "NC C" },
]

const PAGE_SIZE = 20

export default function InvoiceHistory() {
  const backendUrl = getTenantApiBase()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [cbteFilter, setCbteFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Credit note
  const [issuingCreditNote, setIssuingCreditNote] = useState<string | null>(null)

  const fetchInvoices = useCallback(
    async (newOffset = 0) => {
      setLoading(true)
      setError(null)
      try {
        const authHeader = await getClientAuthHeaderAsync()
        const params = new URLSearchParams()
        params.set("limit", String(PAGE_SIZE))
        params.set("offset", String(newOffset))
        if (dateFrom) params.set("date_from", dateFrom)
        if (dateTo) params.set("date_to", dateTo)
        if (cbteFilter) params.set("cbte_tipo", cbteFilter)
        if (statusFilter) params.set("status", statusFilter)

        const response = await fetch(`${backendUrl}/invoices?${params.toString()}`, {
          headers: { ...authHeader },
          cache: "no-store",
        })
        const data = (await response.json().catch(() => ({}))) as ListResponse & { error?: string; message?: string }
        if (!response.ok) {
          throw new Error(data?.message || data?.error || "No se pudo cargar facturas")
        }
        setInvoices(data.items || [])
        setTotal(data.total || 0)
        setOffset(newOffset)
      } catch (fetchError: any) {
        setError(fetchError?.message || "No se pudo cargar facturas")
      } finally {
        setLoading(false)
      }
    },
    [backendUrl, dateFrom, dateTo, cbteFilter, statusFilter],
  )

  useEffect(() => {
    void fetchInvoices(0)
  }, [])

  const handleSearch = () => {
    void fetchInvoices(0)
  }

  const handleCreditNote = async (invoiceId: string) => {
    if (!confirm("¿Emitir nota de crédito para esta factura? Esto anulará el comprobante original ante AFIP.")) {
      return
    }
    setIssuingCreditNote(invoiceId)
    setError(null)
    setSuccess(null)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/invoices/credit-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || data?.details?.afip_err || data?.error || "No se pudo emitir NC")
      }
      setSuccess(`Nota de crédito emitida: ${data.cbte_kind} - CAE ${data.cae}`)
      void fetchInvoices(offset)
    } catch (ncError: any) {
      setError(ncError?.message || "No se pudo emitir nota de crédito")
    } finally {
      setIssuingCreditNote(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Historial de facturas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                value={cbteFilter}
                onChange={(e) => setCbteFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CBTE_TIPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="AUTHORIZED">Autorizada</option>
                <option value="REJECTED">Rechazada</option>
              </select>
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          {invoices.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No se encontraron facturas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium">Fecha</th>
                    <th className="py-2 px-2 font-medium">Tipo</th>
                    <th className="py-2 px-2 font-medium">Comprobante</th>
                    <th className="py-2 px-2 font-medium">CAE</th>
                    <th className="py-2 px-2 font-medium text-right">Total</th>
                    <th className="py-2 px-2 font-medium">Estado</th>
                    <th className="py-2 px-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isNC = inv.is_credit_note
                    const canNC = inv.status === "AUTHORIZED" && !isNC
                    return (
                      <tr key={inv.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 whitespace-nowrap">
                          {new Date(inv.created_at).toLocaleDateString("es-AR")}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span className={isNC ? "text-red-700 font-medium" : ""}>
                            {isNC ? `NC ${inv.cbte_kind}` : `Factura ${inv.cbte_kind}`}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono whitespace-nowrap">{inv.cbte_formatted}</td>
                        <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">
                          {inv.cae !== "0" ? inv.cae : "-"}
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          ${Number(inv.imp_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              inv.status === "AUTHORIZED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {inv.status === "AUTHORIZED" ? "Autorizada" : "Rechazada"}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          {canNC && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-red-700 border-red-300 hover:bg-red-50"
                              disabled={issuingCreditNote === inv.id}
                              onClick={() => handleCreditNote(inv.id)}
                            >
                              {issuingCreditNote === inv.id ? "Emitiendo..." : "Nota de crédito"}
                            </Button>
                          )}
                          {inv.afip_err && (
                            <span className="text-xs text-red-600 ml-2" title={inv.afip_err}>
                              Error AFIP
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {total} resultado{total !== 1 ? "s" : ""} — Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset === 0 || loading}
                  onClick={() => fetchInvoices(Math.max(0, offset - PAGE_SIZE))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset + PAGE_SIZE >= total || loading}
                  onClick={() => fetchInvoices(offset + PAGE_SIZE)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
