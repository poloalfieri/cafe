"use client"

import { getRestaurantSlug, getTenantApiBase } from "@/lib/apiClient"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import {
  Check,
  Copy,
  MapPin,
  Trash2,
  Users
} from "lucide-react"
import { useTranslations } from "next-intl"

interface Mesa {
  id: string
  mesa_id: string
  branch_id?: string
  is_active: boolean
  capacity?: number
  created_at?: string
  updated_at?: string
}

interface ScheduleManagementProps {
  branchId?: string
}

const SPECIAL_MESAS = new Set(["Delivery", "Caja"])
function getMesaLabel(mesaId: string) {
  return SPECIAL_MESAS.has(mesaId) ? mesaId : `Mesa ${mesaId}`
}

export default function ScheduleManagement({ branchId }: ScheduleManagementProps) {
  const t = useTranslations("admin.schedule")
  const [showCreateMesa, setShowCreateMesa] = useState(false)
  const [mesaIdInput, setMesaIdInput] = useState("")
  const [mesaActive, setMesaActive] = useState(true)
  const [mesaCapacity, setMesaCapacity] = useState("4")
  const [creatingMesa, setCreatingMesa] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showEditMesa, setShowEditMesa] = useState(false)
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null)
  const [editMesaIdInput, setEditMesaIdInput] = useState("")
  const [editMesaActive, setEditMesaActive] = useState(true)
  const [editMesaCapacity, setEditMesaCapacity] = useState("4")
  const [editingMesaSave, setEditingMesaSave] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [tableActionError, setTableActionError] = useState<string | null>(null)
  const [copiedMesaId, setCopiedMesaId] = useState<string | null>(null)
  const [deletingMesaId, setDeletingMesaId] = useState<string | null>(null)
  const backendUrl = getTenantApiBase()
  const queryClient = useQueryClient()

  const mesasQuery = useQuery<Mesa[]>({
    queryKey: ["mesas", backendUrl, branchId || "all"],
    queryFn: async () => {
      const authHeader = await getClientAuthHeaderAsync()
      const query = branchId ? `?branch_id=${branchId}` : ""
      const res = await fetch(`${backendUrl}/mesas${query}`, { headers: authHeader })
      if (!res.ok) return []
      const data = await res.json()
      return data.mesas || []
    },
  })

  const mesas = mesasQuery.data ?? []

  const invalidateMesas = () =>
    queryClient.invalidateQueries({ queryKey: ["mesas", backendUrl, branchId || "all"] })

  const parseCapacityInput = (value: string) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      return { value: null as number | null, error: t("tables.capacityRequired") }
    }
    if (!/^[1-9]\d*$/.test(normalizedValue)) {
      return { value: null as number | null, error: t("tables.capacityInvalid") }
    }
    return { value: parseInt(normalizedValue, 10), error: null as string | null }
  }

  const handleCreateMesa = async () => {
    if (!branchId) {
      setCreateError(t("tables.branchRequired"))
      return
    }
    if (!mesaIdInput.trim()) {
      setCreateError(t("tables.mesaIdRequired"))
      return
    }
    if (!/^[1-9]\d*$/.test(mesaIdInput.trim())) {
      setCreateError(t("tables.mesaIdInvalid"))
      return
    }
    const capacityValidation = parseCapacityInput(mesaCapacity)
    if (capacityValidation.error || capacityValidation.value === null) {
      setCreateError(capacityValidation.error || t("tables.capacityInvalid"))
      return
    }
    try {
      setCreatingMesa(true)
      setCreateError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/mesas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          mesa_id: mesaIdInput.trim(),
          branch_id: branchId,
          is_active: mesaActive,
          capacity: capacityValidation.value,
        })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || t("tables.createError"))
      }
      setMesaIdInput("")
      setMesaActive(true)
      setMesaCapacity("4")
      setShowCreateMesa(false)
      await invalidateMesas()
    } catch (error: any) {
      setCreateError(error?.message || t("tables.createError"))
    } finally {
      setCreatingMesa(false)
    }
  }

  const openEditMesa = (mesa: Mesa) => {
    setEditingMesa(mesa)
    setEditMesaIdInput(mesa.mesa_id || "")
    setEditMesaActive(Boolean(mesa.is_active))
    setEditMesaCapacity(String(mesa.capacity ?? 4))
    setEditError(null)
    setShowEditMesa(true)
  }

  const handleEditMesa = async () => {
    if (!editingMesa) return
    const resolvedBranchId = editingMesa.branch_id || branchId
    if (!resolvedBranchId) {
      setEditError(t("tables.branchRequired"))
      return
    }
    const newMesaId = editMesaIdInput.trim()
    if (!newMesaId) {
      setEditError(t("tables.mesaIdRequired"))
      return
    }
    if (!/^[1-9]\d*$/.test(newMesaId)) {
      setEditError(t("tables.mesaIdInvalid"))
      return
    }
    const capacityValidation = parseCapacityInput(editMesaCapacity)
    if (capacityValidation.error || capacityValidation.value === null) {
      setEditError(capacityValidation.error || t("tables.capacityInvalid"))
      return
    }
    try {
      setEditingMesaSave(true)
      setEditError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/mesas/${editingMesa.mesa_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          mesa_id: newMesaId,
          is_active: editMesaActive,
          branch_id: resolvedBranchId,
          capacity: capacityValidation.value,
        })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || t("tables.updateError"))
      }
      setShowEditMesa(false)
      setEditingMesa(null)
      await invalidateMesas()
    } catch (error: any) {
      setEditError(error?.message || t("tables.updateError"))
    } finally {
      setEditingMesaSave(false)
    }
  }

  const getMesaQrUrl = (mesa: Mesa): string | null => {
    if (typeof window === "undefined") return null

    const resolvedBranchId = mesa.branch_id || branchId
    if (!resolvedBranchId) return null

    let slug = ""
    try {
      slug = getRestaurantSlug()
    } catch {
      return null
    }

    const params = new URLSearchParams({
      mesa_id: mesa.mesa_id,
      branch_id: resolvedBranchId,
    })

    return `${window.location.origin}/${slug}/usuario?${params.toString()}`
  }

  const handleCopyMesaQr = async (mesa: Mesa) => {
    const qrUrl = getMesaQrUrl(mesa)
    if (!qrUrl) {
      setTableActionError(t("tables.qrMissingData"))
      return
    }

    try {
      await navigator.clipboard.writeText(qrUrl)
      setTableActionError(null)
      setCopiedMesaId(mesa.id)
      setTimeout(() => {
        setCopiedMesaId((current) => (current === mesa.id ? null : current))
      }, 2000)
    } catch {
      setTableActionError(t("tables.qrCopyError"))
    }
  }

  const handleDeleteMesa = async (mesa: Mesa) => {
    if (!window.confirm(`¿Eliminar ${getMesaLabel(mesa.mesa_id)}? Esta acción no se puede deshacer.`)) return
    try {
      setDeletingMesaId(mesa.id)
      setTableActionError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/mesas/${mesa.mesa_id}`, {
        method: "DELETE",
        headers: { ...authHeader },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || "Error al eliminar la mesa")
      }
      await invalidateMesas()
    } catch (error: any) {
      setTableActionError(error?.message || "Error al eliminar la mesa")
    } finally {
      setDeletingMesaId(null)
    }
  }

  const getStatusInfo = (isActive: boolean) => {
    return isActive
      ? { label: t("tables.active"), color: "bg-green-100 text-green-700 border-green-200" }
      : { label: t("tables.inactive"), color: "bg-gray-100 text-gray-700 border-gray-200" }
  }

  return (
    <div className="space-y-8">
      {/* Gestión de Mesas */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t("tables.title")}</h2>
            <p className="text-sm text-gray-600">{t("tables.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Dialog open={showCreateMesa} onOpenChange={setShowCreateMesa}>
              <DialogTrigger asChild>
                <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                  {t("tables.add")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("tables.addTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {!branchId && (
                    <div className="text-sm text-red-600">{t("tables.branchRequired")}</div>
                  )}
                  {createError && (
                    <div className="text-sm text-red-600">{createError}</div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="mesa_id">{t("tables.mesaId")}</Label>
                    <Input
                      id="mesa_id"
                      value={mesaIdInput}
                      onChange={(e) => setMesaIdInput(e.target.value)}
                      placeholder={t("tables.mesaIdPlaceholder")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mesa_active">{t("tables.activeLabel")}</Label>
                    <Switch
                      id="mesa_active"
                      checked={mesaActive}
                      onCheckedChange={setMesaActive}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mesa_capacity">{t("tables.capacityLabel")}</Label>
                    <Input
                      id="mesa_capacity"
                      type="number"
                      min={1}
                      step={1}
                      value={mesaCapacity}
                      onChange={(e) => setMesaCapacity(e.target.value)}
                      placeholder={t("tables.capacityPlaceholder")}
                    />
                  </div>
                  <Button
                    onClick={handleCreateMesa}
                    disabled={!branchId || creatingMesa}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    {creatingMesa ? t("tables.creating") : t("tables.create")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showEditMesa} onOpenChange={setShowEditMesa}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("tables.editTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {!branchId && !editingMesa?.branch_id && (
                    <div className="text-sm text-red-600">{t("tables.branchRequired")}</div>
                  )}
                  {editError && (
                    <div className="text-sm text-red-600">{editError}</div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="mesa_id_edit">{t("tables.mesaId")}</Label>
                    <Input
                      id="mesa_id_edit"
                      value={editMesaIdInput}
                      onChange={(e) => setEditMesaIdInput(e.target.value)}
                      placeholder={t("tables.mesaIdPlaceholder")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mesa_active_edit">{t("tables.activeLabel")}</Label>
                    <Switch
                      id="mesa_active_edit"
                      checked={editMesaActive}
                      onCheckedChange={setEditMesaActive}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mesa_capacity_edit">{t("tables.capacityLabel")}</Label>
                    <Input
                      id="mesa_capacity_edit"
                      type="number"
                      min={1}
                      step={1}
                      value={editMesaCapacity}
                      onChange={(e) => setEditMesaCapacity(e.target.value)}
                      placeholder={t("tables.capacityPlaceholder")}
                    />
                  </div>
                  <Button
                    onClick={handleEditMesa}
                    disabled={editingMesaSave || !editingMesa}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    {editingMesaSave ? t("tables.updating") : t("tables.update")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => void invalidateMesas()} className="bg-gray-900 hover:bg-gray-800 text-white">
              {t("actions.refresh")}
            </Button>
          </div>
        </div>

        {tableActionError && (
          <div className="text-sm text-red-600">{tableActionError}</div>
        )}

        {/* Vista de mesas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {mesas.map((mesa) => {
            const statusInfo = getStatusInfo(mesa.is_active)
            const qrUrl = getMesaQrUrl(mesa)
            
            return (
              <div
                key={mesa.id}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{getMesaLabel(mesa.mesa_id)}</h3>
                    <p className="text-gray-600 text-sm">{t("tables.idLabel", { id: mesa.id })}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="text-sm text-gray-600">
                  {t("tables.lastUpdate", {
                    value: mesa.updated_at ? new Date(mesa.updated_at).toLocaleString() : "—"
                  })}
                </div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span>{t("tables.capacityValue", { count: mesa.capacity ?? 4 })}</span>
                </div>

                <div className="mt-4 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyMesaQr(mesa)}
                    disabled={!qrUrl}
                    className="w-full"
                  >
                    {copiedMesaId === mesa.id ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copiedMesaId === mesa.id ? t("tables.qrCopied") : t("tables.qrCopy")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openEditMesa(mesa)}
                    className="w-full"
                  >
                    {t("tables.edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDeleteMesa(mesa)}
                    disabled={deletingMesaId === mesa.id}
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deletingMesaId === mesa.id ? "Eliminando…" : "Eliminar mesa"}
                  </Button>
                  {!qrUrl && (
                    <p className="mt-2 text-xs text-red-600">{t("tables.qrMissingData")}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {mesas.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("tables.emptyTitle")}</h3>
            <p className="text-gray-600">{t("tables.emptySubtitle")}</p>
          </div>
        )}
      </div>
    </div>
  )
} 
