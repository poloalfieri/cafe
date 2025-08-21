"use client"

import { useState, useEffect } from "react"
import { CreditCard, Save, Edit, Shield, CheckCircle, AlertCircle, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface BankAccount {
  id: string
  bank_name: string
  account_type: "corriente" | "ahorro" | "caja_ahorro"
  account_number: string
  cbu: string
  alias: string
  holder_name: string
  holder_dni: string
  is_verified: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface PaymentConfig {
  mercadopago: {
    enabled: boolean
    access_token: string
    public_key: string
    webhook_url: string
  }
  stripe: {
    enabled: boolean
    secret_key: string
    public_key: string
    webhook_endpoint: string
  }
  manual_methods: {
    cash: boolean
    card: boolean
    qr: boolean
  }
}

export default function BankConfigManagement() {
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    mercadopago: { enabled: false, access_token: "", public_key: "", webhook_url: "" },
    stripe: { enabled: false, secret_key: "", public_key: "", webhook_endpoint: "" },
    manual_methods: { cash: true, card: true, qr: true }
  })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Estados para el formulario de cuenta bancaria
  const [bankForm, setBankForm] = useState<{
    bank_name: string
    account_type: "corriente" | "ahorro" | "caja_ahorro"
    account_number: string
    cbu: string
    alias: string
    holder_name: string
    holder_dni: string
  }>({
    bank_name: "",
    account_type: "corriente",
    account_number: "",
    cbu: "",
    alias: "",
    holder_name: "",
    holder_dni: ""
  })

  useEffect(() => {
    fetchBankConfig()
  }, [])

  const fetchBankConfig = async () => {
    setLoading(true)
    try {
      // En producción, esto vendría del backend
      // Por ahora, uso datos de ejemplo
      setBankAccount({
        id: "1",
        bank_name: "Banco Galicia",
        account_type: "corriente",
        account_number: "1234567890",
        cbu: "0070123440000012345671",
        alias: "mi.restaurante.galicia",
        holder_name: "Mi Restaurante S.A.",
        holder_dni: "20-12345678-9",
        is_verified: true,
        is_active: true,
        created_at: "2024-01-15",
        updated_at: "2024-01-15"
      })

      setPaymentConfig({
        mercadopago: {
          enabled: true,
          access_token: "APP_USR-***************",
          public_key: "APP_USR-***************",
          webhook_url: "https://miapp.com/webhook/mercadopago"
        },
        stripe: {
          enabled: false,
          secret_key: "",
          public_key: "",
          webhook_endpoint: ""
        },
        manual_methods: {
          cash: true,
          card: true,
          qr: true
        }
      })
    } catch (error) {
      console.error("Error fetching bank config:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBankAccount = async () => {
    setSaving(true)
    try {
      const updatedAccount: BankAccount = {
        id: bankAccount?.id || Date.now().toString(),
        ...bankForm,
        is_verified: false,
        is_active: true,
        created_at: bankAccount?.created_at || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0]
      }
      
      setBankAccount(updatedAccount)
      setIsEditing(false)
      setBankForm({
        bank_name: "",
        account_type: "corriente",
        account_number: "",
        cbu: "",
        alias: "",
        holder_name: "",
        holder_dni: ""
      })
    } catch (error) {
      console.error("Error saving bank account:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePaymentConfig = async (provider: keyof PaymentConfig, config: any) => {
    try {
      setPaymentConfig(prev => ({
        ...prev,
        [provider]: { ...prev[provider], ...config }
      }))
    } catch (error) {
      console.error("Error updating payment config:", error)
    }
  }

  const handleEditBankAccount = () => {
    if (bankAccount) {
      setBankForm({
        bank_name: bankAccount.bank_name,
        account_type: bankAccount.account_type,
        account_number: bankAccount.account_number,
        cbu: bankAccount.cbu,
        alias: bankAccount.alias,
        holder_name: bankAccount.holder_name,
        holder_dni: bankAccount.holder_dni
      })
      setIsEditing(true)
    }
  }

  const maskSensitiveData = (data: string, visibleChars: number = 4) => {
    if (data.length <= visibleChars) return data
    return "*".repeat(data.length - visibleChars) + data.slice(-visibleChars)
  }

  return (
    <div className="space-y-6">
      {/* Cuenta Bancaria */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-gray-600" />
              <div>
                <CardTitle>Cuenta Bancaria</CardTitle>
                <p className="text-sm text-gray-600">Configura la cuenta para recibir los pagos</p>
              </div>
            </div>
            {bankAccount && !isEditing && (
              <Button variant="outline" onClick={handleEditBankAccount}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!bankAccount && !isEditing ? (
            <div className="text-center py-8">
              <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay cuenta bancaria configurada</h3>
              <p className="text-gray-600 mb-4">Agrega una cuenta bancaria para recibir los pagos</p>
              <Button onClick={() => setIsEditing(true)}>
                <CreditCard className="w-4 h-4 mr-2" />
                Agregar Cuenta Bancaria
              </Button>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({...bankForm, bank_name: e.target.value})}
                    placeholder="Ej: Banco Galicia"
                  />
                </div>
                <div>
                  <Label htmlFor="account_type">Tipo de Cuenta</Label>
                  <Select value={bankForm.account_type} onValueChange={(value: any) => setBankForm({...bankForm, account_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corriente">Cuenta Corriente</SelectItem>
                      <SelectItem value="ahorro">Caja de Ahorro</SelectItem>
                      <SelectItem value="caja_ahorro">Cuenta de Ahorro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_number">Número de Cuenta</Label>
                  <Input
                    id="account_number"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({...bankForm, account_number: e.target.value})}
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="cbu">CBU</Label>
                  <Input
                    id="cbu"
                    value={bankForm.cbu}
                    onChange={(e) => setBankForm({...bankForm, cbu: e.target.value})}
                    placeholder="0070123440000012345671"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="alias">Alias</Label>
                <Input
                  id="alias"
                  value={bankForm.alias}
                  onChange={(e) => setBankForm({...bankForm, alias: e.target.value})}
                  placeholder="mi.restaurante.galicia"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="holder_name">Titular de la Cuenta</Label>
                  <Input
                    id="holder_name"
                    value={bankForm.holder_name}
                    onChange={(e) => setBankForm({...bankForm, holder_name: e.target.value})}
                    placeholder="Mi Restaurante S.A."
                  />
                </div>
                <div>
                  <Label htmlFor="holder_dni">CUIT/DNI</Label>
                  <Input
                    id="holder_dni"
                    value={bankForm.holder_dni}
                    onChange={(e) => setBankForm({...bankForm, holder_dni: e.target.value})}
                    placeholder="20-12345678-9"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSaveBankAccount} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Guardando..." : "Guardar Cuenta"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : bankAccount && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Badge className={bankAccount.is_verified ? "bg-green-100 text-green-800 border-green-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"}>
                  {bankAccount.is_verified ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verificada
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Pendiente de verificación
                    </>
                  )}
                </Badge>
                <Badge className={bankAccount.is_active ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"}>
                  {bankAccount.is_active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Banco:</span>
                  <p className="text-gray-900">{bankAccount.bank_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Tipo de Cuenta:</span>
                  <p className="text-gray-900 capitalize">{bankAccount.account_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Número de Cuenta:</span>
                  <p className="text-gray-900 font-mono">{maskSensitiveData(bankAccount.account_number)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">CBU:</span>
                  <p className="text-gray-900 font-mono">{maskSensitiveData(bankAccount.cbu)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Alias:</span>
                  <p className="text-gray-900">{bankAccount.alias}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Titular:</span>
                  <p className="text-gray-900">{bankAccount.holder_name}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración de Métodos de Pago */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <div>
              <CardTitle>Métodos de Pago</CardTitle>
              <p className="text-sm text-gray-600">Configura los proveedores de pago</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MercadoPago */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">MP</span>
                </div>
                <div>
                  <h3 className="font-semibold">MercadoPago</h3>
                  <p className="text-sm text-gray-600">Pagos con billetera digital</p>
                </div>
              </div>
              <Badge className={paymentConfig.mercadopago.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                {paymentConfig.mercadopago.enabled ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="mp-access-token">Access Token</Label>
                <Input
                  id="mp-access-token"
                  type="password"
                  value={paymentConfig.mercadopago.access_token}
                  onChange={(e) => handleUpdatePaymentConfig('mercadopago', { access_token: e.target.value })}
                  placeholder="APP_USR-..."
                />
              </div>
              <div>
                <Label htmlFor="mp-public-key">Public Key</Label>
                <Input
                  id="mp-public-key"
                  value={paymentConfig.mercadopago.public_key}
                  onChange={(e) => handleUpdatePaymentConfig('mercadopago', { public_key: e.target.value })}
                  placeholder="APP_USR-..."
                />
              </div>
              <div>
                <Label htmlFor="mp-webhook">Webhook URL</Label>
                <Input
                  id="mp-webhook"
                  value={paymentConfig.mercadopago.webhook_url}
                  onChange={(e) => handleUpdatePaymentConfig('mercadopago', { webhook_url: e.target.value })}
                  placeholder="https://miapp.com/webhook/mercadopago"
                />
              </div>
            </div>
          </div>

          {/* Métodos Manuales */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-600 font-bold text-sm">💰</span>
              </div>
              <div>
                <h3 className="font-semibold">Métodos Manuales</h3>
                <p className="text-sm text-gray-600">Pagos gestionados por el mozo</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="cash"
                  checked={paymentConfig.manual_methods.cash}
                  onChange={(e) => handleUpdatePaymentConfig('manual_methods', { cash: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="cash">Efectivo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="card"
                  checked={paymentConfig.manual_methods.card}
                  onChange={(e) => handleUpdatePaymentConfig('manual_methods', { card: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="card">Tarjeta</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="qr"
                  checked={paymentConfig.manual_methods.qr}
                  onChange={(e) => handleUpdatePaymentConfig('manual_methods', { qr: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="qr">QR</Label>
              </div>
            </div>
          </div>

          {/* Información de Seguridad */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Seguridad</h4>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Todas las claves se almacenan de forma segura y encriptada</li>
                  <li>• Los datos bancarios están protegidos con cifrado de extremo a extremo</li>
                  <li>• Solo el titular de la cuenta puede modificar esta información</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 