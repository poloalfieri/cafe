"use client"

import Link from "next/link"

export default function TestMenuPage() {
  const mesaId = "1"
  const token = "XA2r4Ggt4X7Bti7XWSR0cQ"

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🍽️ Test Menu Links</h1>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📱 Link Directo al Menú</h2>
            <p className="text-gray-600 mb-4">
              Este link te lleva directamente al menú de la <strong>Mesa 1</strong> con un token válido:
            </p>
            
            <div className="bg-gray-100 p-3 rounded-md mb-4 font-mono text-sm">
              <div><strong>Mesa ID:</strong> {mesaId}</div>
              <div><strong>Token:</strong> {token}</div>
            </div>
            
            <Link 
              href={`/usuario?mesa_id=${mesaId}&token=${token}`}
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🍽️ Abrir Menú - Mesa 1
            </Link>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🛒 Link Directo al Carrito</h2>
            <p className="text-gray-600 mb-4">
              Este link te lleva directamente al carrito de la <strong>Mesa 1</strong>:
            </p>
            
            <Link 
              href={`/usuario/cart?mesa_id=${mesaId}&token=${token}`}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🛒 Abrir Carrito - Mesa 1
            </Link>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Instrucciones de Prueba</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li><strong>Abre el menú</strong> usando el primer link</li>
              <li><strong>Agrega productos</strong> al carrito</li>
              <li><strong>Haz clic en el carrito</strong> (debería aparecer el botón de pago)</li>
              <li><strong>Prueba el pago</strong> con Mercado Pago</li>
            </ol>
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 text-sm">
                <strong>Nota:</strong> Si ves "Error: Faltan datos de la mesa o token QR", significa que el token expiró. 
                Usa el botón "Generar Nuevo Token" en el archivo test-link.html y actualiza los links.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 