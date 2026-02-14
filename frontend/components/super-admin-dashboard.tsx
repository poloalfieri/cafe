"use client"

import { useState, useEffect, useCallback } from "react"
import {
  RefreshCw,
  Plus,
  Store,
  DollarSign,
  Users,
  Settings,
  Pencil,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/auth/supabase-browser"
import { useRouter } from "next/navigation"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Restaurant {
  id: string
  name: string
  created_at: string
  branches_count: number
  active: boolean
  main_branch_id: string | null
  branch_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  manager: string | null
  share_menu: boolean
  monthly_sales_total: number
  total_orders_total: number
  admin_email: string | null
  admin_user_id: string | null
  admin_full_name: string | null
}

interface Stats {
  total_restaurants: number
  active_restaurants: number
  revenue_monthly_total: number
  orders_total: number
}

interface NewBusinessForm {
  restaurantName: string
  branch: {
    name: string
    address: string
    phone: string
    email: string
    manager: string
    shareMenu: boolean
  }
  admin: {
    email: string
    fullName: string
    setPassword: boolean
    password: string
  }
}

const EMPTY_FORM: NewBusinessForm = {
  restaurantName: "",
  branch: {
    name: "",
    address: "",
    phone: "",
    email: "",
    manager: "",
    shareMenu: false,
  },
  admin: { email: "", fullName: "", setPassword: false, password: "" },
}

interface EditForm {
  restaurantId: string
  mainBranchId: string | null
  restaurantName: string
  branch: {
    name: string
    address: string
    phone: string
    email: string
    manager: string
    shareMenu: boolean
  }
  adminUserId: string | null
  adminEmail: string
  adminEmailOriginal: string
}

const EMPTY_STATS: Stats = {
  total_restaurants: 0,
  active_restaurants: 0,
  revenue_monthly_total: 0,
  orders_total: 0,
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SuperAdminDashboard() {
  const { session } = useAuth()
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showCreateBusiness, setShowCreateBusiness] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<NewBusinessForm>(EMPTY_FORM)

  /* ---- helpers ---- */
  const authHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`
    }
    return headers
  }, [session])

  /* ---- fetch restaurants ---- */
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/super-admin/restaurants", {
        headers: authHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error("Error fetching restaurants:", body.error ?? res.statusText)
        return
      }
      const data = await res.json()
      setRestaurants(data.restaurants ?? [])
      setStats(data.stats ?? EMPTY_STATS)
    } catch (err) {
      console.error("Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    if (session?.accessToken) fetchData()
  }, [session?.accessToken, fetchData])

  /* ---- create restaurant ---- */
  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/super-admin/restaurants", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          restaurantName: form.restaurantName,
          branch: form.branch,
          admin: form.admin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? "Error creando negocio")
        return
      }
      setForm(EMPTY_FORM)
      setShowCreateBusiness(false)
      await fetchData()
    } catch (err) {
      setCreateError("Error de red al crear negocio")
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  /* ---- edit restaurant ---- */
  const [editTarget, setEditTarget] = useState<EditForm | null>(null)
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const openEdit = (r: Restaurant) => {
    setEditTarget({
      restaurantId: r.id,
      mainBranchId: r.main_branch_id,
      restaurantName: r.name,
      branch: {
        name: r.branch_name ?? "",
        address: r.address ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        manager: r.manager ?? "",
        shareMenu: r.share_menu ?? false,
      },
      adminUserId: r.admin_user_id,
      adminEmail: r.admin_email ?? "",
      adminEmailOriginal: r.admin_email ?? "",
    })
    setEditError(null)
  }

  const [showEmailConfirm, setShowEmailConfirm] = useState(false)

  const handleEdit = async () => {
    if (!editTarget) return

    // If admin email changed, ask for confirmation first
    const emailChanged =
      editTarget.adminEmail.trim() !== editTarget.adminEmailOriginal.trim() &&
      editTarget.adminEmail.trim().includes("@")

    if (emailChanged && !showEmailConfirm) {
      setShowEmailConfirm(true)
      return
    }

    setEditing(true)
    setEditError(null)
    setShowEmailConfirm(false)
    try {
      const payload: Record<string, unknown> = {
        restaurantId: editTarget.restaurantId,
        restaurantName: editTarget.restaurantName,
        mainBranchId: editTarget.mainBranchId,
        branch: editTarget.branch,
      }

      // Only send email change if it actually changed
      if (emailChanged && editTarget.adminUserId) {
        payload.newAdminEmail = editTarget.adminEmail.trim()
        payload.adminUserId = editTarget.adminUserId
      }

      const res = await fetch("/api/super-admin/restaurants", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error ?? "Error actualizando negocio")
        return
      }
      setEditTarget(null)
      await fetchData()
    } catch (err) {
      setEditError("Error de red al actualizar")
      console.error(err)
    } finally {
      setEditing(false)
    }
  }

  /* ---- logout ---- */
  const handleLogout = useCallback(async () => {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
    } finally {
      sessionStorage.removeItem("supabase_session")
      router.replace("/login?next=/super-admin")
      setLoggingOut(false)
    }
  }, [router])

  /* ---- status badge color ---- */
  const getStatusColor = (active: boolean) =>
    active
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-800 border-gray-200"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Super Admin
                </h1>
                <p className="text-gray-600 text-sm">
                  Panel de administración global
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={fetchData}
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                variant="outline"
                className="px-4 py-2 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? "Saliendo..." : "Salir"}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Store className="w-5 h-5 text-purple-600" />}
              value={stats.total_restaurants}
              label="Total Negocios"
              color="text-purple-600"
            />
            <StatCard
              icon={<Users className="w-5 h-5 text-green-600" />}
              value={stats.active_restaurants}
              label="Negocios Activos"
              color="text-green-600"
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5 text-blue-600" />}
              value={`$${stats.revenue_monthly_total.toLocaleString()}`}
              label="Ingresos Mensuales"
              color="text-blue-600"
            />
            <StatCard
              icon={<span className="text-lg">📊</span>}
              value={stats.orders_total}
              label="Total Pedidos"
              color="text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Content with Tabs */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="negocios" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white border border-gray-200">
            <TabsTrigger
              value="negocios"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white"
            >
              <Store className="w-4 h-4" />
              Negocios ({restaurants.length})
            </TabsTrigger>
            <TabsTrigger
              value="planes"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4" />
              Planes
            </TabsTrigger>
          </TabsList>

          {/* ---- TAB: Negocios ---- */}
          <TabsContent value="negocios">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Gestión de Negocios
              </h2>

              <Dialog
                open={showCreateBusiness}
                onOpenChange={(open) => {
                  setShowCreateBusiness(open)
                  if (!open) {
                    setForm(EMPTY_FORM)
                    setCreateError(null)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Negocio
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Negocio</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5">
                    {/* --- Restaurant --- */}
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Restaurante
                      </legend>
                      <div>
                        <Label htmlFor="restaurantName">Nombre</Label>
                        <Input
                          id="restaurantName"
                          value={form.restaurantName}
                          onChange={(e) =>
                            setForm({ ...form, restaurantName: e.target.value })
                          }
                          placeholder="Ej: Café Central"
                        />
                      </div>
                    </fieldset>

                    {/* --- Branch --- */}
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Sucursal Principal
                      </legend>
                      <div>
                        <Label htmlFor="branchName">Nombre sucursal</Label>
                        <Input
                          id="branchName"
                          value={form.branch.name}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              branch: { ...form.branch, name: e.target.value },
                            })
                          }
                          placeholder="Ej: Casa Central"
                        />
                      </div>
                      <div>
                        <Label htmlFor="branchAddress">Dirección</Label>
                        <Input
                          id="branchAddress"
                          value={form.branch.address}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              branch: {
                                ...form.branch,
                                address: e.target.value,
                              },
                            })
                          }
                          placeholder="Ej: Av. Corrientes 1234"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="branchPhone">Teléfono</Label>
                          <Input
                            id="branchPhone"
                            value={form.branch.phone}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                branch: {
                                  ...form.branch,
                                  phone: e.target.value,
                                },
                              })
                            }
                            placeholder="+54 11 ..."
                          />
                        </div>
                        <div>
                          <Label htmlFor="branchEmail">Email sucursal</Label>
                          <Input
                            id="branchEmail"
                            type="email"
                            value={form.branch.email}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                branch: {
                                  ...form.branch,
                                  email: e.target.value,
                                },
                              })
                            }
                            placeholder="info@cafe.com"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="branchManager">Encargado</Label>
                        <Input
                          id="branchManager"
                          value={form.branch.manager}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              branch: {
                                ...form.branch,
                                manager: e.target.value,
                              },
                            })
                          }
                          placeholder="Nombre del encargado"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="branchShareMenu"
                          checked={form.branch.shareMenu}
                          onCheckedChange={(checked) =>
                            setForm({
                              ...form,
                              branch: { ...form.branch, shareMenu: checked },
                            })
                          }
                        />
                        <Label htmlFor="branchShareMenu">
                          Menú compartido
                        </Label>
                      </div>
                    </fieldset>

                    {/* --- Admin user --- */}
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Cuenta Admin
                      </legend>
                      <div>
                        <Label htmlFor="adminEmail">Email</Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={form.admin.email}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              admin: { ...form.admin, email: e.target.value },
                            })
                          }
                          placeholder="admin@cafe.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="adminFullName">Nombre completo</Label>
                        <Input
                          id="adminFullName"
                          value={form.admin.fullName}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              admin: {
                                ...form.admin,
                                fullName: e.target.value,
                              },
                            })
                          }
                          placeholder="Juan Pérez"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          id="adminSetPassword"
                          checked={form.admin.setPassword}
                          onCheckedChange={(checked) =>
                            setForm({
                              ...form,
                              admin: {
                                ...form.admin,
                                setPassword: checked,
                                password: checked ? form.admin.password : "",
                              },
                            })
                          }
                        />
                        <Label htmlFor="adminSetPassword">
                          Asignar contraseña manualmente
                        </Label>
                      </div>

                      {form.admin.setPassword ? (
                        <div>
                          <Label htmlFor="adminPassword">Contraseña</Label>
                          <Input
                            id="adminPassword"
                            type="text"
                            value={form.admin.password}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                admin: {
                                  ...form.admin,
                                  password: e.target.value,
                                },
                              })
                            }
                            placeholder="Mínimo 6 caracteres"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            El admin usará este email y contraseña para ingresar. Compartile las credenciales.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Se enviará un email de invitación. El admin creará su propia contraseña.
                        </p>
                      )}
                    </fieldset>

                    {createError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                        {createError}
                      </p>
                    )}

                    <Button
                      onClick={handleCreate}
                      disabled={
                        creating ||
                        !form.restaurantName.trim() ||
                        !form.branch.name.trim() ||
                        !form.admin.email.includes("@") ||
                        (form.admin.setPassword && form.admin.password.length < 6)
                      }
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                    >
                      {creating ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        "Crear Negocio"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
                <p className="text-gray-600">Cargando negocios...</p>
              </div>
            ) : restaurants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">
                  No hay negocios registrados todavía.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {restaurants.map((r) => (
                  <Card
                    key={r.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {r.name}
                            </h3>
                            <Badge
                              className={`${getStatusColor(r.active)} border`}
                            >
                              {r.active ? "activo" : "inactivo"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {r.branches_count}{" "}
                              {r.branches_count === 1
                                ? "sucursal"
                                : "sucursales"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Encargado:</span>{" "}
                              {r.manager || "—"}
                            </div>
                            <div>
                              <span className="font-medium">Email sucursal:</span>{" "}
                              {r.email || "—"}
                            </div>
                            <div>
                              <span className="font-medium">Teléfono:</span>{" "}
                              {r.phone || "—"}
                            </div>
                            <div>
                              <span className="font-medium">Dirección:</span>{" "}
                              {r.address || "—"}
                            </div>
                            <div>
                              <span className="font-medium">Ingresos:</span> $
                              {r.monthly_sales_total.toLocaleString()}/mes
                            </div>
                            <div>
                              <span className="font-medium">Login admin:</span>{" "}
                              <span className="text-purple-700 font-medium">{r.admin_email || "—"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(r)}
                            className="gap-1.5"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="hidden sm:inline">Editar</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- TAB: Planes (placeholder) ---- */}
          <TabsContent value="planes">
            <div className="text-center py-16">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                Próximamente
              </h3>
              <p className="text-gray-500 text-sm">
                La gestión de planes estará disponible en una próxima
                actualización.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ---- Edit Modal ---- */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null)
            setEditError(null)
            setShowEmailConfirm(false)
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Negocio</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-5">
              {/* --- Restaurant --- */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Restaurante
                </legend>
                <div>
                  <Label htmlFor="editRestaurantName">Nombre</Label>
                  <Input
                    id="editRestaurantName"
                    value={editTarget.restaurantName}
                    onChange={(e) =>
                      setEditTarget({
                        ...editTarget,
                        restaurantName: e.target.value,
                      })
                    }
                  />
                </div>
              </fieldset>

              {/* --- Branch --- */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Sucursal Principal
                </legend>
                <div>
                  <Label htmlFor="editBranchName">Nombre sucursal</Label>
                  <Input
                    id="editBranchName"
                    value={editTarget.branch.name}
                    onChange={(e) =>
                      setEditTarget({
                        ...editTarget,
                        branch: { ...editTarget.branch, name: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="editBranchAddress">Dirección</Label>
                  <Input
                    id="editBranchAddress"
                    value={editTarget.branch.address}
                    onChange={(e) =>
                      setEditTarget({
                        ...editTarget,
                        branch: {
                          ...editTarget.branch,
                          address: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="editBranchPhone">Teléfono</Label>
                    <Input
                      id="editBranchPhone"
                      value={editTarget.branch.phone}
                      onChange={(e) =>
                        setEditTarget({
                          ...editTarget,
                          branch: {
                            ...editTarget.branch,
                            phone: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="editBranchEmail">Email sucursal</Label>
                    <Input
                      id="editBranchEmail"
                      type="email"
                      value={editTarget.branch.email}
                      onChange={(e) =>
                        setEditTarget({
                          ...editTarget,
                          branch: {
                            ...editTarget.branch,
                            email: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editBranchManager">Encargado</Label>
                  <Input
                    id="editBranchManager"
                    value={editTarget.branch.manager}
                    onChange={(e) =>
                      setEditTarget({
                        ...editTarget,
                        branch: {
                          ...editTarget.branch,
                          manager: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="editBranchShareMenu"
                    checked={editTarget.branch.shareMenu}
                    onCheckedChange={(checked) =>
                      setEditTarget({
                        ...editTarget,
                        branch: { ...editTarget.branch, shareMenu: checked },
                      })
                    }
                  />
                  <Label htmlFor="editBranchShareMenu">Menú compartido</Label>
                </div>
              </fieldset>

              {/* --- Admin auth email --- */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Cuenta de Login (Admin)
                </legend>
                {editTarget.adminUserId ? (
                  <>
                    <div>
                      <Label htmlFor="editAdminEmail">Email de login</Label>
                      <Input
                        id="editAdminEmail"
                        type="email"
                        value={editTarget.adminEmail}
                        onChange={(e) =>
                          setEditTarget({
                            ...editTarget,
                            adminEmail: e.target.value,
                          })
                        }
                      />
                      {editTarget.adminEmail.trim() !== editTarget.adminEmailOriginal.trim() &&
                        editTarget.adminEmail.trim().includes("@") && (
                          <p className="text-xs text-amber-600 mt-1">
                            Se cambiará el email de login de{" "}
                            <span className="font-semibold">{editTarget.adminEmailOriginal}</span>{" "}
                            a{" "}
                            <span className="font-semibold">{editTarget.adminEmail.trim()}</span>.
                            El admin deberá usar el nuevo email para ingresar.
                          </p>
                        )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    No hay usuario admin vinculado a este restaurante.
                  </p>
                )}
              </fieldset>

              {editError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {editError}
                </p>
              )}

              <Button
                onClick={handleEdit}
                disabled={editing || !editTarget.restaurantName.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {editing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Confirm email change AlertDialog ---- */}
      <AlertDialog
        open={showEmailConfirm}
        onOpenChange={(open) => {
          if (!open) setShowEmailConfirm(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar email de login</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Estás por cambiar el email de login del admin de este restaurante:
                </p>
                <p>
                  <span className="font-semibold text-gray-900">{editTarget?.adminEmailOriginal}</span>
                  {" "}→{" "}
                  <span className="font-semibold text-purple-700">{editTarget?.adminEmail.trim()}</span>
                </p>
                <p>
                  El cambio es <span className="font-semibold">inmediato</span>. El admin deberá usar el nuevo email para ingresar a partir de ahora.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEdit}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Small stat card                                                    */
/* ------------------------------------------------------------------ */
function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  )
}
