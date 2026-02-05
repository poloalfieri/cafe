'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const TEST_DATA = {
  mesaId: '1',
  token: 'test_token_123'
}

export default function TestSessionPage() {
  const router = useRouter()

  const startTestSession = () => {
    // Guardar en sessionStorage
    sessionStorage.setItem('mesa_session', JSON.stringify({
      mesa_id: TEST_DATA.mesaId,
      token: TEST_DATA.token
    }))

    // Redirigir al menú usuario
    router.push(`/usuario?mesa_id=${TEST_DATA.mesaId}&token=${TEST_DATA.token}`)
  }

  const startWithCustomMesa = (mesaId: string) => {
    sessionStorage.setItem('mesa_session', JSON.stringify({
      mesa_id: mesaId,
      token: TEST_DATA.token
    }))

    router.push(`/usuario?mesa_id=${mesaId}&token=${TEST_DATA.token}`)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Testing Session</CardTitle>
          <CardDescription>
            Inicia una sesión de testing con datos hardcodeados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 p-3 rounded text-sm space-y-1">
            <p><strong>Mesa ID:</strong> {TEST_DATA.mesaId}</p>
            <p><strong>Token:</strong> {TEST_DATA.token}</p>
          </div>

          <Button 
            onClick={startTestSession}
            className="w-full"
          >
            Iniciar Sesión de Testing
          </Button>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">O prueba con diferentes mesas:</p>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6'].map((mesa) => (
                <Button
                  key={mesa}
                  variant="outline"
                  size="sm"
                  onClick={() => startWithCustomMesa(mesa)}
                >
                  Mesa {mesa}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
