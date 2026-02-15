'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
  branch_id?: string
}

interface Restaurant {
  id: string
  name: string
  slug: string
}

export default function TestSessionPage() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('')
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [loadingMesas, setLoadingMesas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        if (!supabaseUrl || !supabaseAnonKey) {
          setError('Faltan variables de entorno de Supabase')
          setRestaurants([])
          return
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/restaurants?select=id,name,slug&order=name`,
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
        setRestaurants(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('No se pudieron cargar los restaurantes desde la base de datos')
        setRestaurants([])
      } finally {
        setLoadingRestaurants(false)
      }
    }

    loadRestaurants()
  }, [supabaseUrl, supabaseAnonKey])

  useEffect(() => {
    const loadMesas = async () => {
      try {
        setError(null)
        if (!supabaseUrl || !supabaseAnonKey || !selectedRestaurant) {
          setMesas([])
          return
        }
        setLoadingMesas(true)

        const response = await fetch(
          `${supabaseUrl}/rest/v1/mesas?select=id,mesa_id,is_active,branch_id&restaurant_id=eq.${selectedRestaurant}&order=mesa_id`,
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
        setMesas(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('No se pudieron cargar las mesas desde la base de datos')
        setMesas([])
      } finally {
        setLoadingMesas(false)
      }
    }

    loadMesas()
  }, [supabaseUrl, supabaseAnonKey, selectedRestaurant])

  const selectedSlug = restaurants.find(r => r.id === selectedRestaurant)?.slug

  const startWithMesa = async (mesaId: string, branchId: string | undefined) => {
    try {
      setError(null)
      if (!branchId) {
        throw new Error('branch_id requerido')
      }
      if (!selectedSlug) {
        throw new Error('slug del restaurante no encontrado')
      }
      const response = await fetch(`/api/${selectedSlug}/mesas/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mesa_id: mesaId, branch_id: branchId }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const token = data?.token
      if (!token) {
        throw new Error('Token no recibido')
      }

      sessionStorage.setItem('mesa_session', JSON.stringify({
        mesa_id: mesaId,
        branch_id: branchId,
        token,
      }))

      router.push(`/${selectedSlug}/usuario?mesa_id=${mesaId}&branch_id=${branchId}&token=${token}`)
    } catch (err) {
      setError('No se pudo iniciar la sesión para esa mesa')
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Testing Session</CardTitle>
          <CardDescription>
            Inicia una sesión de testing con mesas reales de la base de datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingRestaurants && (
            <div className="text-sm text-gray-600">Cargando restaurantes...</div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          {!loadingRestaurants && restaurants.length === 0 && !error && (
            <div className="text-sm text-gray-600">No hay restaurantes registrados.</div>
          )}

          {!loadingRestaurants && restaurants.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Selecciona un restaurante:</p>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedRestaurant}
                onChange={(e) => setSelectedRestaurant(e.target.value)}
              >
                <option value="">Seleccionar restaurante</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedRestaurant && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Selecciona una mesa:</p>
              {loadingMesas ? (
                <div className="text-sm text-gray-600">Cargando mesas...</div>
              ) : mesas.length === 0 ? (
                <div className="text-sm text-gray-600">No hay mesas registradas.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mesas.map((mesa) => (
                    <Button
                      key={mesa.id}
                      variant="outline"
                      size="sm"
                      onClick={() => startWithMesa(mesa.mesa_id, mesa.branch_id)}
                      disabled={!mesa.is_active}
                    >
                      Mesa {mesa.mesa_id}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
