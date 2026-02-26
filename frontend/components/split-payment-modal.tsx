"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle,
  Minus,
  Plus,
  Loader2,
} from "lucide-react"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { getTenantApiBase } from "@/lib/apiClient"

interface OrderItem {
  id: string
  name: string
  unit_price: number
  quantity: number
  pending_qty: number
  paid_qty: number
  selected_options?: any[]
}

interface Payment {
  id: string
  payment_method: string
  amount: number
  created_at: string
}

interface SplitPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  orderTotal: number
  onPaymentComplete: () => void
}

type PaymentMethod = "CASH" | "CARD" | "QR"

export default function SplitPaymentModal({
  isOpen,
  onClose,
  orderId,
  orderTotal,
  onPaymentComplete,
}: SplitPaymentModalProps) {
  const t = useTranslations("cajero.dashboard")
  const backendUrl = getTenantApiBase()

  const [items, setItems] = useState<OrderItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [paidAmount, setPaidAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(orderTotal)
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrderItems = useCallback(async () => {
    if (!orderId || !isOpen) return
    setLoading(true)
    setError(null)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/orders/${orderId}/items`, {
        headers: { ...authHeader },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Error cargando items")
      }
      const data = await response.json()
      setItems(data.items || [])
      setPayments(data.payments || [])
      setPaidAmount(data.paid_amount || 0)
      setTotalAmount(data.total_amount || orderTotal)
      setSelectedQty({})
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [orderId, isOpen, backendUrl, orderTotal])

  useEffect(() => {
    if (isOpen) {
      fetchOrderItems()
    }
  }, [isOpen, fetchOrderItems])

  const pendingItems = items.filter((i) => i.pending_qty > 0)
  const paidItems = items.filter((i) => i.paid_qty > 0 && i.pending_qty === 0)

  const selectedTotal = pendingItems.reduce((sum, item) => {
    const qty = selectedQty[item.id] || 0
    return sum + qty * item.unit_price
  }, 0)

  const hasSelection = Object.values(selectedQty).some((q) => q > 0)

  const handleQtyChange = (itemId: string, delta: number) => {
    setSelectedQty((prev) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return prev
      const current = prev[itemId] || 0
      const next = Math.max(0, Math.min(item.pending_qty, current + delta))
      return { ...prev, [itemId]: next }
    })
  }

  const selectAll = () => {
    const newQty: Record<string, number> = {}
    pendingItems.forEach((item) => {
      newQty[item.id] = item.pending_qty
    })
    setSelectedQty(newQty)
  }

  const deselectAll = () => {
    setSelectedQty({})
  }

  const handleAllocate = async () => {
    if (!hasSelection || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const allocations = Object.entries(selectedQty)
        .filter(([, qty]) => qty > 0)
        .map(([order_item_id, quantity]) => ({ order_item_id, quantity }))

      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(
        `${backendUrl}/orders/${orderId}/payments/allocate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({
            allocations,
            payment_method: paymentMethod,
          }),
        }
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Error procesando pago")
      }
      const result = await response.json()

      if (result.fully_paid) {
        onPaymentComplete()
        onClose()
      } else {
        await fetchOrderItems()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`

  const paymentMethods: { key: PaymentMethod; icon: React.ReactNode; label: string }[] = [
    { key: "CASH", icon: <Banknote className="w-4 h-4" />, label: t("splitPayment.cash") },
    { key: "CARD", icon: <CreditCard className="w-4 h-4" />, label: t("splitPayment.card") },
    { key: "QR", icon: <QrCode className="w-4 h-4" />, label: t("splitPayment.qr") },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("splitPayment.title")}</DialogTitle>
          <DialogDescription>{t("splitPayment.subtitle")}</DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {t("splitPayment.paidLabel")}: {formatPrice(paidAmount)}
            </span>
            <span className="font-medium">
              {t("splitPayment.totalLabel")}: {formatPrice(totalAmount)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending items */}
            {pendingItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    {t("splitPayment.pendingLabel")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      className="text-xs h-7"
                    >
                      {t("splitPayment.selectAll")}
                    </Button>
                    {hasSelection && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={deselectAll}
                        className="text-xs h-7"
                      >
                        {t("splitPayment.deselectAll")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {pendingItems.map((item) => {
                    const qty = selectedQty[item.id] || 0
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          qty > 0
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatPrice(item.unit_price)} c/u &middot;{" "}
                              {item.pending_qty} {t("splitPayment.pendingLabel").toLowerCase()}
                              {item.paid_qty > 0 && (
                                <span className="text-green-600">
                                  {" "}&middot; {item.paid_qty} {t("splitPayment.paidLabel").toLowerCase()}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Quantity stepper */}
                          <div className="flex items-center gap-1 ml-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleQtyChange(item.id, -1)}
                              disabled={qty === 0}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {qty}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleQtyChange(item.id, 1)}
                              disabled={qty >= item.pending_qty}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {qty > 0 && (
                          <p className="text-xs text-green-700 mt-1 text-right">
                            {formatPrice(item.unit_price * qty)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Fully paid items */}
            {paidItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">
                  {t("splitPayment.paidLabel")}
                </p>
                {paidItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-gray-100 bg-gray-50 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-500">{item.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        x{item.paid_qty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment method selector */}
            {pendingItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {t("splitPayment.paymentMethod")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((m) => (
                    <Button
                      key={m.key}
                      variant={paymentMethod === m.key ? "default" : "outline"}
                      size="sm"
                      className={`flex items-center gap-2 ${
                        paymentMethod === m.key
                          ? "bg-gray-900 text-white"
                          : ""
                      }`}
                      onClick={() => setPaymentMethod(m.key)}
                    >
                      {m.icon}
                      {m.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Charge button */}
            {pendingItems.length > 0 && (
              <Button
                onClick={handleAllocate}
                disabled={!hasSelection || submitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {t("splitPayment.chargeButton")} {formatPrice(selectedTotal)}
              </Button>
            )}

            {/* All paid message */}
            {pendingItems.length === 0 && items.length > 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">
                  {t("splitPayment.allPaid")}
                </p>
              </div>
            )}

            {/* Previous payments */}
            {payments.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium text-gray-500">
                  {t("splitPayment.previousPayments")}
                </p>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 text-gray-600">
                      {p.payment_method === "CASH" && <Banknote className="w-3 h-3" />}
                      {p.payment_method === "CARD" && <CreditCard className="w-3 h-3" />}
                      {p.payment_method === "QR" && <QrCode className="w-3 h-3" />}
                      <span>{p.payment_method}</span>
                    </div>
                    <span className="font-medium">{formatPrice(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
