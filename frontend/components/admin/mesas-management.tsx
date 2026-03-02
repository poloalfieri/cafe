"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Plus, Trash2, CheckCircle, Minus, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useToast } from "@/hooks/use-toast"

interface Mesa {
  id: string
  mesa_id: string
  branch_id: string
  is_active: boolean
  capacity: number | null
  created_at: string
  updated_at: string
}

interface MesasManagementProps {
  branchId?: string
}

const SPECIAL_MESAS = new Set(["Delivery", "Caja"])

function getMesaLabel(mesaId: string) {
  return SPECIAL_MESAS.has(mesaId) ? mesaId : `Mesa ${mesaId}`
}

export default function MesasManagement({ branchId }: MesasManagementProps) {
  const { toast } = useToast()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newMesaId, setNewMesaId] = useState("")
  const [newCapacity, setNewCapacity] = useState("")
  const [mesaToDelete, setMesaToDelete] = useState<Mesa | null>(null)

  const backendUrl = getTenantApiBase()

  useEffect(() => {
    fetchMesas()
  }, [branchId])

  const fetchMesas = async () => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const query = branchId ? `?branch_id=${branchId}` : ""
      const res = await fetch(`${backendUrl}/mesas${query}`, { headers: { ...authHeader } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMesas(data.mesas || [])
    } catch {
      toast({ title: "Error al cargar mesas", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newMesaId.trim() || !branchId) return
    setCreating(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const body: Record<string, unknown> = { mesa_id: newMesaId.trim(), branch_id: branchId }
      if (newCapacity) body.capacity = parseInt(newCapacity)
      const res = await fetch(`${backendUrl}/mesas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setMesas(prev => [...prev, data.mesa])
      setShowCreateDialog(false)
      setNewMesaId("")
      setNewCapacity("")
      toast({ title: `Mesa ${getMesaLabel(newMesaId.trim())} creada` })
    } catch (err: any) {
      toast({ title: "Error al crear mesa", description: err.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (mesa: Mesa) => {
    setTogglingId(mesa.mesa_id)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/mesas/${encodeURIComponent(mesa.mesa_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ branch_id: mesa.branch_id, is_active: !mesa.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setMesas(prev => prev.map(m => m.mesa_id === mesa.mesa_id ? { ...m, is_active: !m.is_active } : m))
    } catch (err: any) {
      toast({ title: "Error al actualizar mesa", description: err.message, variant: "destructive" })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!mesaToDelete) return
    setDeletingId(mesaToDelete.mesa_id)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(
        `${backendUrl}/mesas/${encodeURIComponent(mesaToDelete.mesa_id)}?branch_id=${mesaToDelete.branch_id}`,
        { method: "DELETE", headers: { ...authHeader } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setMesas(prev => prev.filter(m => m.mesa_id !== mesaToDelete.mesa_id))
      toast({ title: `${getMesaLabel(mesaToDelete.mesa_id)} eliminada` })
      setMesaToDelete(null)
    } catch (err: any) {
      toast({ title: "Error al eliminar mesa", description: err.message, variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando mesas...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mesas</h2>
          <p className="text-sm text-muted-foreground">{mesas.length} mesa{mesas.length !== 1 ? "s" : ""} en esta sucursal</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} disabled={!branchId}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva mesa
        </Button>
      </div>

      {mesas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <UtensilsCrossed className="w-10 h-10" />
          <p>No hay mesas para esta sucursal</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mesas.map((mesa) => (
            <Card key={mesa.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{getMesaLabel(mesa.mesa_id)}</CardTitle>
                  <Badge variant={mesa.is_active ? "default" : "secondary"}>
                    {mesa.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {mesa.capacity && (
                  <p className="text-sm text-muted-foreground">Capacidad: {mesa.capacity} personas</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(mesa)}
                    disabled={togglingId === mesa.mesa_id}
                  >
                    {mesa.is_active ? (
                      <><Minus className="w-3 h-3 mr-1" />Desactivar</>
                    ) : (
                      <><CheckCircle className="w-3 h-3 mr-1" />Activar</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMesaToDelete(mesa)}
                    disabled={deletingId === mesa.mesa_id}
                    title={`Borrar ${getMesaLabel(mesa.mesa_id)}`}
                    aria-label={`Borrar ${getMesaLabel(mesa.mesa_id)}`}
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear mesa */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva mesa</DialogTitle>
            <DialogDescription>Ingresá el número o nombre de la mesa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="mesa-id">Número de mesa</Label>
              <Input
                id="mesa-id"
                placeholder="Ej: 5"
                value={newMesaId}
                onChange={e => setNewMesaId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="capacity">Capacidad (opcional)</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="Ej: 4"
                min={1}
                value={newCapacity}
                onChange={e => setNewCapacity(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating || !newMesaId.trim()}>
                {creating ? "Creando..." : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar borrado */}
      <Dialog open={!!mesaToDelete} onOpenChange={open => !open && setMesaToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar borrado</DialogTitle>
            <DialogDescription>
              ¿Borrar {mesaToDelete ? getMesaLabel(mesaToDelete.mesa_id) : ""}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMesaToDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!!deletingId}
            >
              {deletingId ? "Borrando..." : "Borrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
