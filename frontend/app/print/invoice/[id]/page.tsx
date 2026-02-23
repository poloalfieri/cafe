"use client"

import { Button } from "@/components/ui/button"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import styles from "./invoice.module.css"

interface RawOrderItem {
  lineId?: string
  id?: string
  item_id?: string
  name?: string
  price?: number | string
  quantity?: number | string
  qty?: number | string
}

interface InvoiceOrder {
  id?: string
  mesa_id?: string
  items?: RawOrderItem[]
  total_amount?: number | string
  created_at?: string
}

interface InvoicePayload {
  id: string
  order_id?: string | null
  cuit: string
  pto_vta: number
  cbte_tipo: number
  cbte_nro: number
  cae: string
  cae_vto: string
  doc_tipo: number
  doc_nro: number
  imp_total: number
  qr_url: string
  qr_image_b64?: string
  created_at?: string
  order?: InvoiceOrder | null
}

interface TicketLine {
  key: string
  qty: number
  name: string
  lineTotal: number
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatArs(value: number): string {
  return `$ ${CURRENCY_FORMATTER.format(value)}`
}

function toDateLabel(value: string | undefined): string {
  if (!value) return new Date().toLocaleString("es-AR")
  const source = new Date(value)
  if (Number.isNaN(source.getTime())) return value
  return source.toLocaleString("es-AR")
}

function formatCbte(ptoVta: number, cbteNro: number): string {
  return `${String(ptoVta).padStart(4, "0")}-${String(cbteNro).padStart(8, "0")}`
}

function cbteLabel(cbteTipo: number): string {
  if (cbteTipo === 1) return "FACTURA A"
  if (cbteTipo === 6) return "FACTURA B"
  if (cbteTipo === 11) return "FACTURA C"
  return `COMPROBANTE ${cbteTipo}`
}

function extractSlugFromReferrer(): string {
  if (typeof document === "undefined") return ""
  try {
    if (!document.referrer) return ""
    const refUrl = new URL(document.referrer)
    const firstSegment = refUrl.pathname.split("/").filter(Boolean)[0]
    if (!firstSegment) return ""
    const blockedSegments = new Set(["api", "print", "login", "payment", "super-admin"])
    if (blockedSegments.has(firstSegment)) return ""
    return firstSegment
  } catch {
    return ""
  }
}

export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const invoiceId = typeof params?.id === "string" ? params.id : ""
  const autoprint = searchParams.get("autoprint") === "1"

  const [restaurantSlug, setRestaurantSlug] = useState<string>("")
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const autoPrintDoneRef = useRef<boolean>(false)

  useEffect(() => {
    const fromQuery = searchParams.get("restaurantSlug")
    if (fromQuery) {
      setRestaurantSlug(fromQuery)
      return
    }

    const fromReferrer = extractSlugFromReferrer()
    if (fromReferrer) {
      setRestaurantSlug(fromReferrer)
      return
    }

    try {
      const fromStorage = localStorage.getItem("active_restaurant_slug") || ""
      if (fromStorage) {
        setRestaurantSlug(fromStorage)
      }
    } catch {
      setRestaurantSlug("")
    }
  }, [searchParams])

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) {
      setError("Factura inválida")
      setLoading(false)
      return
    }
    if (!restaurantSlug) {
      setError("No se pudo resolver el restaurante para imprimir")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`/api/${restaurantSlug}/invoices/${invoiceId}`, {
        headers: {
          ...authHeader,
        },
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "No se pudo cargar la factura")
      }
      setInvoice(data as InvoicePayload)
    } catch (loadError: any) {
      setError(loadError?.message || "No se pudo cargar la factura")
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [invoiceId, restaurantSlug])

  useEffect(() => {
    void loadInvoice()
  }, [loadInvoice])

  useEffect(() => {
    if (!autoprint || !invoice || autoPrintDoneRef.current) {
      return
    }
    autoPrintDoneRef.current = true
    const timer = window.setTimeout(() => {
      window.print()
    }, 250)
    return () => {
      window.clearTimeout(timer)
    }
  }, [autoprint, invoice])

  const lines = useMemo<TicketLine[]>(() => {
    const rawItems = invoice?.order?.items
    if (!Array.isArray(rawItems)) return []
    return rawItems.map((item, index) => {
      const qtyRaw = item.quantity ?? item.qty ?? 1
      const qty = Math.max(1, Math.round(toNumber(qtyRaw, 1)))
      const unitPrice = toNumber(item.price, 0)
      const lineTotal = qty * unitPrice
      const rawName = typeof item.name === "string" ? item.name.trim() : ""
      const safeName = rawName || `Item ${index + 1}`
      const itemKey = String(item.lineId || item.id || item.item_id || index)
      return {
        key: itemKey,
        qty,
        name: safeName,
        lineTotal,
      }
    })
  }, [invoice])

  const total = useMemo<number>(() => {
    if (!invoice) return 0
    return toNumber(invoice.imp_total, toNumber(invoice.order?.total_amount, 0))
  }, [invoice])

  if (loading) {
    return <main className={styles.state}>Cargando factura...</main>
  }

  if (error || !invoice) {
    return (
      <main className={styles.state}>
        <p>{error || "No se pudo cargar la factura"}</p>
        <Button variant="outline" className="mt-4" onClick={loadInvoice}>
          Reintentar
        </Button>
      </main>
    )
  }

  const qrImageSrc = invoice.qr_image_b64 ? `data:image/png;base64,${invoice.qr_image_b64}` : ""
  const createdAt = invoice.order?.created_at || invoice.created_at

  return (
    <main className={styles.page}>
      <article className={styles.ticket}>
        <header className={styles.header}>
          <p className={styles.title}>COMPROBANTE FISCAL</p>
          <p className={styles.subtitle}>{cbteLabel(invoice.cbte_tipo)}</p>
        </header>

        <section className={styles.meta}>
          <p>Comprobante: {formatCbte(invoice.pto_vta, invoice.cbte_nro)}</p>
          <p>CUIT Emisor: {invoice.cuit}</p>
          <p>Fecha: {toDateLabel(createdAt)}</p>
          {invoice.order?.mesa_id ? <p>Mesa: {invoice.order.mesa_id}</p> : null}
          {invoice.order_id ? <p>Pedido: {invoice.order_id}</p> : null}
        </section>

        <div className={styles.separator} />

        <section className={styles.lines}>
          {lines.length > 0 ? (
            lines.map((line) => (
              <div key={line.key} className={styles.row}>
                <span className={styles.rowLeft}>{`${line.qty} ${line.name}`}</span>
                <span className={styles.rowRight}>{formatArs(line.lineTotal)}</span>
              </div>
            ))
          ) : (
            <div className={styles.row}>
              <span className={styles.rowLeft}>TOTAL</span>
              <span className={styles.rowRight}>{formatArs(total)}</span>
            </div>
          )}
        </section>

        <div className={styles.separator} />

        <section className={styles.totalRow}>
          <span>TOTAL</span>
          <span>{formatArs(total)}</span>
        </section>

        <div className={styles.separator} />

        <section className={styles.afipBlock}>
          <p>CAE: {invoice.cae}</p>
          <p>Vto. CAE: {invoice.cae_vto}</p>
        </section>

        {qrImageSrc ? (
          <section className={styles.qrSection}>
            <img src={qrImageSrc} alt="QR AFIP/ARCA" className={styles.qrImage} />
          </section>
        ) : null}

        {invoice.qr_url ? <p className={styles.qrText}>{invoice.qr_url}</p> : null}
      </article>

      <div className={styles.actions}>
        {!autoprint ? (
          <Button onClick={() => window.print()}>Imprimir</Button>
        ) : (
          <Button variant="outline" onClick={() => window.print()}>
            Reimprimir
          </Button>
        )}
      </div>
    </main>
  )
}
