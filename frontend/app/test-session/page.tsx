'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
}

export default function TestSessionPage() {
  const router = useRouter()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  useEffect(() => {
    const loadMesas = async () => {
      try {
        if (!supabaseUrl || !supabaseAnonKey) {
          setError('Faltan variables de entorno de Supabase')
          setMesas([])
          return
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/mesas?select=id,mesa_id,is_active&order=mesa_id`,
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
        setLoading(false)
      }
    }

    loadMesas()
  }, [supabaseUrl, supabaseAnonKey])

  const startWithMesa = async (mesaId: string) => {
    try {
      setError(null)
      const response = await fetch(`${backendUrl}/mesas/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mesa_id: mesaId }),
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
        token,
      }))

      router.push(`/usuario?mesa_id=${mesaId}&token=${token}`)
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
          {loading && (
            <div className="text-sm text-gray-600">Cargando mesas...</div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          {!loading && mesas.length === 0 && !error && (
            <div className="text-sm text-gray-600">No hay mesas registradas.</div>
          )}

          {!loading && mesas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Selecciona una mesa:</p>
              <div className="grid grid-cols-3 gap-2">
                {mesas.map((mesa) => (
                  <Button
                    key={mesa.id}
                    variant="outline"
                    size="sm"
                    onClick={() => startWithMesa(mesa.mesa_id)}
                    disabled={!mesa.is_active}
                  >
                    Mesa {mesa.mesa_id}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
