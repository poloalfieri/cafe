"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Plus, KeyRound, Users, UserCheck, Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useTranslations } from "next-intl"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useToast } from "@/hooks/use-toast"

interface Cashier {
  id: string
  email: string
  branch_id: string | null
  created_at: string
  last_sign_in_at: string | null
}

interface Branch {
  id: string
  name: string
}

interface CashierManagementProps {
  branchId?: string
}

export default function CashierManagement({ branchId }: CashierManagementProps) {
  const t = useTranslations("admin.cashiers")
  const { toast } = useToast()
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [passwordCashierId, setPasswordCashierId] = useState<string | null>(null)
  const [emailEditCashier, setEmailEditCashier] = useState<Cashier | null>(null)
  const [deleteCashier, setDeleteCashier] = useState<Cashier | null>(null)
  const [creating, setCreating] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const backendUrl = getTenantApiBase()

  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    branchId: "",
  })

  const [newPassword, setNewPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")

  useEffect(() => {
    fetchBranches()
    fetchCashiers()
  }, [])

  const fetchBranches = async () => {
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/branches`, {
        headers: { ...authHeader },
      })
      if (!response.ok) return
      const data = await response.json()
      const list = Array.isArray(data?.branches) ? data.branches : []
      setBranches(list)
    } catch (_) {
      // ignore
    }
  }

  const fetchCashiers = async () => {
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch("/api/admin/list-cashiers", {
        headers: { ...authHeader },
      })
      if (!response.ok) {
        throw new Error("Failed to load cashiers")
      }
      const data = await response.json()
      setCashiers(data.cashiers || [])
    } catch (error) {
      console.error(t("errors.fetchCashiers"), error)
      toast({
        title: t("toast.errorTitle"),
        description: t("toast.loadError"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.branchId) return
    setCreating(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch("/api/admin/create-cashier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          branchId: createForm.branchId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error creating cashier")
      }
      toast({
        title: t("toast.successTitle"),
        description: t("toast.created"),
      })
      setCreateForm({ email: "", password: "", branchId: "" })
      setShowCreateDialog(false)
      fetchCashiers()
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error?.message || t("toast.createError"),
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordCashierId || !newPassword) return
    setChangingPassword(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch("/api/admin/update-cashier-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          userId: passwordCashierId,
          newPassword,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error changing password")
      }
      toast({
        title: t("toast.successTitle"),
        description: t("toast.passwordChanged"),
      })
      setNewPassword("")
      setPasswordCashierId(null)
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error?.message || t("toast.passwordError"),
        variant: "destructive",
      })
    } finally {
      setChangingPassword(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!emailEditCashier || !newEmail) return
    setChangingEmail(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch("/api/admin/update-cashier-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          userId: emailEditCashier.id,
          newEmail,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error changing email")
      }
      toast({
        title: t("toast.successTitle"),
        description: t("toast.emailChanged"),
      })
      setNewEmail("")
      setEmailEditCashier(null)
      fetchCashiers()
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error?.message || t("toast.emailError"),
        variant: "destructive",
      })
    } finally {
      setChangingEmail(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCashier) return
    setDeleting(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch("/api/admin/delete-cashier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          userId: deleteCashier.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error deleting cashier")
      }
      toast({
        title: t("toast.successTitle"),
        description: t("toast.deleted"),
      })
      setDeleteCashier(null)
      fetchCashiers()
    } catch (error: any) {
      toast({
        title: t("toast.errorTitle"),
        description: error?.message || t("toast.deleteError"),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return t("table.unknownBranch")
    const branch = branches.find((b) => b.id === branchId)
    return branch?.name || t("table.unknownBranch")
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t("table.never")
    return new Date(dateStr).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const recentlyActive = cashiers.filter((c) => {
    if (!c.last_sign_in_at) return false
    const diff = Date.now() - new Date(c.last_sign_in_at).getTime()
    return diff < 7 * 24 * 60 * 60 * 1000 // 7 days
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t("header.title")}</h2>
            <p className="text-sm text-gray-600">{t("header.subtitle")}</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gray-900 hover:bg-gray-800 text-white self-start sm:self-auto">
                <Plus className="w-4 h-4 mr-2" />
                {t("actions.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("dialog.createTitle")}</DialogTitle>
                <DialogDescription>{t("dialog.createDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cashier-email">{t("form.email")}</Label>
                  <Input
                    id="cashier-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder={t("form.emailPlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="cashier-password">{t("form.password")}</Label>
                  <Input
                    id="cashier-password"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder={t("form.passwordPlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="cashier-branch">{t("form.branch")}</Label>
                  <select
                    id="cashier-branch"
                    value={createForm.branchId}
                    onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{t("form.branchPlaceholder")}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {branches.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">{t("errors.noBranches")}</p>
                  )}
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !createForm.email || !createForm.password || !createForm.branchId}
                  className="w-full"
                >
                  {creating ? t("actions.creating") : t("actions.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{cashiers.length}</p>
                <p className="text-xs text-gray-600">{t("stats.total")}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{recentlyActive}</p>
                <p className="text-xs text-gray-600">{t("stats.active")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cashier List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : cashiers.length === 0 ? (
        <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t("empty.title")}</h3>
          <p className="text-gray-500">{t("empty.subtitle")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cashiers.map((cashier) => (
            <Card key={cashier.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t("table.email")}</p>
                      <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{cashier.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t("table.branch")}</p>
                      <p className="text-xs sm:text-sm text-gray-900">{getBranchName(cashier.branch_id)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t("table.created")}</p>
                      <p className="text-xs sm:text-sm text-gray-900">{formatDate(cashier.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t("table.lastLogin")}</p>
                      <p className="text-xs sm:text-sm text-gray-900">{formatDate(cashier.last_sign_in_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto sm:ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmailEditCashier(cashier)
                        setNewEmail(cashier.email || "")
                      }}
                      title={t("actions.changeEmail")}
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPasswordCashierId(cashier.id)
                        setNewPassword("")
                      }}
                      title={t("actions.changePassword")}
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteCashier(cashier)}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                      title={t("actions.delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Change Password Dialog */}
      <Dialog open={!!passwordCashierId} onOpenChange={(open) => !open && setPasswordCashierId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.passwordTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.passwordDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">{t("form.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("form.newPasswordPlaceholder")}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPasswordCashierId(null)}
                className="flex-1"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || newPassword.length < 6}
                className="flex-1"
              >
                {changingPassword ? t("actions.changing") : t("actions.changePassword")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Email Dialog */}
      <Dialog open={!!emailEditCashier} onOpenChange={(open) => !open && setEmailEditCashier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.emailTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.emailDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-email">{t("form.newEmail")}</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("form.newEmailPlaceholder")}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEmailEditCashier(null)}
                className="flex-1"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                onClick={handleChangeEmail}
                disabled={changingEmail || !newEmail.includes("@")}
                className="flex-1"
              >
                {changingEmail ? t("actions.changingEmail") : t("actions.changeEmail")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCashier} onOpenChange={(open) => !open && setDeleteCashier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialog.deleteDescription", { email: deleteCashier?.email || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteCashier(null)}
              className="flex-1"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
              className="flex-1"
            >
              {deleting ? t("actions.deleting") : t("actions.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
