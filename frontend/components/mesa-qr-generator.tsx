'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { RefreshCw, QrCode, Copy } from 'lucide-react'

interface MesaQRGeneratorProps {
  mesaId: string
}

export function MesaQRGenerator({ mesaId }: MesaQRGeneratorProps) {
  const [token, setToken] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <p className="text-red-600">Error: Variables de entorno de Supabase no configuradas</p>
        </CardContent>
      </Card>
    )
  }

  const generateToken = async () => {
    setLoading(true)
    try {
      // Llamar a la función de renovar token
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/renew_mesa_token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mesa_id_param: mesaId })
      })

      if (response.ok) {
        const newToken = await response.text()
        setToken(newToken.replace(/"/g, '')) // Remover comillas
        generateQRUrl(newToken.replace(/"/g, ''))
      } else {
        // Error silencioso - el usuario verá que no se generó el token
      }
    } catch (error) {
      // Error silencioso - el usuario verá que no se generó el token
    } finally {
      setLoading(false)
    }
  }

  const generateQRUrl = (tokenValue: string) => {
    const url = `${window.location.origin}/usuario?mesa_id=${mesaId}&token=${tokenValue}`
    setQrUrl(url)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Error silencioso al copiar
    }
  }

  useEffect(() => {
    if (mesaId) {
      generateToken()
    }
  }, [mesaId])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          QR Code - Mesa {mesaId}
        </CardTitle>
        <CardDescription>
          Genera un nuevo token para la mesa y obtén el QR code
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">Token actual:</Label>
          <Input
            id="token"
            value={token}
            readOnly
            placeholder="Token de la mesa..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="qr-url">URL del QR:</Label>
          <div className="flex gap-2">
            <Input
              id="qr-url"
              value={qrUrl}
              readOnly
              placeholder="URL para el QR code..."
            />
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="icon"
              className="flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          {copied && (
            <p className="text-sm text-green-600">¡Copiado al portapapeles!</p>
          )}
        </div>

        <Button
          onClick={generateToken}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generar Nuevo Token
            </>
          )}
        </Button>

        {qrUrl && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Escanea este QR code para acceder al menú:
            </p>
            <div className="bg-white p-4 rounded-lg border">
              {/* Aquí podrías integrar una librería de QR codes */}
              <div className="text-xs text-gray-500 break-all">
                {qrUrl}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 