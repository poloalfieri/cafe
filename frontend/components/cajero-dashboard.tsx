"use client"

import { getRestaurantSlug, getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RefreshCw, Users, CheckCircle, Clock, Minus, Bell, LogOut, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import WaiterCallCard from "./waiter-call-card"
import { api, getClientAuthHeader, getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useTranslations } from "next-intl"
import { supabase } from "@/lib/auth/supabase-browser"
import { io } from "socket.io-client"
import {
  buildCartLineId,
  calculateSelectedOptionsTotal,
  formatSelectedOptionLabel,
  getItemSelectedOptions,
  type ProductOptionGroup,
  type ProductOptionItem,
  type SelectedProductOption,
} from "@/lib/product-options"
import { toast } from "@/hooks/use-toast"

interface Mesa {
  id: string
  mesa_id: string
  branch_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface MenuItem {
  id: string
  name: string
  price: number
  available?: boolean
}

interface Order {
  id: string
  mesa_id: string
  status: string
  total_amount: number
  created_at: string
  items: any[]
  prebill_printed_at?: string | null
}

type PaymentMethod = "CARD" | "CASH" | "QR"

interface WaiterCall {
  id: string
  mesa_id: string
  created_at: string
  status: "PENDING" | "COMPLETED" | "CANCELLED"
  message?: string
  payment_method: PaymentMethod
}

interface DraftOrderItem {
  id: string
  lineId: string
  name: string
  price: number
  basePrice: number
  selectedOptions: SelectedProductOption[]
  quantity: number
}

type PrebillDialogStep = "ASK_PRINT" | "CONFIRM_PRINTED"

const PREBILL_TEXT = {
  printedBadge: "Precuenta impresa",
  printedAt: "Precuenta impresa",
  completedTitle: "Pedido completado",
  askPrint: "Querés imprimir la precuenta?",
  confirmTitle: "Confirmar impresión",
  confirmPrinted: "Salió el ticket?",
  print: "Imprimir precuenta",
  skip: "No imprimir",
  fiscalPlaceholder: "Imprimir comprobante fiscal (próximamente)",
  confirmPrintedAction: "Sí, salió",
  marking: "Marcando...",
  retry: "No / Reintentar",
  close: "Cerrar",
  reprint: "Reimprimir",
}

export default function CajeroDashboard() {
  const t = useTranslations("cajero.dashboard")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [activeTab, setActiveTab] = useState<"pagos" | "mesas">("mesas")
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null)
  const [lowStock, setLowStock] = useState<Array<{ name: string; currentStock: number; minStock: number }>>([])
  const [showLowStockDialog, setShowLowStockDialog] = useState(false)
  const [branchName, setBranchName] = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [prebillDialogOpen, setPrebillDialogOpen] = useState(false)
  const [prebillStep, setPrebillStep] = useState<PrebillDialogStep>("ASK_PRINT")
  const [prebillOrder, setPrebillOrder] = useState<Order | null>(null)
  const [markingPrebill, setMarkingPrebill] = useState(false)
  const [createOrderMesa, setCreateOrderMesa] = useState<Mesa | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("")
  const [draftOrderItems, setDraftOrderItems] = useState<DraftOrderItem[]>([])
  const [createOrderPaymentMethod, setCreateOrderPaymentMethod] = useState<PaymentMethod>("CASH")
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [createOrderError, setCreateOrderError] = useState<string | null>(null)
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false)
  const [optionsProduct, setOptionsProduct] = useState<MenuItem | null>(null)
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([])
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({})
  const [loadingItemOptions, setLoadingItemOptions] = useState(false)
  const [optionsDialogError, setOptionsDialogError] = useState<string | null>(null)

  const backendUrl = getTenantApiBase()
  const normalizePrice = (value: number): number => Math.round(value * 100) / 100

  const fetchWaiterCalls = useCallback(async (currentBranchId?: string | null) => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = new URLSearchParams({ status: "PENDING" })
      if (currentBranchId) {
        params.set("branch_id", currentBranchId)
      }
      const response = await fetch(`${backendUrl}/waiter/calls?${params.toString()}`, {
        headers: {
          ...authHeader,
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.calls)) {
          setWaiterCalls(data.calls)
        }
      }
    } catch (error) {
      console.error(t("errors.fetchWaiterCalls"), error)
    }
  }, [backendUrl])

  useEffect(() => {
    fetchBranch()
    ;(async () => {
      try {
        const json = await api.get(`${backendUrl}/ingredients?page=1&pageSize=1000`)
        const list = json.data?.ingredients || []
        const lows = list.filter((i: any) => i.trackStock && i.currentStock <= i.minStock)
          .map((i: any) => ({ name: i.name, currentStock: i.currentStock, minStock: i.minStock }))
        setLowStock(lows)
        setShowLowStockDialog(lows.length > 0)
      } catch (_) {}
    })()
  }, [])

  const fetchData = async (currentBranchId?: string | null): Promise<Order[]> => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const branchQuery = currentBranchId ? `?branch_id=${currentBranchId}` : ""
      let nextOrders: Order[] = []
      // Fetch mesas
      const mesasResponse = await fetch(`${backendUrl}/mesas${branchQuery}`, {
        headers: {
          ...authHeader,
        },
      })
      if (mesasResponse.ok) {
        const mesasData = await mesasResponse.json()
        setMesas(mesasData.mesas || [])
      } else {
        setMesas([])
      }

      // Fetch orders
      const ordersResponse = await fetch(`${backendUrl}/orders${branchQuery}`, {
        headers: {
          ...authHeader,
        },
      })
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        const filtered = (ordersData || []).filter((order: any) => {
          const raw = order.created_at || order.creation_date
          if (!raw) return false
          const ts = new Date(raw).getTime()
          return Number.isFinite(ts) && ts >= cutoff
        })
        nextOrders = filtered
        setOrders(filtered)
      } else {
        nextOrders = []
        setOrders([])
      }
      return nextOrders
    } catch (error) {
      console.error(t("errors.fetchData"), error)
      setMesas([])
      setOrders([])
      return []
    } finally {
      setLoading(false)
    }
  }

  const fetchBranch = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches/me`, {
        headers: {
          ...authHeader,
        },
      })
      if (response.ok) {
        const data = await response.json()
        const name = data?.branch?.name
        const id = data?.branch?.id
        if (name) {
          setBranchName(name)
        }
        if (id) {
          setBranchId(id)
          await fetchData(id)
          fetchWaiterCalls(id)
        } else {
          await fetchData(null)
          fetchWaiterCalls(null)
        }
      } else {
        await fetchData(null)
        fetchWaiterCalls(null)
      }
    } catch (error) {
      console.error(t("errors.fetchBranch"), error)
      await fetchData(null)
      fetchWaiterCalls(null)
    }
  }

  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ["websocket"],
      withCredentials: true,
    })

    socket.on("waiter_calls:updated", (payload: any) => {
      if (!payload?.branch_id || payload.branch_id === branchId) {
        fetchWaiterCalls(branchId)
      }
    })

    socket.on("orders:updated", (payload: any) => {
      if (!payload?.branch_id || payload.branch_id === branchId) {
        fetchData(branchId)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [backendUrl, branchId, fetchWaiterCalls, fetchData])

  const resolveMesaBranchId = (mesa: Mesa | null): string | null => {
    if (!mesa) return null
    return branchId || mesa.branch_id || null
  }

  const fetchProductOptionGroups = useCallback(async (productId: string): Promise<ProductOptionGroup[]> => {
    const authHeader = await getClientAuthHeaderAsync()
    const response = await fetch(
      `${backendUrl}/product-options/groups?productId=${encodeURIComponent(productId)}`,
      {
        headers: {
          ...authHeader,
        },
      }
    )
    if (!response.ok) {
      throw new Error(t("orders.loadOptionsError"))
    }
    const payload = await response.json()
    return Array.isArray(payload?.data) ? payload.data : []
  }, [backendUrl, t])

  const fetchMenuForCreateOrder = useCallback(async (targetBranchId: string | null) => {
    setMenuLoading(true)
    setMenuItems([])
    setSelectedMenuItemId("")
    setCreateOrderError(null)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = new URLSearchParams({ available: "true" })
      if (targetBranchId) {
        params.set("branch_id", targetBranchId)
      }
      const response = await fetch(`${backendUrl}/menu?${params.toString()}`, {
        headers: {
          ...authHeader,
        },
      })

      if (!response.ok) {
        throw new Error(t("orders.loadMenuError"))
      }

      const payload = await response.json()
      const normalized: MenuItem[] = Array.isArray(payload)
        ? payload
            .filter((item: any) => item && item.available !== false)
            .map((item: any) => ({
              id: String(item.id),
              name: String(item.name || ""),
              price: Number(item.price || 0),
              available: item.available,
            }))
        : []

      setMenuItems(normalized)
      if (normalized.length > 0) {
        setSelectedMenuItemId(normalized[0].id)
      }
    } catch (error) {
      console.error(t("errors.fetchMenu"), error)
      setCreateOrderError(t("orders.loadMenuError"))
    } finally {
      setMenuLoading(false)
    }
  }, [backendUrl, t])

  const resetOptionsDialogState = () => {
    setOptionsDialogOpen(false)
    setOptionsProduct(null)
    setOptionGroups([])
    setSelectedOptionIds({})
    setOptionsDialogError(null)
    setLoadingItemOptions(false)
  }

  const closeOptionsDialog = () => {
    resetOptionsDialogState()
  }

  const closeCreateOrderDialog = () => {
    setCreateOrderMesa(null)
    setDraftOrderItems([])
    setCreateOrderPaymentMethod("CASH")
    setSelectedMenuItemId("")
    setCreateOrderError(null)
    setMenuItems([])
    setMenuLoading(false)
    setCreatingOrder(false)
    resetOptionsDialogState()
  }

  const openCreateOrderDialog = (mesa: Mesa) => {
    setCreateOrderMesa(mesa)
    setDraftOrderItems([])
    setCreateOrderPaymentMethod("CASH")
    setCreateOrderError(null)
    void fetchMenuForCreateOrder(resolveMesaBranchId(mesa))
  }

  const addOrIncrementDraftItem = (
    product: MenuItem,
    selectedOptions: SelectedProductOption[] = []
  ) => {
    const basePrice = normalizePrice(Number(product.price) || 0)
    const optionsTotal = calculateSelectedOptionsTotal(selectedOptions)
    const finalPrice = normalizePrice(basePrice + optionsTotal)
    const lineId = buildCartLineId(String(product.id), selectedOptions)

    setDraftOrderItems((prev) => {
      const existing = prev.find((item) => item.lineId === lineId)
      if (existing) {
        return prev.map((item) =>
          item.lineId === lineId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          id: String(product.id),
          lineId,
          name: product.name,
          price: finalPrice,
          basePrice,
          selectedOptions,
          quantity: 1,
        },
      ]
    })
    setCreateOrderError(null)
  }

  const handleAddDraftItem = async () => {
    if (!selectedMenuItemId || loadingItemOptions) return
    const selectedItem = menuItems.find((item) => item.id === selectedMenuItemId)
    if (!selectedItem) return

    try {
      setLoadingItemOptions(true)
      setOptionsDialogError(null)
      const groups = await fetchProductOptionGroups(selectedItem.id)
      if (groups.length === 0) {
        addOrIncrementDraftItem(selectedItem, [])
        return
      }
      setOptionsProduct(selectedItem)
      setOptionGroups(groups)
      setSelectedOptionIds({})
      setOptionsDialogOpen(true)
    } catch (error) {
      console.error(t("errors.fetchOptions"), error)
      setCreateOrderError(t("orders.loadOptionsError"))
    } finally {
      setLoadingItemOptions(false)
    }
  }

  const getSelectedIdsForGroup = (groupId: string): string[] => {
    return selectedOptionIds[groupId] || []
  }

  const isOptionSelected = (groupId: string, itemId: string): boolean => {
    return getSelectedIdsForGroup(groupId).includes(itemId)
  }

  const toggleOptionSelection = (group: ProductOptionGroup, item: ProductOptionItem): void => {
    if ((item.currentStock || 0) <= 0) return

    setOptionsDialogError(null)
    setSelectedOptionIds((previous) => {
      const currentGroupSelection = previous[group.id] || []
      const alreadySelected = currentGroupSelection.includes(item.id)

      if (group.maxSelections <= 1) {
        return {
          ...previous,
          [group.id]: alreadySelected ? [] : [item.id],
        }
      }

      if (alreadySelected) {
        return {
          ...previous,
          [group.id]: currentGroupSelection.filter((id) => id !== item.id),
        }
      }

      if (currentGroupSelection.length >= group.maxSelections) {
        setOptionsDialogError(
          t("orders.optionsMaxReached", {
            group: group.name,
            count: group.maxSelections,
          })
        )
        return previous
      }

      return {
        ...previous,
        [group.id]: [...currentGroupSelection, item.id],
      }
    })
  }

  const getDialogSelectedOptions = (): SelectedProductOption[] => {
    const selectedOptions: SelectedProductOption[] = []
    optionGroups.forEach((group) => {
      const selectedIds = getSelectedIdsForGroup(group.id)
      selectedIds.forEach((selectedId) => {
        const selectedItem = group.items.find((item) => item.id === selectedId)
        if (!selectedItem || (selectedItem.currentStock || 0) <= 0) return
        selectedOptions.push({
          id: selectedItem.id,
          groupId: group.id,
          groupName: group.name,
          ingredientId: selectedItem.ingredientId,
          ingredientName: selectedItem.ingredientName,
          priceAddition: normalizePrice(selectedItem.priceAddition || 0),
        })
      })
    })
    return selectedOptions
  }

  const requiredGroupWithoutStock = optionGroups.find((group) => {
    if (!group.isRequired) return false
    return !group.items.some((item) => (item.currentStock || 0) > 0)
  })

  const missingRequiredSelection = optionGroups.find((group) => {
    if (!group.isRequired) return false
    return getSelectedIdsForGroup(group.id).length === 0
  })

  const selectedDialogOptions = getDialogSelectedOptions()
  const optionsBasePrice = normalizePrice(Number(optionsProduct?.price || 0))
  const optionsTotalPrice = calculateSelectedOptionsTotal(selectedDialogOptions)
  const optionsFinalPrice = normalizePrice(optionsBasePrice + optionsTotalPrice)

  const handleConfirmOptions = (): void => {
    if (!optionsProduct) return

    if (requiredGroupWithoutStock) {
      setOptionsDialogError(
        t("orders.optionsRequiredNoStock", {
          group: requiredGroupWithoutStock.name,
        })
      )
      return
    }

    if (missingRequiredSelection) {
      setOptionsDialogError(
        t("orders.optionsRequiredMissing", {
          group: missingRequiredSelection.name,
        })
      )
      return
    }

    addOrIncrementDraftItem(optionsProduct, selectedDialogOptions)
    closeOptionsDialog()
    setCreateOrderError(null)
  }

  const updateDraftItemQuantity = (lineId: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setDraftOrderItems((prev) => prev.filter((item) => item.lineId !== lineId))
      return
    }
    setDraftOrderItems((prev) =>
      prev.map((item) =>
        item.lineId === lineId ? { ...item, quantity: nextQuantity } : item
      )
    )
  }

  const removeDraftItem = (lineId: string) => {
    setDraftOrderItems((prev) => prev.filter((item) => item.lineId !== lineId))
    setCreateOrderError(null)
  }

  const handleCreateOrderForMesa = async () => {
    if (!createOrderMesa || creatingOrder) return

    if (draftOrderItems.length === 0) {
      setCreateOrderError(t("orders.atLeastOneItem"))
      return
    }

    const targetBranchId = resolveMesaBranchId(createOrderMesa)
    if (!targetBranchId) {
      setCreateOrderError(t("orders.branchRequired"))
      return
    }

    try {
      setCreatingOrder(true)
      setCreateOrderError(null)
      const asyncAuthHeader = await getClientAuthHeaderAsync()
      const fallbackAuthHeader = getClientAuthHeader()
      const authHeader =
        asyncAuthHeader.Authorization || fallbackAuthHeader.Authorization
          ? { ...fallbackAuthHeader, ...asyncAuthHeader }
          : {}

      if (!authHeader.Authorization) {
        setCreateOrderError(t("orders.authRequired"))
        setCreatingOrder(false)
        return
      }
      const authToken = authHeader.Authorization.replace(/^Bearer\s+/i, "").trim()

      const response = await fetch(`${backendUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          mesa_id: createOrderMesa.mesa_id,
          branch_id: targetBranchId,
          token: authToken,
          items: draftOrderItems.map((item) => ({
            id: item.id,
            lineId: item.lineId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            basePrice: item.basePrice,
            selectedOptions: item.selectedOptions || [],
          })),
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        setCreateOrderError(errorPayload?.error || t("orders.createError"))
        return
      }

      const callResponse = await fetch(`${backendUrl}/waiter/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          mesa_id: createOrderMesa.mesa_id,
          branch_id: targetBranchId,
          payment_method: createOrderPaymentMethod,
          message: "Solicitud de pago (caja)",
        }),
      })

      if (!callResponse.ok) {
        const callErrorPayload = await callResponse.json().catch(() => ({}))
        setCreateOrderError(callErrorPayload?.error || t("orders.createQueueError"))
        return
      }

      await fetchData(branchId)
      await fetchWaiterCalls(branchId)
      const createdMesaId = createOrderMesa.mesa_id
      closeCreateOrderDialog()
      setActiveTab("pagos")
      toast({
        title: t("orders.createSuccessTitle"),
        description: t("orders.createSuccessBody", { mesaId: createdMesaId }),
      })
    } catch (error) {
      console.error(t("errors.createOrder"), error)
      setCreateOrderError(t("orders.createError"))
    } finally {
      setCreatingOrder(false)
    }
  }

  const getMesaStatus = (mesaId: string) => {
    const mesaOrders = orders.filter(order => order.mesa_id === mesaId)
    if (mesaOrders.length === 0) return "disponible"
    
    const activeOrder = mesaOrders.find(order => 
      order.status === "PAYMENT_PENDING" || 
      order.status === "PAID" || 
      order.status === "IN_PREPARATION" || 
      order.status === "READY"
    )
    
    if (activeOrder) {
      switch (activeOrder.status) {
        case "PAYMENT_PENDING": return "esperando_pago"
        case "PAID": return "pagado"
        case "IN_PREPARATION": return "preparando"
        case "READY": return "listo"
        default: return "ocupada"
      }
    }
    
    return "disponible"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponible": return "bg-green-100 text-green-800 border-green-200"
      case "esperando_pago": return "bg-red-100 text-red-800 border-red-200"
      case "pagado": return "bg-blue-100 text-blue-800 border-blue-200"
      case "preparando": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "listo": return "bg-purple-100 text-purple-800 border-purple-200"
      case "ocupada": return "bg-gray-100 text-gray-800 border-gray-200"
      case "PAYMENT_PENDING": return "bg-red-100 text-red-800 border-red-200"
      case "PAID": return "bg-green-100 text-green-800 border-green-200"
      case "PAYMENT_APPROVED": return "bg-green-100 text-green-800 border-green-200"
      case "PAYMENT_REJECTED": return "bg-gray-100 text-gray-800 border-gray-200"
      case "IN_PREPARATION": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "READY": return "bg-blue-100 text-blue-800 border-blue-200"
      case "DELIVERED": return "bg-gray-100 text-gray-500 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "disponible": return t("status.available")
      case "esperando_pago": return t("status.waitingPayment")
      case "pagado": return t("status.paid")
      case "preparando": return t("status.preparing")
      case "listo": return t("status.readyToDeliver")
      case "ocupada": return t("status.occupied")
      case "PAYMENT_PENDING": return t("status.waitingPayment")
      case "PAID": return t("status.paid")
      case "PAYMENT_APPROVED": return t("status.paymentApproved")
      case "PAYMENT_REJECTED": return t("status.paymentRejected")
      case "IN_PREPARATION": return t("status.inPreparation")
      case "READY": return t("status.ready")
      case "DELIVERED": return t("status.delivered")
      default: return t("status.unknown")
    }
  }

  const getOrderTimestamp = (order: Order): number => {
    const ts = new Date(order.created_at).getTime()
    return Number.isFinite(ts) ? ts : 0
  }

  const getLatestOrderForMesa = (mesaId: string, sourceOrders: Order[]): Order | null => {
    const mesaOrders = sourceOrders.filter((order) => String(order.mesa_id) === String(mesaId))
    if (mesaOrders.length === 0) {
      return null
    }

    const sorted = [...mesaOrders].sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
    return sorted[0] || null
  }

  const getCurrentRestaurantSlug = () => {
    try {
      const slug = getRestaurantSlug()
      localStorage.setItem("active_restaurant_slug", slug)
      return slug
    } catch {
      return ""
    }
  }

  const buildPrebillPrintUrl = (orderId: string, autoprint = true) => {
    const params = new URLSearchParams()
    const slug = getCurrentRestaurantSlug()
    if (autoprint) {
      params.set("autoprint", "1")
    }
    if (slug) {
      params.set("restaurantSlug", slug)
    }
    const queryString = params.toString()
    return queryString
      ? `/print/prebill/${orderId}?${queryString}`
      : `/print/prebill/${orderId}`
  }

  const openPrebillWindow = (orderId: string, autoprint = true) => {
    window.open(buildPrebillPrintUrl(orderId, autoprint), "_blank", "noopener")
  }

  const resetPrebillDialog = () => {
    setPrebillDialogOpen(false)
    setPrebillStep("ASK_PRINT")
    setPrebillOrder(null)
    setMarkingPrebill(false)
  }

  const startPrebillPrinting = () => {
    if (!prebillOrder) return
    openPrebillWindow(prebillOrder.id, true)
    setPrebillStep("CONFIRM_PRINTED")
  }

  const retryPrebillPrinting = () => {
    if (!prebillOrder) return
    openPrebillWindow(prebillOrder.id, true)
  }

  const markPrebillPrinted = async () => {
    if (!prebillOrder || markingPrebill) {
      return
    }

    try {
      setMarkingPrebill(true)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/orders/${prebillOrder.id}/prebill/mark-printed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(t("errors.markPrebillPrinted"), errorData?.error)
        return
      }

      await fetchData(branchId)
      resetPrebillDialog()
    } catch (error) {
      console.error(t("errors.markPrebillPrinted"), error)
    } finally {
      setMarkingPrebill(false)
    }
  }

  const formatPrebillPrintedAt = (value: string | null | undefined) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  const handleReprint = (orderId: string) => {
    openPrebillWindow(orderId, true)
  }

  const createOrderTotal = draftOrderItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  const getMesaOrders = (mesaId: string) => {
    return orders.filter(order => order.mesa_id === mesaId)
  }

  const updateCallStatus = async (callId: string, newStatus: WaiterCall["status"]) => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/waiter/calls/${callId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const payload = await response.json().catch(() => ({}))
        setWaiterCalls(prev => prev.filter(call => call.id !== callId))
        if (newStatus === "COMPLETED") {
          const refreshedOrders = await fetchData(branchId)
          const mesaId = String(payload?.call?.mesa_id ?? "")
          const targetOrder = mesaId ? getLatestOrderForMesa(mesaId, refreshedOrders) : null
          if (targetOrder) {
            setPrebillOrder(targetOrder)
            setPrebillStep("ASK_PRINT")
            setPrebillDialogOpen(true)
          }
        }
      } else {
        const errorData = await response.json()
        console.error(t("errors.updateCallStatus"), errorData.error)
      }
    } catch (error) {
      console.error(t("errors.updateCallStatus"), error)
    }
  }

  const refreshData = () => {
    void fetchData(branchId)
    void fetchWaiterCalls(branchId)
  }

  const mesasDisponibles = mesas.filter(mesa => getMesaStatus(mesa.mesa_id) === "disponible")
  const mesasOcupadas = mesas.filter(mesa => getMesaStatus(mesa.mesa_id) !== "disponible")

  const handleMesaStatusChange = async (mesaId: string, newStatus: boolean) => {
    try {
      // En producción, aquí harías una llamada al backend para cambiar el estado
      console.log(t("logs.changeMesaStatus", { mesaId, status: newStatus ? t("status.active") : t("status.inactive") }))
      
      // Actualizar localmente para demo
      setMesas(prevMesas =>
        prevMesas.map(mesa =>
          mesa.mesa_id === mesaId
            ? { ...mesa, is_active: newStatus, updated_at: new Date().toISOString() }
            : mesa
        )
      )
      
      // Aquí podrías hacer la llamada al backend:
      // const response = await fetch(`http://localhost:5001/mesas/${mesaId}`, {
      //   method: "PUT",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ is_active: newStatus })
      // })
      
    } catch (error) {
      console.error(t("errors.updateMesaStatus"), error)
    }
  }

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
    } finally {
      sessionStorage.removeItem("supabase_session")
      const qs = searchParams.toString()
      const next = qs ? `${pathname}?${qs}` : pathname
      router.replace(`/login?next=${encodeURIComponent(next)}`)
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">💰</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text">
                  {branchName
                    ? t("header.titleWithBranch", { branch: branchName })
                    : t("header.title")}
                </h1>
                <p className="text-muted-foreground text-sm">{t("header.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={refreshData}
                disabled={loading}
                className="bg-primary hover:bg-primary-hover text-white px-4 py-2 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {t("actions.refresh")}
              </Button>
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                variant="outline"
                className="px-4 py-2 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? t("actions.loggingOut") : t("actions.logout")}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-text" />
                <div>
                  <p className="text-2xl font-bold text-text">{mesas.length}</p>
                  <p className="text-xs text-muted-foreground">{t("stats.totalTables")}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-text" />
                <div>
                  <p className="text-2xl font-bold text-text">{mesasDisponibles.length}</p>
                  <p className="text-xs text-muted-foreground">{t("stats.available")}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-text" />
                <div>
                  <p className="text-2xl font-bold text-text">{mesasOcupadas.length}</p>
                  <p className="text-xs text-muted-foreground">{t("stats.occupied")}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <div>
                  <p className="text-2xl font-bold text-text">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">{t("stats.totalOrders")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido con Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Dialog open={showLowStockDialog} onOpenChange={setShowLowStockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("lowStock.title")}</DialogTitle>
              <DialogDescription>
                {t("lowStock.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {lowStock.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span>
                    {t("lowStock.stockLine", {
                      current: i.currentStock.toFixed(2),
                      min: i.minStock.toFixed(2)
                    })}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={!!selectedMesa} onOpenChange={(open) => !open && setSelectedMesa(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {selectedMesa ? t("tables.tableLabel", { id: selectedMesa.mesa_id }) : ""}
              </DialogTitle>
              <DialogDescription>
                {t("orders.itemsTitle")}
              </DialogDescription>
            </DialogHeader>
            {selectedMesa && (
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <div className="space-y-3">
                  {getMesaOrders(selectedMesa.mesa_id).length === 0 ? (
                    <p className="text-sm text-gray-500">{t("tables.noOrders")}</p>
                  ) : (
                    getMesaOrders(selectedMesa.mesa_id).map((order) => (
                      <div key={order.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {t("orders.orderId", { id: order.id })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-700">
                              {t("orders.total", { total: order.total_amount.toFixed(2) })}
                            </p>
                            {order.prebill_printed_at ? (
                              <div className="mt-2 space-y-1">
                                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                                  {PREBILL_TEXT.printedBadge}
                                </Badge>
                                <p className="text-[11px] text-emerald-700">
                                  {`${PREBILL_TEXT.printedAt}: ${formatPrebillPrintedAt(order.prebill_printed_at)}`}
                                </p>
                              </div>
                            ) : null}
                          </div>
                          <Badge className={`${getStatusColor(order.status)} border`}>
                            {getStatusText(order.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 border-t border-gray-100 pt-2">
                          {Array.isArray(order.items) && order.items.length > 0 ? (
                            <div className="space-y-1">
                              {order.items.map((item: any, idx: number) => {
                                const selectedOptions = getItemSelectedOptions(item)
                                return (
                                  <div key={item?.lineId || item?.id || idx} className="space-y-1 text-xs text-gray-600">
                                    <div className="flex justify-between">
                                      <span className="truncate pr-2">
                                        {t("orders.itemLine", { name: item.name, quantity: item.quantity })}
                                      </span>
                                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                    {selectedOptions.length > 0 && (
                                      <div className="pl-2 space-y-1">
                                        {selectedOptions.map((option) => (
                                          <p key={`${option.groupId}-${option.id}`} className="text-[11px] text-gray-500">
                                            • {formatSelectedOptionLabel(option)}
                                            {option.priceAddition > 0
                                              ? ` (+$${option.priceAddition.toFixed(2)})`
                                              : ""}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">{t("orders.noItems")}</p>
                          )}
                        </div>
                        {order.prebill_printed_at ? (
                          <div className="mt-2 border-t border-gray-100 pt-2 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleReprint(order.id)}
                            >
                              {PREBILL_TEXT.reprint}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!createOrderMesa}
          onOpenChange={(open) => {
            if (!open) {
              closeCreateOrderDialog()
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {createOrderMesa
                  ? t("orders.createDialogTitle", { mesaId: createOrderMesa.mesa_id })
                  : t("orders.createDialogFallbackTitle")}
              </DialogTitle>
              <DialogDescription>{t("orders.createDialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {menuLoading ? (
                <p className="text-sm text-gray-500">{t("orders.loadingMenu")}</p>
              ) : menuItems.length === 0 ? (
                <p className="text-sm text-gray-500">{t("orders.noMenuItems")}</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedMenuItemId}
                    onChange={(event) => setSelectedMenuItemId(event.target.value)}
                  >
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {`${item.name} - $${item.price.toFixed(2)}`}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={() => void handleAddDraftItem()}
                    disabled={loadingItemOptions}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {loadingItemOptions ? t("orders.addingItem") : t("orders.addItem")}
                  </Button>
                </div>
              )}

              {createOrderError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createOrderError}
                </div>
              ) : null}

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">{t("orders.itemsTitle")}</p>
                {draftOrderItems.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("orders.emptyDraft")}</p>
                ) : (
                  <div className="space-y-2">
                    {draftOrderItems.map((item) => (
                      <div
                        key={item.lineId}
                        className="flex items-center justify-between gap-2 rounded-md border border-gray-100 p-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {t("orders.itemUnitPrice", { price: item.price.toFixed(2) })}
                          </p>
                          {item.selectedOptions.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {item.selectedOptions.map((option) => (
                                <p
                                  key={`${item.lineId}-${option.groupId}-${option.id}`}
                                  className="text-[11px] text-gray-500"
                                >
                                  • {formatSelectedOptionLabel(option)}
                                  {option.priceAddition > 0
                                    ? ` (+$${option.priceAddition.toFixed(2)})`
                                    : ""}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateDraftItemQuantity(item.lineId, item.quantity - 1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="min-w-[28px] text-center text-sm">{item.quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateDraftItemQuantity(item.lineId, item.quantity + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={() => removeDraftItem(item.lineId)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">{t("orders.paymentMethodLabel")}</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={createOrderPaymentMethod}
                  onChange={(event) =>
                    setCreateOrderPaymentMethod(event.target.value as PaymentMethod)
                  }
                >
                  <option value="CASH">{t("orders.paymentMethods.cash")}</option>
                  <option value="CARD">{t("orders.paymentMethods.card")}</option>
                  <option value="QR">{t("orders.paymentMethods.qr")}</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                <p className="text-sm font-semibold text-gray-900">
                  {t("orders.total", { total: createOrderTotal.toFixed(2) })}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={closeCreateOrderDialog}>
                    {t("orders.cancel")}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateOrderForMesa}
                    disabled={creatingOrder || menuLoading}
                  >
                    {creatingOrder ? t("orders.creating") : t("orders.createAction")}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={optionsDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeOptionsDialog()
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {t("orders.optionsDialogTitle", { product: optionsProduct?.name || "" })}
              </DialogTitle>
              <DialogDescription>{t("orders.optionsDialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-4">
                {optionGroups.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("orders.noOptionGroups")}</p>
                ) : (
                  optionGroups.map((group) => (
                    <div key={group.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{group.name}</p>
                        <span className="text-xs text-gray-500">
                          {group.isRequired
                            ? t("orders.optionsRequiredBadge")
                            : t("orders.optionsOptionalBadge")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {t("orders.optionsMaxSelections", { count: group.maxSelections })}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((item) => {
                          const outOfStock = (item.currentStock || 0) <= 0
                          const selected = isOptionSelected(group.id, item.id)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleOptionSelection(group, item)}
                              disabled={outOfStock}
                              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                                selected
                                  ? "border-primary bg-primary/5"
                                  : "border-gray-200 bg-white hover:bg-gray-50"
                              } ${outOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-gray-900">{item.ingredientName}</span>
                                <span className="text-xs text-gray-600">
                                  {item.priceAddition > 0
                                    ? t("orders.optionsPriceAddition", {
                                        price: Number(item.priceAddition).toFixed(2),
                                      })
                                    : t("orders.optionsNoExtra")}
                                </span>
                              </div>
                              {outOfStock ? (
                                <p className="text-[11px] text-red-600 mt-1">{t("orders.optionsOutOfStock")}</p>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {optionsDialogError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {optionsDialogError}
                </div>
              ) : null}

              <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span>{t("orders.optionsBasePrice")}</span>
                  <span>${optionsBasePrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("orders.optionsExtrasTotal")}</span>
                  <span>${optionsTotalPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1">
                  <span>{t("orders.optionsFinalPrice")}</span>
                  <span>${optionsFinalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeOptionsDialog}>
                  {t("orders.optionsCancel")}
                </Button>
                <Button type="button" onClick={handleConfirmOptions}>
                  {t("orders.optionsConfirm")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={prebillDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetPrebillDialog()
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {prebillStep === "ASK_PRINT"
                  ? PREBILL_TEXT.completedTitle
                  : PREBILL_TEXT.confirmTitle}
              </DialogTitle>
              <DialogDescription>
                {prebillStep === "ASK_PRINT"
                  ? PREBILL_TEXT.askPrint
                  : PREBILL_TEXT.confirmPrinted}
              </DialogDescription>
            </DialogHeader>
            {prebillOrder ? (
              <p className="text-xs text-muted-foreground">
                {`Pedido #${prebillOrder.id}`}
              </p>
            ) : null}
            {prebillStep === "ASK_PRINT" ? (
              <div className="space-y-2 pt-2">
                <Button onClick={startPrebillPrinting} className="w-full">
                  {PREBILL_TEXT.print}
                </Button>
                <Button type="button" variant="secondary" onClick={resetPrebillDialog} className="w-full">
                  {PREBILL_TEXT.skip}
                </Button>
                <Button type="button" variant="ghost" disabled className="w-full">
                  {PREBILL_TEXT.fiscalPlaceholder}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <Button onClick={markPrebillPrinted} className="w-full" disabled={markingPrebill}>
                  {markingPrebill ? PREBILL_TEXT.marking : PREBILL_TEXT.confirmPrintedAction}
                </Button>
                <Button type="button" variant="outline" onClick={retryPrebillPrinting} className="w-full">
                  {PREBILL_TEXT.retry}
                </Button>
                <Button type="button" variant="secondary" onClick={resetPrebillDialog} className="w-full">
                  {PREBILL_TEXT.close}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "pagos" | "mesas")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-card border border-border">
            <TabsTrigger value="pagos" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Bell className="w-4 h-4" />
              {t("tabs.payments", { count: waiterCalls.length })}
              {waiterCalls.length > 0 && (
                <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {waiterCalls.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mesas" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              {t("tabs.tables", { count: mesas.length })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pagos">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">{t("payments.loading")}</p>
              </div>
            ) : waiterCalls.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("payments.emptyTitle")}</h3>
                <p className="text-gray-600">{t("payments.emptySubtitle")}</p>
                <p className="text-gray-400 text-sm mt-2">{t("payments.autoRefresh")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{t("payments.autoRefresh")}</p>
                {waiterCalls.map((call) => (
                  <WaiterCallCard
                    key={call.id}
                    call={call}
                    onStatusUpdate={updateCallStatus}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mesas">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">{t("tables.loading")}</p>
              </div>
            ) : mesas.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("tables.emptyTitle")}</h3>
                <p className="text-gray-600">{t("tables.emptySubtitle")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{t("tables.createHint")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mesas.map((mesa) => {
                    const status = getMesaStatus(mesa.mesa_id)
                    const mesaOrders = getMesaOrders(mesa.mesa_id)
                    
                    return (
                      <Card key={mesa.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{t("tables.tableLabel", { id: mesa.mesa_id })}</CardTitle>
                            <Badge className={`${getStatusColor(status)} border`}>
                              {getStatusText(status)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {mesaOrders.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-sm text-gray-600">
                                  {t("tables.ordersCount", { count: mesaOrders.length })}
                                </p>
                                <div className="text-xs text-gray-500">
                                  {t("tables.lastUpdate", { value: new Date(mesa.updated_at).toLocaleTimeString() })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">{t("tables.noOrders")}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedMesa(mesa)}
                              >
                                {t("tables.viewOrders")}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openCreateOrderDialog(mesa)}
                                disabled={!mesa.is_active}
                              >
                                {t("tables.createOrder")}
                              </Button>
                            </div>
                            
                            {/* Controles de estado de mesa */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{t("tables.statusLabel")}</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={mesa.is_active ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleMesaStatusChange(mesa.mesa_id, true)}
                                    className={mesa.is_active ? "bg-green-600 hover:bg-green-700" : ""}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {t("tables.active")}
                                  </Button>
                                  <Button
                                    variant={!mesa.is_active ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleMesaStatusChange(mesa.mesa_id, false)}
                                    className={!mesa.is_active ? "bg-red-600 hover:bg-red-700" : ""}
                                  >
                                    <Minus className="w-3 h-3 mr-1" />
                                    {t("tables.inactive")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}
