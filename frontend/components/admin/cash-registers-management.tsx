"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Plus, Monitor, UserPlus, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"

interface CashRegister {
  id: string
  name: string
  branch_id: string
  active: boolean
  created_at: string
}

interface Cashier {
  id: string
  email: string
  branch_id: string | null
}

interface Assignment {
  id: string
  register_id: string
  user_id: string
  active: boolean
}

interface CashRegistersManagementProps {
  branchId?: string
}

export default function CashRegistersManagement({ branchId }: CashRegistersManagementProps) {
  const t = useTranslations("admin.cashRegisters")
  const { toast } = useToast()
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [selectedCashier, setSelectedCashier] = useState<Record<string, string>>({})
  const backendUrl = getTenantApiBase()

  useEffect(() => {
    fetchAll()
  }, [branchId])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchRegisters(), fetchCashiers()])
    setLoading(false)
  }

  const fetchRegisters = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = branchId ? `?branch_id=${branchId}` : ""
      const res = await fetch(`${backendUrl}/cash/registers${params}`, { headers: { ...authHeader } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRegisters(data.data || [])
    } catch {
      toast({ title: t("toast.errorTitle"), description: t("toast.loadRegistersError"), variant: "destructive" })
    }
  }

  const fetchCashiers = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch("/api/admin/list-cashiers", { headers: { ...authHeader } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const list: Cashier[] = data.cashiers || []
      setCashiers(branchId ? list.filter((c) => !c.branch_id || c.branch_id === branchId) : list)
    } catch {
      toast({ title: t("toast.errorTitle"), description: t("toast.loadCashiersError"), variant: "destructive" })
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !branchId) return
    setCreating(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/cash/registers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ name: newName.trim(), branch_id: branchId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("toast.createError"))
      toast({
        title: t("toast.createSuccess"),
        description: t("toast.createSuccessDescription", { name: newName.trim() }),
      })
      setNewName("")
      fetchRegisters()
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: error?.message || t("toast.createError"), variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleAssign = async (registerId: string) => {
    const userId = selectedCashier[registerId]
    if (!userId) return
    setAssigning(registerId)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/cash/registers/${registerId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ user_id: userId, active: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("toast.assignError"))
      const cashier = cashiers.find((c) => c.id === userId)
      toast({
        title: t("toast.assignSuccess"),
        description: t("toast.assignSuccessDescription", { email: cashier?.email ?? userId }),
      })
      setSelectedCashier((prev) => ({ ...prev, [registerId]: "" }))
      setAssignments((prev) => [
        ...prev.filter((a) => !(a.register_id === registerId && a.user_id === userId)),
        { id: data.data?.id ?? Math.random().toString(), register_id: registerId, user_id: userId, active: true },
      ])
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: error?.message || t("toast.assignError"), variant: "destructive" })
    } finally {
      setAssigning(null)
    }
  }

  const handleUnassign = async (registerId: string, userId: string) => {
    setAssigning(registerId)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/cash/registers/${registerId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ user_id: userId, active: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("toast.unassignError"))
      toast({ title: t("toast.unassignSuccess") })
      setAssignments((prev) =>
        prev.map((a) =>
          a.register_id === registerId && a.user_id === userId ? { ...a, active: false } : a
        )
      )
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: error?.message || t("toast.unassignError"), variant: "destructive" })
    } finally {
      setAssigning(null)
    }
  }

  const getAssignedCashiers = (registerId: string) =>
    assignments
      .filter((a) => a.register_id === registerId && a.active)
      .map((a) => cashiers.find((c) => c.id === a.user_id))
      .filter(Boolean) as Cashier[]

  const getAvailableCashiers = (registerId: string) => {
    const assignedIds = assignments
      .filter((a) => a.register_id === registerId && a.active)
      .map((a) => a.user_id)
    return cashiers.filter((c) => !assignedIds.includes(c.id))
  }

  return (
    <div className="space-y-4 mt-8 pt-6 border-t border-gray-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t("header.title")}</h2>
        <p className="text-sm text-gray-600">{t("header.subtitle")}</p>
      </div>

      {!branchId && (
        <p className="text-sm text-amber-600">{t("noBranchSelected")}</p>
      )}

      {branchId && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="new-register-name">{t("form.nameLabel")}</Label>
            <Input
              id="new-register-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("form.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? t("actions.creating") : t("actions.create")}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </div>
      ) : registers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Monitor className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">{t("empty.noRegisters")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registers.map((r) => {
            const assigned = getAssignedCashiers(r.id)
            const available = getAvailableCashiers(r.id)
            const isAssigning = assigning === r.id

            return (
              <Card key={r.id} className="border border-gray-200">
                <CardContent className="p-4 space-y-3">
                  {/* Header de la caja */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400">ID: {r.id.slice(0, 8)}…</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={r.active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"}>
                      {r.active ? t("status.active") : t("status.inactive")}
                    </Badge>
                  </div>

                  {/* Cajeros asignados */}
                  {assigned.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("assigned.title")}</p>
                      {assigned.map((c) => (
                        <div key={c.id} className="flex items-center justify-between bg-green-50 rounded-md px-3 py-1.5">
                          <span className="text-sm text-gray-800">{c.email}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleUnassign(r.id, c.id)}
                            disabled={isAssigning}
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Asignar nuevo cajero */}
                  {available.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <Select
                        value={selectedCashier[r.id] ?? ""}
                        onValueChange={(value) => setSelectedCashier((prev) => ({ ...prev, [r.id]: value }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("assigned.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => handleAssign(r.id)}
                        disabled={!selectedCashier[r.id] || isAssigning}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        {isAssigning ? "…" : t("actions.assign")}
                      </Button>
                    </div>
                  )}

                  {available.length === 0 && cashiers.length > 0 && assigned.length === 0 && (
                    <p className="text-xs text-gray-400">{t("empty.noCashiersAvailable")}</p>
                  )}

                  {cashiers.length === 0 && (
                    <p className="text-xs text-amber-600">{t("empty.noCashiersCreated")}</p>
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
