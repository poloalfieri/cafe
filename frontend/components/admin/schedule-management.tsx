"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { 
  MapPin
} from "lucide-react"
import { useTranslations } from "next-intl"

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface ScheduleManagementProps {
  branchId?: string
}

export default function ScheduleManagement({ branchId }: ScheduleManagementProps) {
  const t = useTranslations("admin.schedule")
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [showCreateMesa, setShowCreateMesa] = useState(false)
  const [mesaIdInput, setMesaIdInput] = useState("")
  const [mesaActive, setMesaActive] = useState(true)
  const [creatingMesa, setCreatingMesa] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const backendUrl = getTenantApiBase()

  useEffect(() => {
    fetchData()
  }, [branchId])

  const fetchData = async () => {
    try {
      setCreateError(null)
      const authHeader = await getClientAuthHeaderAsync()
      const query = branchId ? `?branch_id=${branchId}` : ""

      const mesasResponse = await fetch(`${backendUrl}/mesas${query}`, {
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
    } catch (error) {
      console.error("Error fetching data:", error)
      setMesas([])
    }
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
          is_active: mesaActive
        })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || t("tables.createError"))
      }
      setMesaIdInput("")
      setMesaActive(true)
      setShowCreateMesa(false)
      await fetchData()
    } catch (error: any) {
      setCreateError(error?.message || t("tables.createError"))
    } finally {
      setCreatingMesa(false)
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
            <Button onClick={fetchData} className="bg-gray-900 hover:bg-gray-800 text-white">
              {t("actions.refresh")}
            </Button>
          </div>
        </div>

        {/* Vista de mesas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {mesas.map((mesa) => {
            const statusInfo = getStatusInfo(mesa.is_active)
            
            return (
              <div
                key={mesa.id}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Mesa {mesa.mesa_id}</h3>
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
