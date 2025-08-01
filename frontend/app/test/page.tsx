'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function TestPage() {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    console.log("TestPage - searchParams:", Object.fromEntries(searchParams.entries()))
    console.log("TestPage - mesa_id:", searchParams.get("mesa_id"))
    console.log("TestPage - token:", searchParams.get("token"))
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Página de Prueba</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Parámetros de URL:</h2>
          
          <div className="space-y-2">
            <div>
              <strong>mesa_id:</strong> {searchParams.get("mesa_id") || "No encontrado"}
            </div>
            <div>
              <strong>token:</strong> {searchParams.get("token") || "No encontrado"}
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="font-semibold mb-2">URLs de prueba:</h3>
            <div className="space-y-2 text-sm">
              <div>
                <a 
                  href="/usuario?mesa_id=1&token=test_token_123" 
                  className="text-blue-600 hover:underline"
                >
                  /usuario?mesa_id=1&token=test_token_123
                </a>
              </div>
              <div>
                <a 
                  href="/usuario/cart?mesa_id=1&token=test_token_123" 
                  className="text-blue-600 hover:underline"
                >
                  /usuario/cart?mesa_id=1&token=test_token_123
                </a>
              </div>
              <div>
                <a 
                  href="/usuario/cart?mesa_id=1&token=token_test_123_1753998986" 
                  className="text-blue-600 hover:underline"
                >
                  /usuario/cart?mesa_id=1&token=token_test_123_1753998986
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 