"use client"

import { getTenantApiBase } from "@/lib/apiClient"
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
import { useTranslations } from "next-intl"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"

interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  manager?: string | null
  active: boolean
  share_menu?: boolean | null
  created_at?: string
  monthly_sales?: number | null
  total_orders?: number | null
}

export default function BranchesManagement() {
  const t = useTranslations("admin.branches")
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [shareMenuGlobally, setShareMenuGlobally] = useState(true)
  const backendUrl = getTenantApiBase()

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
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches`, {
        headers: {
          ...authHeader,
        },
      })
      if (!response.ok) {
        throw new Error("No se pudieron cargar las sucursales")
      }
      const data = await response.json()
      const list = Array.isArray(data?.branches) ? data.branches : []
      setBranches(list)
      if (list.length > 0) {
        const allShared = list.every((b: Branch) => b.share_menu !== false)
        setShareMenuGlobally(allShared)
      }
    } catch (error) {
      console.error(t("errors.fetchBranches"), error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBranch = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          ...branchForm,
          active: true,
        }),
      })
      if (!response.ok) {
        throw new Error("No se pudo crear la sucursal")
      }
      const data = await response.json()
      const newBranch: Branch = data.branch
      setBranches([...branches, newBranch])
      setBranchForm({ name: "", address: "", phone: "", email: "", manager: "", share_menu: true })
      setShowCreateBranch(false)
    } catch (error) {
      console.error(t("errors.createBranch"), error)
    }
  }

  const handleUpdateBranch = async () => {
    if (!editingBranch) return
    
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches/${editingBranch.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          name: editingBranch.name,
          address: editingBranch.address,
          phone: editingBranch.phone,
          email: editingBranch.email,
          manager: editingBranch.manager,
          share_menu: editingBranch.share_menu,
          active: editingBranch.active,
        }),
      })
      if (!response.ok) {
        throw new Error("No se pudo actualizar la sucursal")
      }
      const data = await response.json()
      setBranches(branches.map(branch => 
        branch.id === editingBranch.id ? data.branch : branch
      ))
      setEditingBranch(null)
    } catch (error) {
      console.error(t("errors.updateBranch"), error)
    }
  }

  const handleToggleBranchStatus = async (branchId: string) => {
    try {
      const current = branches.find(b => b.id === branchId)
      if (!current) return
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches/${branchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ active: !current.active }),
      })
      if (!response.ok) {
        throw new Error("No se pudo actualizar estado")
      }
      const data = await response.json()
      setBranches(branches.map(branch => 
        branch.id === branchId ? data.branch : branch
      ))
    } catch (error) {
      console.error(t("errors.toggleStatus"), error)
    }
  }

  const handleToggleMenuShare = async (branchId: string) => {
    try {
      const current = branches.find(b => b.id === branchId)
      if (!current) return
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches/${branchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ share_menu: !current.share_menu }),
      })
      if (!response.ok) {
        throw new Error("No se pudo actualizar compartir carta")
      }
      const data = await response.json()
      setBranches(branches.map(branch => 
        branch.id === branchId ? data.branch : branch
      ))
    } catch (error) {
      console.error(t("errors.toggleShare"), error)
    }
  }

  const handleGlobalMenuShare = async () => {
    try {
      const target = !shareMenuGlobally
      const authHeader = await getClientAuthHeaderAsync()
      await Promise.all(
        branches.map(branch =>
          fetch(`${backendUrl}/branches/${branch.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...authHeader,
            },
            body: JSON.stringify({ share_menu: target }),
          })
        )
      )
      setShareMenuGlobally(target)
      setBranches(branches.map(branch => ({ ...branch, share_menu: target })))
    } catch (error) {
      console.error(t("errors.toggleGlobalShare"), error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "activa": return "bg-green-100 text-green-800 border-green-200"
      case "inactiva": return "bg-gray-100 text-gray-800 border-gray-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const activeBranches = branches.filter(b => b.active).length
  const totalSales = branches.reduce((sum, branch) => sum + (branch.monthly_sales || 0), 0)
  const totalOrders = branches.reduce((sum, branch) => sum + (branch.total_orders || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header y configuración global */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t("header.title")}</h2>
            <p className="text-sm text-gray-600">{t("header.subtitle")}</p>
          </div>
          <Dialog open={showCreateBranch} onOpenChange={setShowCreateBranch}>
            <DialogTrigger asChild>
              <Button className="bg-gray-900 hover:bg-gray-800 text-white self-start sm:self-auto">
                <Plus className="w-4 h-4 mr-2" />
                {t("actions.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("dialog.createTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("form.name")}</Label>
                  <Input
                    id="name"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({...branchForm, name: e.target.value})}
                    placeholder={t("form.namePlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="address">{t("form.address")}</Label>
                  <Textarea
                    id="address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({...branchForm, address: e.target.value})}
                    placeholder={t("form.addressPlaceholder")}
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t("form.phone")}</Label>
                  <Input
                    id="phone"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({...branchForm, phone: e.target.value})}
                    placeholder={t("form.phonePlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t("form.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({...branchForm, email: e.target.value})}
                    placeholder={t("form.emailPlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="manager">{t("form.manager")}</Label>
                  <Input
                    id="manager"
                    value={branchForm.manager}
                    onChange={(e) => setBranchForm({...branchForm, manager: e.target.value})}
                    placeholder={t("form.managerPlaceholder")}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="share_menu"
                    checked={branchForm.share_menu}
                    onCheckedChange={(checked) => setBranchForm({...branchForm, share_menu: checked})}
                  />
                  <Label htmlFor="share_menu">{t("form.shareMenu")}</Label>
                </div>
                <Button onClick={handleCreateBranch} className="w-full">
                  {t("actions.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Configuración global de carta */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Share className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 text-sm sm:text-base">{t("globalMenu.title")}</h3>
                <p className="text-xs sm:text-sm text-blue-600">{t("globalMenu.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Label htmlFor="global-share" className="text-xs sm:text-sm text-blue-900">
                {shareMenuGlobally ? t("globalMenu.shared") : t("globalMenu.independent")}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{branches.length}</p>
                <p className="text-[10px] sm:text-xs text-gray-600">{t("stats.total")}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-green-600">{activeBranches}</p>
                <p className="text-[10px] sm:text-xs text-gray-600">{t("stats.active")}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">💰</span>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-blue-600 truncate">${totalSales.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-gray-600">{t("stats.sales")}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">📊</span>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{totalOrders}</p>
                <p className="text-[10px] sm:text-xs text-gray-600">{t("stats.orders")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de sucursales */}
      <div className="space-y-4">
        {branches.map((branch) => (
          <Card key={branch.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{branch.name}</h3>
                    <Badge className={`${getStatusColor(branch.active ? "activa" : "inactiva")} border`}>
                      {branch.active ? t("status.active") : t("status.inactive")}
                    </Badge>
                    {branch.share_menu && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        <Share className="w-3 h-3 mr-1" />
                        {t("status.sharedMenu")}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">{t("table.address")}</span>
                      </div>
                      <p className="text-gray-900 text-xs sm:text-sm">{branch.address || "-"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">{t("table.manager")}</span>
                      <p className="text-gray-900 text-xs sm:text-sm">{branch.manager || "-"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">{t("table.monthlySales")}</span>
                      <p className="text-gray-900 text-xs sm:text-sm truncate">${(branch.monthly_sales || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">{t("table.orders")}</span>
                      <p className="text-gray-900 text-xs sm:text-sm">{branch.total_orders || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs sm:text-sm text-gray-600">
                    <span>📞 {branch.phone || "-"}</span>
                    <span>📧 {branch.email || "-"}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-start">
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
                    {branch.active ? (
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
            <DialogTitle>{t("dialog.editTitle")}</DialogTitle>
          </DialogHeader>
          {editingBranch && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">{t("form.name")}</Label>
                <Input
                  id="edit-name"
                  value={editingBranch.name}
                  onChange={(e) => setEditingBranch({...editingBranch, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-address">{t("form.address")}</Label>
                  <Textarea
                    id="edit-address"
                  value={editingBranch.address ?? ""}
                  onChange={(e) => setEditingBranch({...editingBranch, address: e.target.value})}
                    rows={2}
                  />
              </div>
              <div>
                <Label htmlFor="edit-manager">{t("form.manager")}</Label>
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
                <Label htmlFor="edit-share-menu">{t("form.shareMenuShort")}</Label>
              </div>
              <Button onClick={handleUpdateBranch} className="w-full">
                {t("actions.save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 
