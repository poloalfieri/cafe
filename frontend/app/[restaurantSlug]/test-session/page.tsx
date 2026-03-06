"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
  branch_id?: string
  branch_name?: string
}

interface Branch {
  id: string
  name: string
}

interface Restaurant {
  id: string
  slug: string
}

const SPECIAL_MESAS = new Set(["Delivery", "Caja"])

function getMesaLabel(mesaId: string) {
  return SPECIAL_MESAS.has(mesaId) ? mesaId : `Mesa ${mesaId}`
}

export default function TestSessionPage() {
  const router = useRouter()
  const params = useParams()
  const restaurantSlug = params.restaurantSlug as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMesas, setLoadingMesas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Load restaurant by slug
  useEffect(() => {
    const loadRestaurant = async () => {
      try {
        if (!supabaseUrl || !supabaseAnonKey) {
          setError("Faltan variables de entorno de Supabase")
          return
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/restaurants?select=id,slug&slug=eq.${restaurantSlug}&limit=1`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        if (!Array.isArray(data) || data.length === 0) {
          setError(`No se encontro un restaurante con slug "${restaurantSlug}"`)
          return
        }

        setRestaurant(data[0])
      } catch (err) {
        setError("No se pudo cargar el restaurante desde la base de datos")
      } finally {
        setLoading(false)
      }
    }

    loadRestaurant()
  }, [supabaseUrl, supabaseAnonKey, restaurantSlug])

  // Load mesas and branches when restaurant is loaded
  useEffect(() => {
    const loadMesasAndBranches = async () => {
      if (!restaurant || !supabaseUrl || !supabaseAnonKey) return
      try {
        setLoadingMesas(true)
        setError(null)

        const headers = {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        }

        const [mesasRes, branchesRes] = await Promise.all([
          fetch(
            `${supabaseUrl}/rest/v1/mesas?select=id,mesa_id,is_active,branch_id&restaurant_id=eq.${restaurant.id}&order=mesa_id`,
            { headers }
          ),
          fetch(
            `${supabaseUrl}/rest/v1/branches?select=id,name&restaurant_id=eq.${restaurant.id}&order=name`,
            { headers }
          ),
        ])

        if (!mesasRes.ok) throw new Error(`HTTP ${mesasRes.status}`)

        const mesasData = await mesasRes.json()
        const branchesData = branchesRes.ok ? await branchesRes.json() : []

        const branchesList: Branch[] = Array.isArray(branchesData) ? branchesData : []
        setBranches(branchesList)
        setMesas(Array.isArray(mesasData) ? mesasData : [])

        // Auto-select first branch if there's only one
        if (branchesList.length === 1) {
          setSelectedBranch(branchesList[0].id)
        }
      } catch (err) {
        setError("No se pudieron cargar las mesas desde la base de datos")
        setMesas([])
      } finally {
        setLoadingMesas(false)
      }
    }

    loadMesasAndBranches()
  }, [restaurant, supabaseUrl, supabaseAnonKey])

  const startWithMesa = async (mesaId: string, branchId: string | undefined) => {
    try {
      setError(null)
      if (!branchId) {
        throw new Error("branch_id requerido")
      }

      const response = await fetch(`/api/${restaurantSlug}/mesas/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mesa_id: mesaId, branch_id: branchId }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const token = data?.token
      if (!token) {
        throw new Error("Token no recibido")
      }

      sessionStorage.setItem(
        "mesa_session",
        JSON.stringify({
          mesa_id: mesaId,
          branch_id: branchId,
          token,
        })
      )

      router.push(
        `/${restaurantSlug}/usuario?mesa_id=${mesaId}&branch_id=${branchId}&token=${token}`
      )
    } catch (err) {
      setError("No se pudo iniciar la sesion para esa mesa")
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Testing Session</CardTitle>
          <CardDescription>
            Selecciona una mesa para testear el flujo de usuario en{" "}
            <span className="font-semibold">{restaurantSlug}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="text-sm text-gray-600">Cargando restaurante...</div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          {!loading && !restaurant && !error && (
            <div className="text-sm text-gray-600">
              Restaurante no encontrado.
            </div>
          )}

          {restaurant && (
            <div className="space-y-4">
              {loadingMesas ? (
                <div className="text-sm text-gray-600">Cargando mesas...</div>
              ) : mesas.length === 0 ? (
                <div className="text-sm text-gray-600">
                  No hay mesas registradas para este restaurante.
                </div>
              ) : (
                <>
                  {branches.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Selecciona una sucursal:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {branches.map((branch) => (
                          <Button
                            key={branch.id}
                            variant={selectedBranch === branch.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedBranch(branch.id)}
                          >
                            {branch.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBranch && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Selecciona una mesa:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {mesas
                          .filter((mesa) => mesa.branch_id === selectedBranch)
                          .map((mesa) => (
                            <Button
                              key={mesa.id}
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                startWithMesa(mesa.mesa_id, mesa.branch_id)
                              }
                              disabled={!mesa.is_active}
                            >
                              {getMesaLabel(mesa.mesa_id)}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500"
              onClick={() => router.push("/test-session")}
            >
              Ir a test-session global (elegir otro restaurante)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
