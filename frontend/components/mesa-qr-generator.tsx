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

  const SUPABASE_URL = 'https://jkiqaytofyqrptkzvzei.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraXFheXRvZnlxcnB0a3p2emVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTMxMzcsImV4cCI6MjA2ODk2OTEzN30.ElLG1xcsJ5D3N2NXVTX2yH3CY6Jc7pE89qANZ_NCwSM'

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
        console.error('Error generando token')
      }
    } catch (error) {
      console.error('Error:', error)
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
      console.error('Error copiando al portapapeles:', error)
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