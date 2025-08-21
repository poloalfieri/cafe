"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, MapPin, Share, Building, Eye, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface Branch {
  id: string
  name: string
  address: string
  phone: string
  email: string
  manager: string
  status: "activa" | "inactiva"
  share_menu: boolean
  created_at: string
  monthly_sales: number
  total_orders: number
}

export default function BranchesManagement() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [shareMenuGlobally, setShareMenuGlobally] = useState(true)

  // Estados para crear/editar sucursal
  const [branchForm, setBranchForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    manager: "",
    share_menu: true
  })

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    setLoading(true)
    try {
      // En producción, esto vendría del backend
      // Por ahora, uso datos de ejemplo
      setBranches([
        {
          id: "1",
          name: "Sucursal Centro",
          address: "Av. Principal 123, Centro",
          phone: "+54 11 1234-5678",
          email: "centro@mirestaurante.com",
          manager: "Ana García",
          status: "activa",
          share_menu: true,
          created_at: "2024-01-15",
          monthly_sales: 15000,
          total_orders: 450
        },
        {
          id: "2",
          name: "Sucursal Norte",
          address: "Calle Norte 456, Zona Norte",
          phone: "+54 11 8765-4321",
          email: "norte@mirestaurante.com",
          manager: "Carlos Ruiz",
          status: "activa",
          share_menu: true,
          created_at: "2024-02-10",
          monthly_sales: 12000,
          total_orders: 380
        },
        {
          id: "3",
          name: "Sucursal Sur",
          address: "Av. Sur 789, Zona Sur",
          phone: "+54 11 5555-6666",
          email: "sur@mirestaurante.com",
          manager: "María López",
          status: "inactiva",
          share_menu: false,
          created_at: "2024-03-05",
          monthly_sales: 8500,
          total_orders: 220
        }
      ])
    } catch (error) {
      console.error("Error fetching branches:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBranch = async () => {
    try {
      const newBranch: Branch = {
        id: Date.now().toString(),
        ...branchForm,
        status: "activa",
        created_at: new Date().toISOString().split('T')[0],
        monthly_sales: 0,
        total_orders: 0
      }
      
      setBranches([...branches, newBranch])
      setBranchForm({ name: "", address: "", phone: "", email: "", manager: "", share_menu: true })
      setShowCreateBranch(false)
    } catch (error) {
      console.error("Error creating branch:", error)
    }
  }

  const handleUpdateBranch = async () => {
    if (!editingBranch) return
    
    try {
      setBranches(branches.map(branch => 
        branch.id === editingBranch.id ? { ...editingBranch } : branch
      ))
      setEditingBranch(null)
    } catch (error) {
      console.error("Error updating branch:", error)
    }
  }

  const handleToggleBranchStatus = async (branchId: string) => {
    try {
      setBranches(branches.map(branch => 
        branch.id === branchId 
          ? { ...branch, status: branch.status === "activa" ? "inactiva" : "activa" }
          : branch
      ))
    } catch (error) {
      console.error("Error toggling branch status:", error)
    }
  }

  const handleToggleMenuShare = async (branchId: string) => {
    try {
      setBranches(branches.map(branch => 
        branch.id === branchId 
          ? { ...branch, share_menu: !branch.share_menu }
          : branch
      ))
    } catch (error) {
      console.error("Error toggling menu share:", error)
    }
  }

  const handleGlobalMenuShare = async () => {
    try {
      setShareMenuGlobally(!shareMenuGlobally)
      setBranches(branches.map(branch => ({ ...branch, share_menu: !shareMenuGlobally })))
    } catch (error) {
      console.error("Error setting global menu share:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "activa": return "bg-green-100 text-green-800 border-green-200"
      case "inactiva": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const activeBranches = branches.filter(b => b.status === "activa").length
  const totalSales = branches.reduce((sum, branch) => sum + branch.monthly_sales, 0)
  const totalOrders = branches.reduce((sum, branch) => sum + branch.total_orders, 0)

  return (
    <div className="space-y-6">
      {/* Header y configuración global */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestión de Sucursales</h2>
            <p className="text-gray-600">Administra las ubicaciones de tu negocio</p>
          </div>
          <Dialog open={showCreateBranch} onOpenChange={setShowCreateBranch}>
            <DialogTrigger asChild>
              <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Sucursal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nueva Sucursal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre de la Sucursal</Label>
                  <Input
                    id="name"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({...branchForm, name: e.target.value})}
                    placeholder="Ej: Sucursal Centro"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Dirección</Label>
                  <Textarea
                    id="address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({...branchForm, address: e.target.value})}
                    placeholder="Dirección completa"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({...branchForm, phone: e.target.value})}
                    placeholder="+54 11 1234-5678"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({...branchForm, email: e.target.value})}
                    placeholder="sucursal@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="manager">Encargado</Label>
                  <Input
                    id="manager"
                    value={branchForm.manager}
                    onChange={(e) => setBranchForm({...branchForm, manager: e.target.value})}
                    placeholder="Nombre del encargado"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="share_menu"
                    checked={branchForm.share_menu}
                    onCheckedChange={(checked) => setBranchForm({...branchForm, share_menu: checked})}
                  />
                  <Label htmlFor="share_menu">Compartir carta con otras sucursales</Label>
                </div>
                <Button onClick={handleCreateBranch} className="w-full">
                  Crear Sucursal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Configuración global de carta */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Share className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">Configuración Global de Carta</h3>
                <p className="text-sm text-blue-600">Compartir o no la carta entre todas las sucursales</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="global-share" className="text-sm text-blue-900">
                {shareMenuGlobally ? "Carta compartida" : "Cartas independientes"}
              </Label>
              <Switch
                id="global-share"
                checked={shareMenuGlobally}
                onCheckedChange={handleGlobalMenuShare}
              />
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{branches.length}</p>
                <p className="text-xs text-gray-600">Total Sucursales</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{activeBranches}</p>
                <p className="text-xs text-gray-600">Sucursales Activas</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <div>
                <p className="text-2xl font-bold text-blue-600">${totalSales.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Ventas Totales</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <div>
                <p className="text-2xl font-bold text-purple-600">{totalOrders}</p>
                <p className="text-xs text-gray-600">Pedidos Totales</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de sucursales */}
      <div className="space-y-4">
        {branches.map((branch) => (
          <Card key={branch.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
                    <Badge className={`${getStatusColor(branch.status)} border`}>
                      {branch.status}
                    </Badge>
                    {branch.share_menu && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        <Share className="w-3 h-3 mr-1" />
                        Carta compartida
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">Dirección:</span>
                      </div>
                      <p className="text-gray-900">{branch.address}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Encargado:</span>
                      <p className="text-gray-900">{branch.manager}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Ventas Mensuales:</span>
                      <p className="text-gray-900">${branch.monthly_sales.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Pedidos:</span>
                      <p className="text-gray-900">{branch.total_orders}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    <span>📞 {branch.phone}</span>
                    <span>📧 {branch.email}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingBranch(branch)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleMenuShare(branch.id)}
                  >
                    <Share className={`w-4 h-4 ${branch.share_menu ? 'text-blue-600' : 'text-gray-400'}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleBranchStatus(branch.id)}
                  >
                    {branch.status === "activa" ? (
                      <ToggleRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-gray-600" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Editar Sucursal */}
      <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Sucursal</DialogTitle>
          </DialogHeader>
          {editingBranch && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nombre de la Sucursal</Label>
                <Input
                  id="edit-name"
                  value={editingBranch.name}
                  onChange={(e) => setEditingBranch({...editingBranch, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Dirección</Label>
                <Textarea
                  id="edit-address"
                  value={editingBranch.address}
                  onChange={(e) => setEditingBranch({...editingBranch, address: e.target.value})}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="edit-manager">Encargado</Label>
                <Input
                  id="edit-manager"
                  value={editingBranch.manager}
                  onChange={(e) => setEditingBranch({...editingBranch, manager: e.target.value})}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-share-menu"
                  checked={editingBranch.share_menu}
                  onCheckedChange={(checked) => setEditingBranch({...editingBranch, share_menu: checked})}
                />
                <Label htmlFor="edit-share-menu">Compartir carta</Label>
              </div>
              <Button onClick={handleUpdateBranch} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 