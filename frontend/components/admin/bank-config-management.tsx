"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CreditCard,
  Save,
  Shield,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Building2,
  GitBranch,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "next-intl"
import { fetcher } from "@/lib/fetcher"

interface BankConfigManagementProps {
  branchId?: string
}

interface MercadoPagoConfig {
  enabled: boolean
  access_token: string
  public_key: string
  webhook_url: string
  webhook_secret: string
}

interface BranchConfigSource {
  type: "self" | "restaurant" | "branch" | "none"
  source_branch_id?: string
  source_branch_name?: string
}

interface EligibleBranch {
  id: string
  name: string
}

type ConfigMode = "self" | "restaurant" | "branch"

export default function BankConfigManagement({ branchId }: BankConfigManagementProps) {
  const t = useTranslations("admin.banking")

  // MP config fields
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig>({
    enabled: false,
    access_token: "",
    public_key: "",
    webhook_url: "",
    webhook_secret: "",
  })

  // API-returned scope (what's currently stored)
  const [scope, setScope] = useState<"branch" | "restaurant" | "none">("none")

  // Source info from API
  const [branchConfigSource, setBranchConfigSource] = useState<BranchConfigSource>({ type: "none" })

  // Eligible branches for "use another branch" picker
  const [eligibleBranches, setEligibleBranches] = useState<EligibleBranch[]>([])

  // User-selected config mode
  const [configMode, setConfigMode] = useState<ConfigMode>("restaurant")

  // Selected source branch (when configMode === "branch")
  const [selectedSourceBranchId, setSelectedSourceBranchId] = useState<string>("")

  // Loading / saving / messages
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Manual payment methods (local state only, not persisted to payment_configs)
  const [manualMethods, setManualMethods] = useState({
    cash: true,
    card: true,
    qr: true,
  })

  // --- Fetch config for a given level ---
  const fetchForLevel = useCallback(
    async (level: "branch" | "restaurant") => {
      const params = new URLSearchParams()
      if (branchId) params.set("branchId", branchId)
      params.set("level", level)
      return fetcher(`/api/admin/payment-config?${params.toString()}`)
    },
    [branchId]
  )

  // --- Initial load ---
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setSaveMessage(null)
      setValidationErrors({})
      try {
        // Fetch with branch level to get full info
        const data = await fetchForLevel("branch")
        setMpConfig(data.mercadopago)
        setScope(data.scope)
        setBranchConfigSource(data.branch_config_source || { type: "none" })
        setEligibleBranches(data.eligible_branches || [])

        // Determine initial configMode from API state
        const sourceType = data.branch_config_source?.type || "none"
        if (sourceType === "branch") {
          setConfigMode("branch")
          setSelectedSourceBranchId(data.branch_config_source.source_branch_id || "")
        } else if (sourceType === "self" || data.scope === "branch") {
          setConfigMode("self")
        } else {
          // "restaurant" or "none" => default to restaurant
          setConfigMode("restaurant")
        }
      } catch (error) {
        console.error("Error fetching payment config:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [branchId, fetchForLevel])

  // --- Refetch config when user changes mode (to load correct data) ---
  const refreshConfigForMode = useCallback(
    async (mode: ConfigMode) => {
      setSaveMessage(null)
      setValidationErrors({})
      try {
        if (mode === "restaurant") {
          const data = await fetchForLevel("restaurant")
          setMpConfig(data.mercadopago)
          setScope(data.scope)
        } else if (mode === "self") {
          const data = await fetchForLevel("branch")
          setMpConfig(data.mercadopago)
          setScope(data.scope)
        }
        // For mode === "branch", we don't load config into the form (read-only)
      } catch (error) {
        console.error("Error refetching config:", error)
      }
    },
    [fetchForLevel]
  )

  // --- Validation ---
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (configMode === "branch") {
      if (!selectedSourceBranchId) {
        errors.source_branch = "Debes seleccionar una sucursal fuente"
      }
      setValidationErrors(errors)
      return Object.keys(errors).length === 0
    }

    // For "self" and "restaurant" modes: validate MP fields
    if (mpConfig.enabled) {
      if (!mpConfig.public_key || mpConfig.public_key.trim() === "") {
        errors.public_key = "Public Key es requerido cuando MercadoPago está habilitado"
      }

      const isMasked = !mpConfig.access_token || /^\*+/.test(mpConfig.access_token)

      if (configMode === "self") {
        // Creating/updating branch-specific config
        const isNewBranchConfig = scope !== "branch" && branchConfigSource.type !== "self"
        if (isNewBranchConfig && isMasked) {
          errors.access_token = "Access Token es requerido para crear configuración de sucursal"
        }
      } else {
        // "restaurant" mode
        if (scope === "none" && isMasked) {
          errors.access_token = "Access Token es requerido para crear la configuración"
        }
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // --- Save ---
  const handleSave = async () => {
    if (!validateForm()) {
      setSaveMessage({ type: "error", text: "Por favor corrige los errores antes de guardar" })
      return
    }

    setSaving(true)
    setSaveMessage(null)
    try {
      if (configMode === "branch") {
        // Save "use another branch" mode
        await fetcher("/api/admin/payment-config", {
          method: "POST",
          body: JSON.stringify({
            branchId: branchId || null,
            source_mode: "branch",
            source_branch_id: selectedSourceBranchId,
          }),
        })
      } else {
        // Save self or restaurant mode
        const saveScope = configMode === "self" ? "branch" : "restaurant"
        await fetcher("/api/admin/payment-config", {
          method: "POST",
          body: JSON.stringify({
            branchId: branchId || null,
            scope: saveScope,
            source_mode: configMode,
            mercadopago: {
              enabled: mpConfig.enabled,
              access_token: mpConfig.access_token,
              public_key: mpConfig.public_key,
              webhook_url: mpConfig.webhook_url,
              webhook_secret: mpConfig.webhook_secret,
            },
          }),
        })
      }
      setSaveMessage({ type: "success", text: "Configuración guardada correctamente" })

      // Refetch to see updated state
      const data = await fetchForLevel("branch")
      setMpConfig(data.mercadopago)
      setScope(data.scope)
      setBranchConfigSource(data.branch_config_source || { type: "none" })
      setEligibleBranches(data.eligible_branches || [])
    } catch (error: any) {
      setSaveMessage({
        type: "error",
        text: error?.data?.error || error?.message || "Error al guardar",
      })
    } finally {
      setSaving(false)
    }
  }

  // --- Handle mode change ---
  const handleModeChange = async (mode: ConfigMode) => {
    setConfigMode(mode)
    setSaveMessage(null)
    setValidationErrors({})
    if (mode !== "branch") {
      await refreshConfigForMode(mode)
    }
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // --- Scope badge ---
  const getScopeBadge = () => {
    if (!branchId) return null

    if (branchConfigSource.type === "branch") {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
          <GitBranch className="w-3 h-3 mr-1" />
          Usa otra sucursal
        </Badge>
      )
    }

    switch (branchConfigSource.type) {
      case "self":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Configuración propia
          </Badge>
        )
      case "restaurant":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Globe className="w-3 h-3 mr-1" />
            Heredada del restaurante
          </Badge>
        )
      case "none":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            No configurado
          </Badge>
        )
    }
  }

  const isReadOnly = configMode === "branch"

  return (
    <div className="space-y-6">
      {/* MercadoPago Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">MP</span>
              </div>
              <div>
                <CardTitle>MercadoPago</CardTitle>
                <p className="text-sm text-gray-600">{t("payments.mpSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getScopeBadge()}
              <Badge
                className={
                  mpConfig.enabled
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                {mpConfig.enabled ? t("status.active") : t("status.inactive")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 3-way mode selector (only when viewing a branch) */}
          {branchId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Fuente de la cuenta MercadoPago
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {/* Option: Restaurant (global) */}
                <label
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    configMode === "restaurant"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="config-mode"
                    value="restaurant"
                    checked={configMode === "restaurant"}
                    onChange={() => handleModeChange("restaurant")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium">Restaurante (global)</span>
                    <p className="text-xs text-gray-500">
                      Misma cuenta para todas las sucursales
                    </p>
                  </div>
                </label>

                {/* Option: This branch (self) */}
                <label
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    configMode === "self"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="config-mode"
                    value="self"
                    checked={configMode === "self"}
                    onChange={() => handleModeChange("self")}
                    className="w-4 h-4 text-green-600"
                  />
                  <Building2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium">Esta sucursal</span>
                    <p className="text-xs text-gray-500">
                      Cuenta propia de MercadoPago para esta sucursal
                    </p>
                  </div>
                </label>

                {/* Option: Another branch */}
                <label
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    configMode === "branch"
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${eligibleBranches.length === 0 ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="config-mode"
                    value="branch"
                    checked={configMode === "branch"}
                    onChange={() => handleModeChange("branch")}
                    className="w-4 h-4 text-purple-600"
                    disabled={eligibleBranches.length === 0}
                  />
                  <GitBranch className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium">Otra sucursal</span>
                    <p className="text-xs text-gray-500">
                      {eligibleBranches.length === 0
                        ? "No hay sucursales con cuenta propia disponible"
                        : "Usar la cuenta de MercadoPago de otra sucursal"}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Branch picker (when configMode === "branch") */}
          {branchId && configMode === "branch" && (
            <div className="space-y-3">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <GitBranch className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900 mb-1">
                      Usar cuenta de otra sucursal
                    </p>
                    <p className="text-sm text-purple-700">
                      Esta sucursal usará las credenciales de MercadoPago de la sucursal seleccionada. No necesitas ingresar credenciales aquí.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="source-branch" className="flex items-center gap-1">
                  Sucursal fuente
                  <span className="text-red-500">*</span>
                </Label>
                <select
                  id="source-branch"
                  value={selectedSourceBranchId}
                  onChange={(e) => {
                    setSelectedSourceBranchId(e.target.value)
                    setValidationErrors((prev) => ({ ...prev, source_branch: "" }))
                  }}
                  className={`w-full mt-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    validationErrors.source_branch ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="">Seleccionar sucursal...</option>
                  {eligibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {validationErrors.source_branch && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.source_branch}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Info banner for restaurant mode */}
          {branchId && configMode === "restaurant" && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Configuración global del restaurante
                  </p>
                  <p className="text-sm text-blue-700">
                    Los cambios que realices aquí aplicarán a todas las sucursales que usen la configuración global.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning for creating branch override */}
          {branchId && configMode === "self" && branchConfigSource.type !== "self" && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    Crear configuración específica para esta sucursal
                  </p>
                  <p className="text-sm text-amber-700">
                    Debes completar las credenciales de MercadoPago para esta sucursal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MP Config Form (hidden when using another branch's config) */}
          {!isReadOnly && (
            <>
              {/* Enabled toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="mp-enabled"
                  checked={mpConfig.enabled}
                  onChange={(e) =>
                    setMpConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 rounded"
                />
                <Label htmlFor="mp-enabled" className="cursor-pointer font-medium">
                  Habilitar MercadoPago
                </Label>
              </div>

              {/* Config fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mp-access-token" className="flex items-center gap-1">
                    Access Token
                    {mpConfig.enabled && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="mp-access-token"
                    type="password"
                    value={mpConfig.access_token}
                    onChange={(e) => {
                      setMpConfig((prev) => ({ ...prev, access_token: e.target.value }))
                      setValidationErrors((prev) => ({ ...prev, access_token: "" }))
                    }}
                    placeholder="APP_USR-..."
                    className={validationErrors.access_token ? "border-red-500" : ""}
                  />
                  {validationErrors.access_token ? (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.access_token}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      {mpConfig.access_token && /^\*+/.test(mpConfig.access_token)
                        ? "El token está guardado. Dejar vacío para conservarlo."
                        : "Requerido si MercadoPago está habilitado."}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="mp-public-key" className="flex items-center gap-1">
                    Public Key
                    {mpConfig.enabled && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="mp-public-key"
                    value={mpConfig.public_key}
                    onChange={(e) => {
                      setMpConfig((prev) => ({ ...prev, public_key: e.target.value }))
                      setValidationErrors((prev) => ({ ...prev, public_key: "" }))
                    }}
                    placeholder="APP_USR-..."
                    className={validationErrors.public_key ? "border-red-500" : ""}
                  />
                  {validationErrors.public_key && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.public_key}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="mp-webhook-url">Webhook URL</Label>
                  <Input
                    id="mp-webhook-url"
                    value={mpConfig.webhook_url}
                    onChange={(e) =>
                      setMpConfig((prev) => ({ ...prev, webhook_url: e.target.value }))
                    }
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL donde MercadoPago enviará notificaciones de pago.
                  </p>
                </div>

                <div>
                  <Label htmlFor="mp-webhook-secret">Webhook Secret</Label>
                  <Input
                    id="mp-webhook-secret"
                    type="password"
                    value={mpConfig.webhook_secret}
                    onChange={(e) =>
                      setMpConfig((prev) => ({ ...prev, webhook_secret: e.target.value }))
                    }
                    placeholder="Dejar vacío para conservar el existente"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recomendado para validar webhooks. Dejar vacío para conservar el existente.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Save message */}
          {saveMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                saveMessage.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {saveMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {saveMessage.text}
            </div>
          )}

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? t("actions.saving") : t("actions.saveAccount")}
          </Button>
        </CardContent>
      </Card>

      {/* Manual Methods (local state, preserved as-is) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <div>
              <CardTitle>{t("payments.manualTitle")}</CardTitle>
              <p className="text-sm text-gray-600">{t("payments.manualSubtitle")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cash"
                checked={manualMethods.cash}
                onChange={(e) =>
                  setManualMethods((prev) => ({ ...prev, cash: e.target.checked }))
                }
                className="rounded"
              />
              <Label htmlFor="cash">{t("payments.cash")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="card"
                checked={manualMethods.card}
                onChange={(e) =>
                  setManualMethods((prev) => ({ ...prev, card: e.target.checked }))
                }
                className="rounded"
              />
              <Label htmlFor="card">{t("payments.card")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="qr"
                checked={manualMethods.qr}
                onChange={(e) =>
                  setManualMethods((prev) => ({ ...prev, qr: e.target.checked }))
                }
                className="rounded"
              />
              <Label htmlFor="qr">{t("payments.qr")}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">{t("security.title")}</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>{t("security.items.storeKeys")}</li>
              <li>{t("security.items.bankData")}</li>
              <li>{t("security.items.ownerOnly")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
