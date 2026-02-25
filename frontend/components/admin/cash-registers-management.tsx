"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Plus, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useToast } from "@/hooks/use-toast"

interface CashRegister {
  id: string
  name: string
  branch_id: string
  active: boolean
  created_at: string
}

interface CashRegistersManagementProps {
  branchId?: string
}

export default function CashRegistersManagement({ branchId }: CashRegistersManagementProps) {
  const { toast } = useToast()
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const backendUrl = getTenantApiBase()

  useEffect(() => {
    fetchRegisters()
  }, [branchId])

  const fetchRegisters = async () => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const params = branchId ? `?branch_id=${branchId}` : ""
      const response = await fetch(`${backendUrl}/cash/registers${params}`, {
        headers: { ...authHeader },
      })
      if (!response.ok) return
      const data = await response.json()
      setRegisters(data.data || [])
    } catch (_) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !branchId) return
    setCreating(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/cash/registers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ name: newName.trim(), branch_id: branchId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Error al crear caja")
      toast({ title: "Caja creada", description: `"${newName.trim()}" creada correctamente.` })
      setNewName("")
      fetchRegisters()
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "No se pudo crear la caja", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4 mt-8 pt-6 border-t border-gray-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Cajas registradoras</h2>
        <p className="text-sm text-gray-600">Crea y gestiona las cajas disponibles para los cajeros</p>
      </div>

      {!branchId && (
        <p className="text-sm text-amber-600">Seleccioná una sucursal para gestionar sus cajas.</p>
      )}

      {branchId && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="new-register-name">Nombre de la caja</Label>
            <Input
              id="new-register-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Caja 1, Caja Principal..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Creando..." : "Crear caja"}
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
          <p className="text-sm">No hay cajas registradas para esta sucursal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registers.map((r) => (
            <Card key={r.id} className="border border-gray-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-500">ID: {r.id.slice(0, 8)}…</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {r.active ? "Activa" : "Inactiva"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
