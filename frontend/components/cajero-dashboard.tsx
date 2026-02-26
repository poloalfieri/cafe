"use client"

import { getBackendBaseUrl, getRestaurantSlug, getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect, useCallback, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RefreshCw, Users, CheckCircle, Clock, Minus, Bell, LogOut, Plus, Trash2, CreditCard, Banknote, QrCode, XCircle, Split } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// WaiterCallCard no longer used here; waiter calls rendered inline
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
import SplitPaymentModal from "@/components/split-payment-modal"

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
  payment_method?: string | null
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

interface CashRegister {
  id: string
  name: string
  branch_id: string
  active: boolean
}

interface CashSession {
  id: string
  register_id: string
  status: "OPEN" | "CLOSED"
  opening_amount: number
  expected_amount_live?: number
  closing_counted_amount?: number | null
  difference_amount?: number | null
}

interface CashMovement {
  id: string
  type: string
  amount: number
  direction: "IN" | "OUT"
  payment_method?: string | null
  note?: string | null
  created_at: string
}

type PrebillDialogStep = "ASK_PRINT" | "CONFIRM_PRINTED"


export default function CajeroDashboard() {
  const t = useTranslations("cajero.dashboard")
  const tWaiter = useTranslations("cajero.waiterCall")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [activeTab, setActiveTab] = useState<"pagos" | "mesas" | "caja">("mesas")
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
  const [manualDiscounts, setManualDiscounts] = useState<Array<{ id: string; name: string; type: string; value: number }>>([])
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("")
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
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [splitPaymentOrderId, setSplitPaymentOrderId] = useState<string | null>(null)
  const [splitPaymentOrderTotal, setSplitPaymentOrderTotal] = useState<number>(0)
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([])
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>("")
  const [cashSession, setCashSession] = useState<CashSession | null>(null)
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([])
  const [cashLoading, setCashLoading] = useState(false)
  const [cashError, setCashError] = useState<string | null>(null)
  const [openingAmount, setOpeningAmount] = useState("0")
  const [movementAmount, setMovementAmount] = useState("")
  const [movementType, setMovementType] = useState<"MANUAL_IN" | "MANUAL_OUT">("MANUAL_IN")
  const [movementNote, setMovementNote] = useState("")
  const [closingAmount, setClosingAmount] = useState("")
  const skipNextOrdersSocketRefreshRef = useRef(0)
  const skipNextWaiterCallsSocketRefreshRef = useRef(0)

  const backendUrl = getTenantApiBase()
  const socketBaseUrl = getBackendBaseUrl()
  const normalizePrice = (value: number): number => Math.round(value * 100) / 100
  const pendingOrders = orders.filter((order) => {
    const s = (order.status || "").toUpperCase()
    return s !== "PAID" && s !== "CANCELLED"
  })

  const getPaymentMethodIcon = (method?: string | null) => {
    const normalized = (method || "").toUpperCase()
    switch (normalized) {
      case "CARD":
        return <CreditCard className="w-4 h-4" />
      case "CASH":
        return <Banknote className="w-4 h-4" />
      case "QR":
        return <QrCode className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const getPaymentMethodText = (method?: string | null) => {
    const normalized = (method || "").toUpperCase()
    switch (normalized) {
      case "CARD":
        return tWaiter("payment.card")
      case "CASH":
        return tWaiter("payment.cash")
      case "QR":
        return tWaiter("payment.qr")
      case "MERCADOPAGO":
        return "Mercado Pago"
      case "ASSISTANCE":
        return tWaiter("payment.assistance")
      default:
        return t("payments.unknownPaymentMethod")
    }
  }

  const getOrderItems = (order: Order) => {
    if (!Array.isArray(order.items)) return []
    return order.items
      .map((item: any) => {
        const name = item?.name || item?.title || ""
        const qty = item?.quantity ?? item?.qty ?? 1
        return name ? { name, qty } : null
      })
      .filter(Boolean) as Array<{ name: string; qty: number }>
  }

  const getResolvedAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const asyncAuthHeader = await getClientAuthHeaderAsync()
    const fallbackAuthHeader = getClientAuthHeader()
    if (!asyncAuthHeader.Authorization && !fallbackAuthHeader.Authorization) {
      return {}
    }
    return { ...fallbackAuthHeader, ...asyncAuthHeader }
  }, [])

  const fetchWithAuthRetry = useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const resolvedAuthHeader = await getResolvedAuthHeader()
      const baseHeaders = init.headers as Record<string, string> | undefined

      let response = await fetch(url, {
        ...init,
        headers: {
          ...(baseHeaders || {}),
          ...resolvedAuthHeader,
        },
      })

      if (response.status !== 401) {
        return response
      }

      try {
        await supabase.auth.refreshSession()
      } catch {
        // ignore refresh errors; retry below will still use current token state
      }

      const retryAuthHeader = await getResolvedAuthHeader()
      response = await fetch(url, {
        ...init,
        headers: {
          ...(baseHeaders || {}),
          ...retryAuthHeader,
        },
      })
      return response
    },
    [getResolvedAuthHeader]
  )

  const filterRecentOrders = (ordersData: any[]): Order[] => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return (ordersData || []).filter((order: any) => {
      const raw = order.created_at || order.creation_date
      if (!raw) return false
      const ts = new Date(raw).getTime()
      return Number.isFinite(ts) && ts >= cutoff
    })
  }

  const fetchMesasOnly = useCallback(
    async (currentBranchId?: string | null, authHeaderOverride?: Record<string, string>) => {
      try {
        const authHeader = authHeaderOverride || (await getResolvedAuthHeader())
        const branchQuery = currentBranchId ? `?branch_id=${currentBranchId}` : ""
        const mesasResponse = await fetchWithAuthRetry(`${backendUrl}/mesas${branchQuery}`, {
          headers: authHeader,
        })
        if (mesasResponse.ok) {
          const mesasData = await mesasResponse.json()
          setMesas(mesasData.mesas || [])
        } else {
          console.error(t("errors.fetchData"), `mesas status ${mesasResponse.status}`)
        }
      } catch (error) {
        console.error(t("errors.fetchData"), error)
      }
    },
    [backendUrl, fetchWithAuthRetry, getResolvedAuthHeader, t]
  )

  const fetchOrdersOnly = useCallback(
    async (
      currentBranchId?: string | null,
      authHeaderOverride?: Record<string, string>
    ): Promise<Order[]> => {
      try {
        const authHeader = authHeaderOverride || (await getResolvedAuthHeader())
        const branchQuery = currentBranchId ? `?branch_id=${currentBranchId}` : ""
        const ordersResponse = await fetchWithAuthRetry(`${backendUrl}/orders${branchQuery}`, {
          headers: authHeader,
        })
        if (!ordersResponse.ok) {
          console.error(t("errors.fetchData"), `orders status ${ordersResponse.status}`)
          return []
        }
        const ordersData = await ordersResponse.json()
        const filtered = filterRecentOrders(ordersData || [])
        setOrders(filtered)
        return filtered
      } catch (error) {
        console.error(t("errors.fetchData"), error)
        return []
      }
    },
    [backendUrl, fetchWithAuthRetry, getResolvedAuthHeader, t]
  )

  const fetchWaiterCalls = useCallback(async (currentBranchId?: string | null) => {
    try {
      const authHeader = await getResolvedAuthHeader()
      const params = new URLSearchParams({ status: "PENDING" })
      if (currentBranchId) {
        params.set("branch_id", currentBranchId)
      }
      const response = await fetchWithAuthRetry(`${backendUrl}/waiter/calls?${params.toString()}`, {
        headers: authHeader,
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.calls)) {
          setWaiterCalls(data.calls)
        }
      } else {
        console.error(t("errors.fetchWaiterCalls"), `waiter calls status ${response.status}`)
      }
    } catch (error) {
      console.error(t("errors.fetchWaiterCalls"), error)
    }
  }, [backendUrl, fetchWithAuthRetry, getResolvedAuthHeader, t])

  const fetchCashRegisters = useCallback(async (currentBranchId?: string | null) => {
    if (!currentBranchId) return
    try {
      const authHeader = await getResolvedAuthHeader()
      const response = await fetchWithAuthRetry(`${backendUrl}/cash/registers?branch_id=${encodeURIComponent(currentBranchId)}`, {
        headers: authHeader,
      })
      if (!response.ok) {
        setCashError(t("cash.errors.loadRegisters"))
        return
      }
      const payload = await response.json()
      const list = Array.isArray(payload?.data) ? payload.data : []
      setCashRegisters(list)
      if (!selectedRegisterId && list.length > 0) {
        setSelectedRegisterId(String(list[0].id))
      }
    } catch (error) {
      console.error(t("cash.errors.loadRegisters"), error)
      setCashError(t("cash.errors.loadRegisters"))
    }
  }, [backendUrl, fetchWithAuthRetry, getResolvedAuthHeader, selectedRegisterId, t])

  const fetchCurrentCashSession = useCallback(async (currentBranchId?: string | null, registerId?: string) => {
    if (!currentBranchId) return
    try {
      const authHeader = await getResolvedAuthHeader()
      const params = new URLSearchParams({ branch_id: currentBranchId })
      if (registerId) params.set("register_id", registerId)
      const response = await fetchWithAuthRetry(`${backendUrl}/cash/sessions/current?${params.toString()}`, {
        headers: authHeader,
      })
      if (!response.ok) {
        setCashSession(null)
        return
      }
      const payload = await response.json()
      setCashSession(payload?.data || null)
    } catch (error) {
      console.error(t("cash.errors.loadSession"), error)
      setCashError(t("cash.errors.loadSession"))
    }
  }, [backendUrl, fetchWithAuthRetry, getResolvedAuthHeader, t])

  const fetchCashMovements = useCallback(async (sessionId?: string) => {
    if (!sessionId) {
      setCashMovements([])
      return
    }
    try {
      const authHeader = await getResolvedAuthHeader()
      const response = await fetchWithAuthRetry(`${backendUrl}/cash/sessions/${sessionId}/movements`, {
        headers: authHeader,
      })
      if (!response.ok) {
        setCashError(t("cash.errors.loadMovements"))
        return
      }
      const payload = await response.json()
      const list = Array.isArray(payload?.data) ? payload.data : []
      setCashMovements(list)
    } catch (error) {
      console.error(t("cash.errors.loadMovements"), error)
      setCashError(t("cash.errors.loadMovements"))
    }
  }, [backendUrl, fetchWithAuthRetry, getResolvedAuthHeader, t])

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

  const fetchData = useCallback(async (currentBranchId?: string | null): Promise<Order[]> => {
    setLoading(true)
    try {
      const authHeader = await getResolvedAuthHeader()
      const [, nextOrders] = await Promise.all([
        fetchMesasOnly(currentBranchId, authHeader),
        fetchOrdersOnly(currentBranchId, authHeader),
      ])
      return nextOrders
    } catch (error) {
      console.error(t("errors.fetchData"), error)
      return []
    } finally {
      setLoading(false)
    }
  }, [fetchMesasOnly, fetchOrdersOnly, getResolvedAuthHeader, t])

  const fetchBranch = async () => {
    try {
      const authHeader = await getResolvedAuthHeader()
      const response = await fetchWithAuthRetry(`${backendUrl}/branches/me`, {
        headers: authHeader,
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
          await Promise.all([fetchData(id), fetchWaiterCalls(id), fetchCashRegisters(id)])
        } else {
          await Promise.all([fetchData(null), fetchWaiterCalls(null)])
        }
      } else {
        await Promise.all([fetchData(null), fetchWaiterCalls(null)])
      }
    } catch (error) {
      console.error(t("errors.fetchBranch"), error)
      await Promise.all([fetchData(null), fetchWaiterCalls(null)])
    }
  }

  useEffect(() => {
    if (!branchId) return
    if (!selectedRegisterId) {
      setCashSession(null)
      setCashMovements([])
      return
    }
    void (async () => {
      setCashLoading(true)
      setCashError(null)
      try {
        await fetchCurrentCashSession(branchId, selectedRegisterId)
      } finally {
        setCashLoading(false)
      }
    })()
  }, [branchId, selectedRegisterId, fetchCurrentCashSession])

  useEffect(() => {
    void fetchCashMovements(cashSession?.id)
  }, [cashSession?.id, fetchCashMovements])

  useEffect(() => {
    const socket = io(socketBaseUrl || undefined, {
      transports: ["websocket"],
      withCredentials: true,
    })

    if (process.env.NODE_ENV !== "production") {
      socket.onAny((event, payload) => {
        if ((window as any).__socketDebug) {
          console.log("[socket]", event, payload)
        }
      })
    }

    socket.on("waiter_calls:updated", (payload: any) => {
      if (payload?.branch_id && branchId && payload.branch_id !== branchId) {
        return
      }
      if (skipNextWaiterCallsSocketRefreshRef.current > 0) {
        skipNextWaiterCallsSocketRefreshRef.current -= 1
        return
      }
      void fetchWaiterCalls(branchId)
    })

    socket.on("orders:updated", (payload: any) => {
      if (payload?.branch_id && branchId && payload.branch_id !== branchId) {
        return
      }
      if (skipNextOrdersSocketRefreshRef.current > 0) {
        skipNextOrdersSocketRefreshRef.current -= 1
        return
      }
      void fetchOrdersOnly(branchId)
    })

    return () => {
      socket.disconnect()
    }
  }, [socketBaseUrl, branchId, fetchWaiterCalls, fetchOrdersOnly])

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
    setSelectedDiscountId("")
    resetOptionsDialogState()
  }

  const openCreateOrderDialog = (mesa: Mesa) => {
    setCreateOrderMesa(mesa)
    setDraftOrderItems([])
    setCreateOrderPaymentMethod("CASH")
    setCreateOrderError(null)
    setSelectedDiscountId("")
    const branchId = resolveMesaBranchId(mesa)
    void fetchMenuForCreateOrder(branchId)
    // Cargar descuentos manuales disponibles
    ;(async () => {
      try {
        const authHeader = await getClientAuthHeaderAsync()
        const params = new URLSearchParams()
        if (branchId) params.set("branch_id", branchId)
        const res = await fetch(`${backendUrl}/discounts?${params}`, { headers: authHeader })
        if (res.ok) {
          const json = await res.json()
          setManualDiscounts(json.data || [])
        }
      } catch {
        setManualDiscounts([])
      }
    })()
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
          ...(selectedDiscountId ? { discount_id: selectedDiscountId } : {}),
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        setCreateOrderError(errorPayload?.error || t("orders.createError"))
        return
      }
      const createdOrder = await response.json().catch(() => null)

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
      const callPayload = await callResponse.json().catch(() => null)

      if (createdOrder?.id) {
        setOrders((prev) => {
          if (prev.some((order) => order.id === createdOrder.id)) {
            return prev
          }
          return [createdOrder as Order, ...prev]
        })
      }

      const createdCall = callPayload?.call
      if (createdCall?.id && createdCall?.status === "PENDING") {
        setWaiterCalls((prev) => {
          if (prev.some((call) => call.id === createdCall.id)) {
            return prev
          }
          return [createdCall as WaiterCall, ...prev]
        })
      }

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
        case "PARTIALLY_PAID": return "esperando_pago"
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
      case "PARTIALLY_PAID": return "bg-amber-100 text-amber-800 border-amber-200"
      case "PAID": return "bg-green-100 text-green-800 border-green-200"
      case "PAYMENT_APPROVED": return "bg-green-100 text-green-800 border-green-200"
      case "PAYMENT_REJECTED": return "bg-gray-100 text-gray-800 border-gray-200"
      case "IN_PREPARATION": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "READY": return "bg-blue-100 text-blue-800 border-blue-200"
      case "DELIVERED": return "bg-gray-100 text-gray-500 border-gray-200"
      case "CANCELLED": return "bg-red-100 text-red-600 border-red-200"
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
      case "PARTIALLY_PAID": return t("status.partiallyPaid")
      case "PAID": return t("status.paid")
      case "PAYMENT_APPROVED": return t("status.paymentApproved")
      case "PAYMENT_REJECTED": return t("status.paymentRejected")
      case "IN_PREPARATION": return t("status.inPreparation")
      case "READY": return t("status.ready")
      case "DELIVERED": return t("status.delivered")
      case "CANCELLED": return t("status.cancelled")
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
      const payload = await response.json().catch(() => ({}))
      const printedAt = payload?.prebill_printed_at

      if (printedAt && prebillOrder?.id) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === prebillOrder.id
              ? { ...order, prebill_printed_at: printedAt }
              : order
          )
        )
      }
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
    skipNextWaiterCallsSocketRefreshRef.current += 1
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
        setWaiterCalls(prev => prev.filter(call => call.id !== callId))
      } else {
        skipNextWaiterCallsSocketRefreshRef.current = Math.max(
          0,
          skipNextWaiterCallsSocketRefreshRef.current - 1
        )
        const errorData = await response.json()
        console.error(t("errors.updateCallStatus"), errorData.error)
      }
    } catch (error) {
      skipNextWaiterCallsSocketRefreshRef.current = Math.max(
        0,
        skipNextWaiterCallsSocketRefreshRef.current - 1
      )
      console.error(t("errors.updateCallStatus"), error)
    }
  }

  const completePendingOrder = async (order: Order) => {
    if (!order?.id || completingOrderId) return
    skipNextOrdersSocketRefreshRef.current += 1
    try {
      setCompletingOrderId(order.id)
      const authHeader = await getClientAuthHeaderAsync()
      const body: Record<string, any> = { status: "PAID" }
      if (order.payment_method) {
        body.payment_method = order.payment_method
      }
      const response = await fetch(`${backendUrl}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        skipNextOrdersSocketRefreshRef.current = Math.max(
          0,
          skipNextOrdersSocketRefreshRef.current - 1
        )
        const errorData = await response.json().catch(() => ({}))
        console.error(t("payments.completeError"), errorData?.error)
        return
      }
      setOrders(prev => prev.filter(o => o.id !== order.id))
      setPrebillOrder(order)
      setPrebillStep("ASK_PRINT")
      setPrebillDialogOpen(true)
    } catch (error) {
      skipNextOrdersSocketRefreshRef.current = Math.max(
        0,
        skipNextOrdersSocketRefreshRef.current - 1
      )
      console.error(t("payments.completeError"), error)
    } finally {
      setCompletingOrderId(null)
    }
  }

  const cancelPendingOrder = async (order: Order) => {
    if (!order?.id || cancellingOrderId) return
    skipNextOrdersSocketRefreshRef.current += 1
    try {
      setCancellingOrderId(order.id)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!response.ok) {
        skipNextOrdersSocketRefreshRef.current = Math.max(
          0,
          skipNextOrdersSocketRefreshRef.current - 1
        )
        const errorData = await response.json().catch(() => ({}))
        console.error(t("payments.completeError"), errorData?.error)
        return
      }
      setOrders(prev => prev.filter(o => o.id !== order.id))
    } catch (error) {
      skipNextOrdersSocketRefreshRef.current = Math.max(
        0,
        skipNextOrdersSocketRefreshRef.current - 1
      )
      console.error(t("payments.completeError"), error)
    } finally {
      setCancellingOrderId(null)
    }
  }

  const refreshData = () => {
    void fetchData(branchId)
    void fetchWaiterCalls(branchId)
    void fetchCashRegisters(branchId)
    if (selectedRegisterId) {
      void fetchCurrentCashSession(branchId, selectedRegisterId)
    }
  }


  const openCashSession = async () => {
    if (!selectedRegisterId) return
    try {
      setCashLoading(true)
      setCashError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/cash/sessions/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          register_id: selectedRegisterId,
          opening_amount: Number(openingAmount || "0"),
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || t("cash.errors.openSession"))
      }
      await fetchCurrentCashSession(branchId, selectedRegisterId)
    } catch (error: any) {
      setCashError(error?.message || t("cash.errors.openSession"))
    } finally {
      setCashLoading(false)
    }
  }

  const createManualMovement = async () => {
    if (!cashSession?.id) return
    const amount = Number(movementAmount || "0")
    if (!Number.isFinite(amount) || amount <= 0) return
    const direction = movementType === "MANUAL_IN" ? "IN" : "OUT"
    try {
      setCashLoading(true)
      setCashError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/cash/movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          session_id: cashSession.id,
          type: movementType,
          amount,
          direction,
          note: movementNote,
          impacts_cash: true,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || t("cash.errors.createMovement"))
      }
      setMovementAmount("")
      setMovementNote("")
      await Promise.all([
        fetchCurrentCashSession(branchId, selectedRegisterId),
        fetchCashMovements(cashSession.id),
      ])
    } catch (error: any) {
      setCashError(error?.message || t("cash.errors.createMovement"))
    } finally {
      setCashLoading(false)
    }
  }

  const closeCashSession = async () => {
    if (!cashSession?.id) return
    try {
      setCashLoading(true)
      setCashError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/cash/sessions/${cashSession.id}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          closing_counted_amount: Number(closingAmount || "0"),
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || t("cash.errors.closeSession"))
      }
      setClosingAmount("")
      await Promise.all([
        fetchCurrentCashSession(branchId, selectedRegisterId),
        fetchCashMovements(undefined),
      ])
    } catch (error: any) {
      setCashError(error?.message || t("cash.errors.closeSession"))
    } finally {
      setCashLoading(false)
    }
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
                                  {t("prebill.printedBadge")}
                                </Badge>
                                <p className="text-[11px] text-emerald-700">
                                  {t("prebill.printedAt", { date: formatPrebillPrintedAt(order.prebill_printed_at) })}
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
                              {t("prebill.actions.reprint")}
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

              {/* Selector de descuento manual */}
              {manualDiscounts.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">{t("orders.discountLabel")}</p>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedDiscountId}
                    onChange={(e) => setSelectedDiscountId(e.target.value)}
                  >
                    <option value="">{t("orders.noDiscount")}</option>
                    {manualDiscounts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type === "percent" ? `${d.value}%` : `$${d.value}`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                <div>
                  {selectedDiscountId && (() => {
                    const disc = manualDiscounts.find((d) => d.id === selectedDiscountId)
                    if (!disc) return null
                    const saving = disc.type === "percent"
                      ? createOrderTotal * disc.value / 100
                      : Math.min(disc.value, createOrderTotal)
                    return (
                      <p className="text-xs text-green-600">
                        {t("orders.discountSaving", { amount: saving.toFixed(2) })}
                      </p>
                    )
                  })()}
                  <p className="text-sm font-semibold text-gray-900">
                    {t("orders.total", { total: (() => {
                      if (!selectedDiscountId) return createOrderTotal.toFixed(2)
                      const disc = manualDiscounts.find((d) => d.id === selectedDiscountId)
                      if (!disc) return createOrderTotal.toFixed(2)
                      const saving = disc.type === "percent"
                        ? createOrderTotal * disc.value / 100
                        : Math.min(disc.value, createOrderTotal)
                      return Math.max(0, createOrderTotal - saving).toFixed(2)
                    })() })}
                  </p>
                </div>
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
                  ? t("prebill.dialog.completedTitle")
                  : t("prebill.dialog.confirmTitle")}
              </DialogTitle>
              <DialogDescription>
                {prebillStep === "ASK_PRINT"
                  ? t("prebill.dialog.askPrint")
                  : t("prebill.dialog.confirmPrinted")}
              </DialogDescription>
            </DialogHeader>
            {prebillOrder ? (
              <p className="text-xs text-muted-foreground">
                {t("prebill.dialog.orderRef", { id: prebillOrder.id })}
              </p>
            ) : null}
            {prebillStep === "ASK_PRINT" ? (
              <div className="space-y-2 pt-2">
                <Button onClick={startPrebillPrinting} className="w-full">
                  {t("prebill.actions.print")}
                </Button>
                <Button type="button" variant="secondary" onClick={resetPrebillDialog} className="w-full">
                  {t("prebill.actions.skip")}
                </Button>
                <Button type="button" variant="ghost" disabled className="w-full">
                  {t("prebill.actions.fiscalPlaceholder")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <Button onClick={markPrebillPrinted} className="w-full" disabled={markingPrebill}>
                  {markingPrebill ? t("prebill.actions.marking") : t("prebill.actions.confirmPrinted")}
                </Button>
                <Button type="button" variant="outline" onClick={retryPrebillPrinting} className="w-full">
                  {t("prebill.actions.retry")}
                </Button>
                <Button type="button" variant="secondary" onClick={resetPrebillDialog} className="w-full">
                  {t("prebill.actions.close")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "pagos" | "mesas" | "caja")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-card border border-border">
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
            <TabsTrigger value="caja" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
              {t("tabs.cash")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pagos">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p className="text-gray-600">{t("payments.loading")}</p>
              </div>
            ) : waiterCalls.length === 0 && pendingOrders.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("payments.emptyTitle")}</h3>
                <p className="text-gray-600">{t("payments.emptySubtitle")}</p>
                <p className="text-gray-400 text-sm mt-2">{t("payments.autoRefresh")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{t("payments.autoRefresh")}</p>

                {pendingOrders.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {t("payments.pendingOrdersTitle", { count: pendingOrders.length })}
                    </h4>
                    {pendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 ring-1 ring-orange-50"
                      >
                        <div className="p-4 border-b border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-500">
                                <span className="text-white font-bold text-lg">
                                  {String(order.mesa_id).replace("Mesa ", "")}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <Bell className="w-4 h-4 text-orange-500" />
                                  {t("payments.tableLabel")} {order.mesa_id}
                                </h3>
                                <p className="text-xs text-gray-600">
                                  #{String(order.id || "").slice(0, 8)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-50 text-orange-700">
                              <Clock className="w-3 h-3" />
                              <span className="text-xs font-medium">
                                {new Date(order.created_at || Date.now()).toLocaleTimeString("es-ES", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>
                              {tWaiter("callTime", {
                                time: new Date(order.created_at || Date.now()).toLocaleTimeString("es-ES", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }),
                              })}
                            </span>
                            <Badge variant="outline">{getStatusText(order.status)}</Badge>
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 text-gray-900">
                              {getPaymentMethodIcon(order.payment_method)}
                              <p className="text-sm font-medium">
                                {t("payments.paymentMethodLabel")}: {getPaymentMethodText(order.payment_method)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">
                              {t("payments.itemsLabel")}
                            </p>
                            <div className="space-y-1 text-sm text-gray-700">
                              {getOrderItems(order).length === 0 ? (
                                <p className="text-gray-500">{t("payments.noItems")}</p>
                              ) : (
                                getOrderItems(order).map((item, idx) => (
                                  <div key={`${order.id}-${idx}`} className="flex items-center justify-between">
                                    <span>{item.name}</span>
                                    <span className="text-gray-500">x{item.qty}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{t("payments.totalLabel")}</span>
                            <span className="font-semibold">
                              ${normalizePrice(Number(order.total_amount || 0)).toFixed(2)}
                            </span>
                          </div>

                          <div className="space-y-2 pt-2">
                            {order.status !== "PARTIALLY_PAID" && (
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  onClick={() => completePendingOrder(order)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={completingOrderId === order.id || cancellingOrderId === order.id}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  {completingOrderId === order.id
                                    ? t("payments.completingAction")
                                    : t("payments.completeAction")}
                                </Button>
                                <Button
                                  onClick={() => cancelPendingOrder(order)}
                                  variant="outline"
                                  className="border-red-300 text-red-600 hover:bg-red-50"
                                  disabled={completingOrderId === order.id || cancellingOrderId === order.id}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  {t("orders.cancel")}
                                </Button>
                              </div>
                            )}
                            <Button
                              onClick={() => {
                                setSplitPaymentOrderId(order.id)
                                setSplitPaymentOrderTotal(Number(order.total_amount || 0))
                              }}
                              variant={order.status === "PARTIALLY_PAID" ? "default" : "outline"}
                              className={order.status === "PARTIALLY_PAID"
                                ? "w-full bg-amber-600 hover:bg-amber-700 text-white"
                                : "w-full"
                              }
                            >
                              <Split className="w-4 h-4 mr-2" />
                              {t("payments.splitAction")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {waiterCalls.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {t("payments.waiterCallsTitle", { count: waiterCalls.length })}
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      {waiterCalls.map((call) => {
                        const callId = typeof call.id === "string" ? call.id : String(call.id ?? "")
                        const mesaLabel = typeof call.mesa_id === "string" ? call.mesa_id : String(call.mesa_id ?? "")
                        return (
                          <div
                            key={call.id}
                            className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 ring-1 ring-orange-50"
                          >
                            <div className="p-4 border-b border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-500">
                                    <span className="text-white font-bold text-lg">
                                      {mesaLabel.replace("Mesa ", "")}
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                      <Bell className="w-4 h-4 text-orange-500" />
                                      {mesaLabel}
                                    </h3>
                                    <p className="text-xs text-gray-600">#{callId.slice(0, 8)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-50 text-orange-700">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-xs font-medium">
                                    {new Date(call.created_at || Date.now()).toLocaleTimeString("es-ES", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>
                                  {tWaiter("callTime", {
                                    time: new Date(call.created_at || Date.now()).toLocaleTimeString("es-ES", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }),
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="p-4 space-y-4">
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-900">
                                  {getPaymentMethodIcon(call.payment_method)}
                                  <p className="text-sm font-medium">
                                    {getPaymentMethodText(call.payment_method)}
                                  </p>
                                </div>
                              </div>
                              {call.message && (
                                <div className="p-3 bg-gray-50 rounded-lg">
                                  <p className="text-sm text-gray-900">
                                    <span className="font-medium text-gray-600">{tWaiter("messageLabel")}</span> {call.message}
                                  </p>
                                </div>
                              )}
                              <div className="pt-2">
                                <Button
                                  onClick={() => updateCallStatus(callId, "COMPLETED")}
                                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                                  disabled={!callId}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  {tWaiter("actions.complete")}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="caja">
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">{t("cash.registerTitle")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={selectedRegisterId}
                    onChange={(e) => setSelectedRegisterId(e.target.value)}
                  >
                    <option value="">{t("cash.selectRegister")}</option>
                    {cashRegisters.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">{t("cash.sessionTitle")}</h3>
                {cashSession ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      {t("cash.sessionOpenId", { id: cashSession.id.slice(0, 8) })}
                    </p>
                    <p className="text-sm text-gray-700">
                      {t("cash.expectedNow", { amount: Number(cashSession.expected_amount_live || 0).toFixed(2) })}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        value={closingAmount}
                        onChange={(e) => setClosingAmount(e.target.value)}
                        placeholder={t("cash.closingAmountPlaceholder")}
                        className="border border-gray-300 rounded-md px-3 py-2"
                      />
                      <Button
                        onClick={closeCashSession}
                        disabled={cashLoading || !closingAmount}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {t("cash.closeSession")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      placeholder={t("cash.openingAmountPlaceholder")}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    />
                    <Button onClick={openCashSession} disabled={cashLoading || !selectedRegisterId}>
                      {t("cash.openSession")}
                    </Button>
                  </div>
                )}
              </div>

              {cashSession && (
                <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">{t("cash.manualMovementTitle")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <select
                      className="border border-gray-300 rounded-md px-3 py-2"
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value as "MANUAL_IN" | "MANUAL_OUT")}
                    >
                      <option value="MANUAL_IN">{t("cash.manualIn")}</option>
                      <option value="MANUAL_OUT">{t("cash.manualOut")}</option>
                    </select>
                    <input
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      placeholder={t("cash.movementAmountPlaceholder")}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    />
                    <input
                      value={movementNote}
                      onChange={(e) => setMovementNote(e.target.value)}
                      placeholder={t("cash.movementNotePlaceholder")}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    />
                    <Button onClick={createManualMovement} disabled={cashLoading || !movementAmount}>
                      {t("cash.addMovement")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">{t("cash.movementsTitle")}</h3>
                {cashError && <p className="text-sm text-red-600">{cashError}</p>}
                {cashLoading && <p className="text-sm text-gray-500">{t("cash.loading")}</p>}
                {!cashLoading && cashMovements.length === 0 && (
                  <p className="text-sm text-gray-500">{t("cash.noMovements")}</p>
                )}
                {cashMovements.length > 0 && (
                  <div className="space-y-2">
                    {cashMovements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-md px-3 py-2">
                        <span>{m.type}</span>
                        <span className={m.direction === "IN" ? "text-green-700" : "text-red-700"}>
                          {m.direction === "IN" ? "+" : "-"}${Number(m.amount || 0).toFixed(2)}
                        </span>
                        <span className="text-gray-500">{new Date(m.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

        <SplitPaymentModal
          isOpen={!!splitPaymentOrderId}
          onClose={() => setSplitPaymentOrderId(null)}
          orderId={splitPaymentOrderId || ""}
          orderTotal={splitPaymentOrderTotal}
          onPaymentComplete={() => {
            setSplitPaymentOrderId(null)
            fetchOrdersOnly(branchId)
          }}
        />
      </div>
    </div>
  )
}
