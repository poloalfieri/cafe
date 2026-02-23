"use client"

import { useEffect, useMemo, useState } from "react"
import { getTenantApiBase } from "@/lib/apiClient"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

interface AfipBranch {
  id: string
  name: string
  afip_pto_vta: number | null
  afip_share_pto_vta_branch_id: string | null
  effective_afip_pto_vta?: number | null
}

interface AfipConfig {
  configured: boolean
  enabled: boolean
  cuit: string | null
  iva_condition: "MONOTRIBUTO" | "RI" | null
  environment: "homo" | "prod"
  has_certificate: boolean
  has_private_key: boolean
  ready: boolean
  branches: AfipBranch[]
}

interface BranchDraft {
  ptoVta: string
  shareBranchId: string
}

const EMPTY_CONFIG: AfipConfig = {
  configured: false,
  enabled: false,
  cuit: "",
  iva_condition: "MONOTRIBUTO",
  environment: "homo",
  has_certificate: false,
  has_private_key: false,
  ready: false,
  branches: [],
}

export default function AfipManagement() {
  const backendUrl = getTenantApiBase()

  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [config, setConfig] = useState<AfipConfig>(EMPTY_CONFIG)
  const [branchDrafts, setBranchDrafts] = useState<Record<string, BranchDraft>>({})

  const [cuit, setCuit] = useState("")
  const [ivaCondition, setIvaCondition] = useState<"MONOTRIBUTO" | "RI">("MONOTRIBUTO")
  const [environment, setEnvironment] = useState<"homo" | "prod">("homo")
  const [enabled, setEnabled] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [keyPassphrase, setKeyPassphrase] = useState("")
  const [certPemText, setCertPemText] = useState("")
  const [keyPemText, setKeyPemText] = useState("")

  const branchesById = useMemo(() => {
    const map = new Map<string, AfipBranch>()
    for (const branch of config.branches || []) {
      map.set(branch.id, branch)
    }
    return map
  }, [config.branches])

  const resetFeedback = () => {
    setError(null)
    setSuccess(null)
  }

  const hydrateForm = (next: AfipConfig) => {
    setCuit(next.cuit || "")
    setIvaCondition((next.iva_condition || "MONOTRIBUTO") as "MONOTRIBUTO" | "RI")
    setEnvironment((next.environment || "homo") as "homo" | "prod")
    setEnabled(Boolean(next.enabled))
    setCertFile(null)
    setKeyFile(null)
    setKeyPassphrase("")
    setCertPemText("")
    setKeyPemText("")

    const drafts: Record<string, BranchDraft> = {}
    for (const branch of next.branches || []) {
      drafts[branch.id] = {
        ptoVta:
          branch.afip_pto_vta !== null && branch.afip_pto_vta !== undefined
            ? String(branch.afip_pto_vta)
            : "",
        shareBranchId: branch.afip_share_pto_vta_branch_id || "",
      }
    }
    setBranchDrafts(drafts)
  }

  const fetchConfig = async () => {
    setLoading(true)
    resetFeedback()
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/admin/afip/config`, {
        headers: {
          ...authHeader,
        },
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "No se pudo cargar AFIP")
      }

      const nextConfig = { ...EMPTY_CONFIG, ...data } as AfipConfig
      setConfig(nextConfig)
      hydrateForm(nextConfig)
    } catch (fetchError: any) {
      setError(fetchError?.message || "No se pudo cargar AFIP")
      setConfig(EMPTY_CONFIG)
      hydrateForm(EMPTY_CONFIG)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchConfig()
  }, [])

  const handleSaveConfig = async () => {
    resetFeedback()
    try {
      setSavingConfig(true)
      const authHeader = await getClientAuthHeaderAsync()

      const formData = new FormData()
      formData.append("cuit", cuit.trim())
      formData.append("iva_condition", ivaCondition)
      formData.append("environment", environment)
      formData.append("enabled", String(enabled))
      if (keyPassphrase.trim()) {
        formData.append("key_passphrase", keyPassphrase.trim())
      }
      if (certFile) {
        formData.append("cert_file", certFile)
      }
      if (keyFile) {
        formData.append("key_file", keyFile)
      }
      if (certPemText.trim()) {
        formData.append("cert_pem", certPemText.trim())
      }
      if (keyPemText.trim()) {
        formData.append("key_pem", keyPemText.trim())
      }

      const response = await fetch(`${backendUrl}/admin/afip/config`, {
        method: "PUT",
        headers: {
          ...authHeader,
        },
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "No se pudo guardar configuración AFIP")
      }

      const nextConfig = { ...EMPTY_CONFIG, ...data } as AfipConfig
      setConfig(nextConfig)
      hydrateForm(nextConfig)
      setSuccess("Configuración AFIP guardada")
    } catch (saveError: any) {
      setError(saveError?.message || "No se pudo guardar configuración AFIP")
    } finally {
      setSavingConfig(false)
    }
  }

  const handleTestConnection = async () => {
    resetFeedback()
    try {
      setTestingConnection(true)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/admin/afip/test-connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({}),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Falló test de conexión AFIP")
      }
      setSuccess(
        `Conexión OK (ambiente: ${data?.environment || "-"}, pto_vta: ${data?.pto_vta || "-"})`,
      )
    } catch (testError: any) {
      setError(testError?.message || "Falló test de conexión AFIP")
    } finally {
      setTestingConnection(false)
    }
  }

  const updateBranchDraft = (branchId: string, patch: Partial<BranchDraft>) => {
    setBranchDrafts((prev) => {
      const current = prev[branchId] || { ptoVta: "", shareBranchId: "" }
      return {
        ...prev,
        [branchId]: { ...current, ...patch },
      }
    })
  }

  const saveBranchDraft = async (branchId: string) => {
    resetFeedback()
    const draft = branchDrafts[branchId] || { ptoVta: "", shareBranchId: "" }
    const payload =
      draft.shareBranchId.trim() !== ""
        ? { afip_share_pto_vta_branch_id: draft.shareBranchId.trim() }
        : draft.ptoVta.trim() !== ""
          ? { afip_pto_vta: Number(draft.ptoVta.trim()) }
          : { afip_pto_vta: null, afip_share_pto_vta_branch_id: null }

    try {
      setSavingBranchId(branchId)
      const authHeader = await getClientAuthHeaderAsync()
      const response = await fetch(`${backendUrl}/admin/branches/${branchId}/afip-pto-vta`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "No se pudo actualizar sucursal")
      }
      setSuccess("Sucursal AFIP actualizada")
      await fetchConfig()
    } catch (branchError: any) {
      setError(branchError?.message || "No se pudo actualizar sucursal")
    } finally {
      setSavingBranchId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facturación AFIP/ARCA</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Facturación AFIP/ARCA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="afip-cuit">CUIT</Label>
              <Input
                id="afip-cuit"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="20123456789"
                maxLength={11}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="afip-iva">Condición IVA</Label>
              <select
                id="afip-iva"
                value={ivaCondition}
                onChange={(e) => setIvaCondition(e.target.value as "MONOTRIBUTO" | "RI")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="MONOTRIBUTO">MONOTRIBUTO</option>
                <option value="RI">RI</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="afip-env">Ambiente</Label>
              <select
                id="afip-env"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "homo" | "prod")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="homo">Homologación</option>
                <option value="prod">Producción</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="afip-enabled">Habilitado</Label>
              <div className="h-10 flex items-center">
                <Switch id="afip-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="afip-cert-file">Certificado PEM/CRT</Label>
              <Input
                id="afip-cert-file"
                type="file"
                accept=".pem,.crt,.cer,text/plain"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="afip-key-file">Clave privada PEM/KEY</Label>
              <Input
                id="afip-key-file"
                type="file"
                accept=".pem,.key,text/plain"
                onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="afip-key-pass">Passphrase clave (opcional)</Label>
            <Input
              id="afip-key-pass"
              type="password"
              value={keyPassphrase}
              onChange={(e) => setKeyPassphrase(e.target.value)}
              placeholder="Solo si tu clave está protegida"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="afip-cert-pem">Certificado PEM (texto opcional)</Label>
              <Textarea
                id="afip-cert-pem"
                rows={5}
                value={certPemText}
                onChange={(e) => setCertPemText(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="afip-key-pem">Clave privada PEM (texto opcional)</Label>
              <Textarea
                id="afip-key-pem"
                rows={5}
                value={keyPemText}
                onChange={(e) => setKeyPemText(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----"
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm space-y-1">
            <p>
              Estado:{" "}
              <span className={config.ready ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
                {config.ready ? "Listo para facturar" : "Pendiente de configuración"}
              </span>
            </p>
            <p>Certificado cargado: {config.has_certificate ? "Sí" : "No"}</p>
            <p>Clave cargada: {config.has_private_key ? "Sí" : "No"}</p>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {success ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? "Guardando..." : "Guardar configuración"}
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testingConnection}>
              {testingConnection ? "Probando..." : "Probar conexión"}
            </Button>
            <Button variant="ghost" onClick={fetchConfig}>
              Recargar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Punto de venta por sucursal</CardTitle>
        </CardHeader>
        <CardContent>
          {config.branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sucursales disponibles.</p>
          ) : (
            <div className="space-y-4">
              {config.branches.map((branch) => {
                const draft = branchDrafts[branch.id] || { ptoVta: "", shareBranchId: "" }
                const isSaving = savingBranchId === branch.id
                const effectivePto = branch.effective_afip_pto_vta
                return (
                  <div key={branch.id} className="rounded-md border border-border p-3 space-y-3">
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Efectivo: {effectivePto ? `pto_vta ${effectivePto}` : "sin configurar"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Punto de venta propio</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Ej: 1"
                          value={draft.ptoVta}
                          onChange={(e) => {
                            const next = e.target.value
                            updateBranchDraft(branch.id, {
                              ptoVta: next,
                              shareBranchId: next.trim() !== "" ? "" : draft.shareBranchId,
                            })
                          }}
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <Label>Compartir pto_vta de otra sucursal</Label>
                        <select
                          value={draft.shareBranchId}
                          onChange={(e) =>
                            updateBranchDraft(branch.id, {
                              shareBranchId: e.target.value,
                              ptoVta: e.target.value ? "" : draft.ptoVta,
                            })
                          }
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">No compartir</option>
                          {config.branches
                            .filter((candidate) => candidate.id !== branch.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {draft.shareBranchId ? (
                      <p className="text-xs text-muted-foreground">
                        Comparte desde: {branchesById.get(draft.shareBranchId)?.name || "Sucursal seleccionada"}
                      </p>
                    ) : null}

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveBranchDraft(branch.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? "Guardando..." : "Guardar sucursal"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
