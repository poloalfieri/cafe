import KitchenDashboard from "@/components/kitchen-dashboard"
import { MesaQRGenerator } from "@/components/mesa-qr-generator"

export default function CajeroPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Cajero</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Generador de QR Codes</h2>
            <MesaQRGenerator mesaId="1" />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-4">Dashboard de Cocina</h2>
            <KitchenDashboard />
          </div>
        </div>
      </div>
    </div>
  )
} 