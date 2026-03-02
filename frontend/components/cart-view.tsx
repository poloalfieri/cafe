"use client"

import React from "react"
import { getRestaurantSlug } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { ArrowLeft, Minus, Plus, Trash2, Bell, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/contexts/cart-context"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import CallWaiterModal from "./call-waiter-modal"
import PaymentModal from "./payment-modal"
import { useTranslations } from "next-intl"
import { formatSelectedOptionLabel } from "@/lib/product-options"
import { getMesaSession as resolveMesaSession, refreshMesaSessionToken } from "@/lib/mesa-session"

export default function CartView() {
  const slug = typeof window !== "undefined" ? getRestaurantSlug() : ""
  const { state, updateQuantity, removeItem, clearCart } = useCart()
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showWaiterNotice, setShowWaiterNotice] = useState(false)
  const [waiterNoticeMessage, setWaiterNoticeMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [activePromos, setActivePromos] = useState<Array<{ id: string; name: string; type: string; value: number; description: string }>>([])
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[] | null>(null)
  const t = useTranslations("usuario.cart")
  const searchParams = useSearchParams()
  const router = useRouter()
  const mesa_id = searchParams.get("mesa_id")
  const token = searchParams.get("token")
  const branch_id = searchParams.get("branch_id")

  useEffect(() => {
    if (!branch_id) return
    const { getTenantApiBase } = require("@/lib/apiClient")
    const backendUrl = getTenantApiBase()
    fetch(`${backendUrl}/promotions/public?branch_id=${branch_id}`)
      .then((r) => r.json())
      .then((json) => setActivePromos(Array.isArray(json) ? json : []))
      .catch(() => {})
  }, [branch_id])

  useEffect(() => {
    if (!mesa_id || !branch_id) return
    const fetchMesaInfo = async () => {
      const session = await refreshMesaSessionToken({ mesa_id, token, branch_id })
      if (session.allowed_payment_methods) {
        setAllowedPaymentMethods(session.allowed_payment_methods)
      }
    }
    fetchMesaInfo()
  }, [mesa_id, branch_id, token])

  const getMesaSession = () => resolveMesaSession({ mesa_id, token, branch_id })
  const mesaSession = getMesaSession()

  const handlePaymentComplete = (orderId: string, status: string) => {
    setSuccess(t("paymentProcessed", { orderId }))
  }

  const handlePaymentError = (error: string) => {
    setError(error)
  }

  const handleCallWaiter = () => {
    setShowCallWaiterModal(true)
  }

  const handleWaiterCalled = (message: string) => {
    setShowPaymentModal(false)
    clearCart()
    setWaiterNoticeMessage(message)
    setShowWaiterNotice(true)
  }

  const handleConfirmCallWaiter = async (data: { message?: string }): Promise<void> => {
    try {
      const { apiFetchTenant } = await import('@/lib/apiClient')
      const sendWaiterCall = async (session: { mesa_id: string; branch_id: string; token: string }) => {
        await apiFetchTenant('/waiter/calls', {
          method: "POST",
          body: JSON.stringify({
            mesa_id: session.mesa_id,
            branch_id: session.branch_id,
            token: session.token,
            payment_method: "ASSISTANCE",
            message: data.message || ""
          }),
        })
      }

      let session = await refreshMesaSessionToken({ mesa_id, token, branch_id })
      if (!session.mesa_id || !session.token || !session.branch_id) {
        setShowCallWaiterModal(false)
        return
      }

      try {
        await sendWaiterCall({
          mesa_id: session.mesa_id,
          branch_id: session.branch_id,
          token: session.token,
        })
      } catch (error) {
        const status =
          typeof error === "object" &&
          error !== null &&
          "status" in error
            ? Number((error as { status?: unknown }).status)
            : null
        if (status !== 401) {
          throw error
        }

        session = await refreshMesaSessionToken(
          { mesa_id, token, branch_id },
          { force: true }
        )
        if (!session.mesa_id || !session.token || !session.branch_id) {
          throw error
        }

        await sendWaiterCall({
          mesa_id: session.mesa_id,
          branch_id: session.branch_id,
          token: session.token,
        })
      }
    } catch (error) {
      // Error already handled silently
    } finally {
      setShowCallWaiterModal(false)
    }
  }

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-50 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href={`/${slug}/usuario`}>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5 text-text" />
                  </Button>
                </Link>
                <h1 className="text-xl font-bold text-text">{t("title")}</h1>
              </div>
              <Button 
                onClick={handleCallWaiter}
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-secondary"
              >
                <Bell className="w-5 h-5 text-text" />
              </Button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4 opacity-30">🛒</div>
          <h2 className="text-xl font-semibold text-text mb-2">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground mb-6">{t("emptySubtitle")}</p>
          <Link href={`/${slug}/usuario`}>
            <Button className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-full">
              {t("backToMenu")}
            </Button>
          </Link>
        </div>

        <CallWaiterModal
          isOpen={showCallWaiterModal}
          onConfirm={handleConfirmCallWaiter}
          onCancel={() => setShowCallWaiterModal(false)}
        />
      </div>
    )
  }

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  return (
    <div className="min-h-screen bg-background pb-48">
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/${slug}/usuario`}>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5 text-text" />
                  </Button>
                </Link>
                <h1 className="text-xl font-bold text-text">{t("title")}</h1>
              </div>
            <div className="flex items-center gap-2">
              <span className="bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
                {totalItems}
              </span>
              <Button 
                onClick={clearCart}
                variant="ghost"
                size="icon"
                className="rounded-full text-destructive hover:bg-secondary"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button 
                onClick={handleCallWaiter}
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-secondary"
              >
                <Bell className="w-5 h-5 text-text" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Error/Success messages */}
        {error && (
          <div className="bg-secondary border border-border text-destructive px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-secondary border border-border text-text px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {state.items.map((item) => (
            <div key={item.lineId} className="bg-card rounded-xl p-4 shadow-sm border border-border">
              <div className="flex items-center gap-4">
                {/* Product Image */}
                <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <span className="text-2xl">🍽️</span>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text text-sm mb-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.description || "Delicioso platillo"}</p>
                  {item.selectedOptions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.selectedOptions.map((option) => (
                        <p key={`${item.lineId}-${option.groupId}-${option.id}`} className="text-[11px] text-muted-foreground">
                          • {formatSelectedOptionLabel(option)}
                          {option.priceAddition > 0 ? ` (+$${option.priceAddition.toFixed(2)})` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-text">${item.price.toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => updateQuantity(item.lineId, Math.max(0, item.quantity - 1))}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full border-border hover:bg-secondary"
                      >
                        <Minus className="w-3 h-3 text-text" />
                      </Button>
                      
                      <span className="font-semibold text-text min-w-[30px] text-center">
                        {item.quantity}
                      </span>
                      
                      <Button
                        onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                        size="icon"
                        className="h-8 w-8 rounded-full bg-primary hover:bg-primary-hover"
                      >
                        <Plus className="w-3 h-3 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botón "Buscar más productos" con flecha hacia atrás */}
        <div className="mb-6">
          <Link href={`/${slug}/usuario`}>
            <Button variant="outline" className="w-full border-border hover:bg-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Buscar más productos
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer fijo con total del pedido - solo visible cuando hay productos */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
        <div className="container mx-auto px-4 py-4">
          {/* Banner de promociones activas */}
          {activePromos.length > 0 && (
            <div className="mb-3 space-y-1">
              {activePromos.map((promo) => (
                <div key={promo.id} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs text-green-700">
                  <Tag className="w-3 h-3 flex-shrink-0" />
                  <span className="font-medium">{promo.name}</span>
                  {promo.description && <span className="text-green-600">— {promo.description}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Resumen del pedido */}
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span className="font-semibold text-text">${subtotal.toFixed(2)}</span>
            </div>
            
            {/* Fila de descuentos - solo visible si existen */}
            {state.discounts > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("discounts")}</span>
                <span className="font-semibold text-text">-${state.discounts.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("serviceFee")}</span>
              <span className="font-semibold text-text">${state.serviceCharge.toFixed(2)}</span>
            </div>
            
            <div className="border-t border-border pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-bold text-text">{t("total")}</span>
                <span className="text-lg font-bold text-text">${state.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Botón de pago */}
          {mesaSession.mesa_id && mesaSession.token ? (
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
              size="lg"
            >
              {t("pay")} ${state.total.toFixed(2)}
            </Button>
          ) : (
            <div className="text-center text-destructive p-4">
              {t("missingMesa")}
            </div>
          )}
        </div>
      </div>

      <CallWaiterModal
        isOpen={showCallWaiterModal}
        onConfirm={handleConfirmCallWaiter}
        onCancel={() => setShowCallWaiterModal(false)}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onWaiterCalled={handleWaiterCalled}
        mesaId={mesaSession.mesa_id || ''}
        branchId={mesaSession.branch_id || ''}
        mesaToken={mesaSession.token || ''}
        totalAmount={state.total}
        allowedPaymentMethods={allowedPaymentMethods ?? undefined}
        items={state.items.map((item) => ({
          id: item.id,
          lineId: item.lineId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          basePrice: item.basePrice,
          selectedOptions: item.selectedOptions,
        }))}
      />

      {showWaiterNotice && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="w-12 h-12 rounded-full bg-secondary text-text flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text">Mozo en camino</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {waiterNoticeMessage || "Ya se notificó al mozo. Se acercará a tu mesa en la brevedad."}
            </p>
            <Button
              onClick={() => {
                setShowWaiterNotice(false)
                router.push(`/${slug}/usuario`)
              }}
              className="mt-4 w-full bg-primary hover:bg-primary-hover text-white"
            >
              Volver al menú
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
