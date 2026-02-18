"use client"

import { Button } from "@/components/ui/button"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import styles from "./prebill.module.css"

interface RawOrderItem {
  lineId?: string
  id?: string
  item_id?: string
  name?: string
  price?: number | string
  quantity?: number | string
  qty?: number | string
}

interface PrebillOrder {
  id: string
  mesa_id: string
  items: RawOrderItem[]
  total_amount?: number | string
  created_at?: string
  creation_date?: string
  restaurant_name?: string | null
  branch_name?: string | null
}

interface TicketLine {
  key: string
  qty: number
  name: string
  lineTotal: number
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
})

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toDateLabel(value: string | undefined): string {
  const source = value ? new Date(value) : new Date()
  if (Number.isNaN(source.getTime())) {
    return new Date().toLocaleString("es-AR")
  }
  return source.toLocaleString("es-AR")
}

function formatArs(value: number): string {
  return `$ ${CURRENCY_FORMATTER.format(Math.round(value))}`
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

export default function PrebillPrintPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const orderId = typeof params?.id === "string" ? params.id : ""
  const autoprint = searchParams.get("autoprint") === "1"

  const [restaurantSlug, setRestaurantSlug] = useState<string>("")
  const [order, setOrder] = useState<PrebillOrder | null>(null)
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

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError("Pedido invalido")
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
      const response = await fetch(`/api/${restaurantSlug}/orders/${orderId}/prebill`, {
        headers: {
          ...authHeader,
        },
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cargar la precuenta")
      }

      setOrder(data as PrebillOrder)
    } catch (loadError: any) {
      setError(loadError?.message || "No se pudo cargar la precuenta")
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId, restaurantSlug])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const lines = useMemo<TicketLine[]>(() => {
    if (!order || !Array.isArray(order.items)) {
      return []
    }

    return order.items.map((item, index) => {
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
  }, [order])

  const computedTotal = useMemo<number>(() => {
    return lines.reduce((acc, line) => acc + line.lineTotal, 0)
  }, [lines])

  const total = useMemo<number>(() => {
    if (!order) return computedTotal
    const orderTotal = toNumber(order.total_amount, computedTotal)
    const diff = Math.abs(orderTotal - computedTotal)
    return diff < 0.01 ? orderTotal : computedTotal
  }, [computedTotal, order])

  useEffect(() => {
    if (!autoprint || !order || autoPrintDoneRef.current) {
      return
    }

    autoPrintDoneRef.current = true
    const timer = window.setTimeout(() => {
      window.print()
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [autoprint, order])

  if (loading) {
    return <main className={styles.state}>Cargando precuenta...</main>
  }

  if (error || !order) {
    return (
      <main className={styles.state}>
        <p>{error || "No se pudo cargar la precuenta"}</p>
        <Button variant="outline" className="mt-4" onClick={loadOrder}>
          Reintentar
        </Button>
      </main>
    )
  }

  const timestamp = order.creation_date || order.created_at

  return (
    <main className={styles.page}>
      <article className={styles.ticket}>
        <header className={styles.header}>
          {order.restaurant_name ? <p className={styles.title}>{order.restaurant_name}</p> : null}
          {order.branch_name ? <p className={styles.subtitle}>{order.branch_name}</p> : null}
          <p className={styles.subtitle}>PRECUENTA</p>
        </header>

        <section className={styles.meta}>
          <p>Mesa {order.mesa_id}</p>
          <p>{toDateLabel(timestamp)}</p>
          <p>Pedido #{order.id}</p>
        </section>

        <div className={styles.separator} />

        <section className={styles.lines}>
          {lines.map((line) => (
            <div key={line.key} className={styles.row}>
              <span className={styles.rowLeft}>{`${line.qty} ${line.name}`}</span>
              <span className={styles.rowRight}>{formatArs(line.lineTotal)}</span>
            </div>
          ))}
        </section>

        <div className={styles.separator} />

        <section className={styles.totalRow}>
          <span>TOTAL</span>
          <span>{formatArs(total)}</span>
        </section>

        <footer className={styles.footer}>PRECUENTA</footer>
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
